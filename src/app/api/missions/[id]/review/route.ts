import { NextResponse } from "next/server";
import { MissionStatus, ReviewDecision, Role, SubmissionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { MissionTransitionError, transitionMissionStatus } from "@/lib/mission-status";
import { getMissionRewardPreview } from "@/lib/mission-rewards";

const reviewSchema = z.object({
  decision: z.nativeEnum(ReviewDecision),
  comment: z.string().max(1200).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole([Role.PATRON]);
    const rate = await checkRateLimit(
      getClientKey(req, `mission-review:${params.id}:${session.user.id}`),
      40,
      10 * 60 * 1000,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const mission = await prisma.mission.findUnique({
      where: { id: params.id },
      include: {
        submissions: { orderBy: { submittedAt: "desc" }, take: 1 },
      },
    });

    if (!mission || mission.patronId !== session.user.id) {
      return NextResponse.json({ error: "Missao nao pertence ao patrono." }, { status: 403 });
    }

    const lastSubmission = mission.submissions[0];
    if (!lastSubmission) {
      return NextResponse.json({ error: "Sem submissao para revisar." }, { status: 400 });
    }

    const decision = parsed.data.decision;
    if (decision === ReviewDecision.REVISION) {
      const revisionRequests = await prisma.review.count({
        where: { missionId: mission.id, decision: ReviewDecision.REVISION },
      });
      if (revisionRequests >= mission.maxRevisions) {
        return NextResponse.json({ error: `Limite de ${mission.maxRevisions} revisao(oes) ja utilizado.` }, { status: 400 });
      }
    }

    const missionStatus =
      decision === ReviewDecision.ACCEPT
        ? MissionStatus.COMPLETED
        : decision === ReviewDecision.REVISION
          ? MissionStatus.REVISION_REQUESTED
          : MissionStatus.CANCELLED;

    const submissionStatus =
      decision === ReviewDecision.ACCEPT
        ? SubmissionStatus.ACCEPTED
        : decision === ReviewDecision.REVISION
          ? SubmissionStatus.REVISION_REQUESTED
          : SubmissionStatus.REJECTED;
    const rewardPreview =
      decision === ReviewDecision.ACCEPT
        ? getMissionRewardPreview(mission.id, mission.minRank)
        : { enchantiun: 0, drop: null };

    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          missionId: mission.id,
          patronId: session.user.id,
          decision,
          comment: parsed.data.comment ? sanitizeText(parsed.data.comment) : null,
        },
      });
      await tx.submission.update({
        where: { id: lastSubmission.id },
        data: { status: submissionStatus },
      });
      await transitionMissionStatus({
        missionId: mission.id,
        toStatus: missionStatus,
        actorRole: Role.PATRON,
        actorId: session.user.id,
        tx,
      });
      if (decision === ReviewDecision.ACCEPT && mission.assignedTo) {
        await tx.xPLog.create({
          data: {
            userId: mission.assignedTo,
            missionId: mission.id,
            xpChange: rewardPreview.enchantiun,
            reason: `Missao aprovada (+${rewardPreview.enchantiun} Enchantiun)`,
          },
        });
        if (rewardPreview.drop) {
          const profile = await tx.profile.findUnique({
            where: { userId: mission.assignedTo },
            select: { id: true },
          });
          if (profile) {
            await tx.profile.update({
              where: { id: profile.id },
              data: {
                badges: {
                  push: rewardPreview.drop.badge,
                },
              },
            });
          }
        }
      }
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "MISSION_REVIEWED",
      targetType: "Mission",
      targetId: mission.id,
      metadata: { decision },
    });

    if (mission.assignedTo) {
      await pushNotification({
        userId: mission.assignedTo,
        type: "REVIEW",
        title: "Sua entrega foi revisada",
        message:
          decision === ReviewDecision.ACCEPT
            ? rewardPreview.drop
              ? `Missao ${mission.title} aprovada. +${rewardPreview.enchantiun} Enchantiun e drop: ${rewardPreview.drop.name}.`
              : `Missao ${mission.title} aprovada. +${rewardPreview.enchantiun} Enchantiun.`
            : decision === ReviewDecision.REVISION
              ? `Missao ${mission.title} precisa de revisao.`
              : `Missao ${mission.title} foi rejeitada.`,
        metadata: {
          missionId: mission.id,
          decision,
          enchantiun: rewardPreview.enchantiun,
          dropItemId: rewardPreview.drop?.id ?? null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    if (error instanceof MissionTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao revisar missao." }, { status: 500 });
  }
}
