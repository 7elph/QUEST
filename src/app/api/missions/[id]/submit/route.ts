import { NextResponse } from "next/server";
import { MissionStatus, Role, SubmissionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sanitizeArray, sanitizeText } from "@/lib/sanitize";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { MissionTransitionError, transitionMissionStatus } from "@/lib/mission-status";

const submitSchema = z.object({
  proofLinks: z.array(z.string().url()).max(10).default([]),
  proofFiles: z.array(z.string()).max(10).default([]),
  notes: z.string().max(2000).optional(),
});
const allowedSubmissionStatuses: MissionStatus[] = [
  MissionStatus.ASSIGNED,
  MissionStatus.REVISION_REQUESTED,
];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole([Role.ADVENTURER]);
    const rate = await checkRateLimit(
      getClientKey(req, `mission-submit:${params.id}:${session.user.id}`),
      30,
      10 * 60 * 1000,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const mission = await prisma.mission.findUnique({ where: { id: params.id } });
    if (!mission || mission.assignedTo !== session.user.id) {
      return NextResponse.json({ error: "Voce nao esta atribuido nesta missao." }, { status: 403 });
    }
    if (!allowedSubmissionStatuses.includes(mission.status)) {
      return NextResponse.json({ error: "A missao nao esta em fase de envio de prova." }, { status: 400 });
    }

    const proofLinks = sanitizeArray(parsed.data.proofLinks);
    const rawProofFiles = sanitizeArray(parsed.data.proofFiles);
    const proofFiles = Array.from(new Set(rawProofFiles));
    if (proofFiles.some((item) => !item.startsWith("/uploads/"))) {
      return NextResponse.json({ error: "Arquivo de prova invalido. Reenvie o arquivo." }, { status: 400 });
    }
    const notes = parsed.data.notes ? sanitizeText(parsed.data.notes) : null;

    if (proofFiles.length > 0) {
      const uploadedAssets = await prisma.uploadedAsset.findMany({
        where: {
          userId: session.user.id,
          url: { in: proofFiles },
        },
        select: { id: true, url: true },
      });
      if (uploadedAssets.length !== proofFiles.length) {
        return NextResponse.json({ error: "Algumas provas de arquivo nao sao validas para este usuario." }, { status: 400 });
      }
    }

    const submission = await prisma.$transaction(async (tx) => {
      const existing = await tx.submission.findUnique({
        where: { missionId_adventurerId: { missionId: params.id, adventurerId: session.user.id } },
      });

      if (!existing) {
        const created = await tx.submission.create({
          data: {
            missionId: params.id,
            adventurerId: session.user.id,
            proofLinks,
            proofFiles,
            notes,
            revisionCount: 0,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        });

        await tx.submissionRevision.create({
          data: {
            submissionId: created.id,
            version: 1,
            proofLinks,
            proofFiles,
            notes,
          },
        });

        if (proofFiles.length > 0) {
          await tx.uploadedAsset.updateMany({
            where: {
              userId: session.user.id,
              url: { in: proofFiles },
            },
            data: {
              missionId: params.id,
              submissionId: created.id,
              usedAt: new Date(),
            },
          });
        }

        return created;
      }

      const nextRevision = existing.revisionCount + 1;
      const latestRevision = await tx.submissionRevision.findFirst({
        where: { submissionId: existing.id },
        orderBy: { version: "desc" },
      });
      const updated = await tx.submission.update({
        where: { id: existing.id },
        data: {
          proofLinks,
          proofFiles,
          notes,
          revisionCount: nextRevision,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      await tx.submissionRevision.create({
        data: {
          submissionId: existing.id,
          version: (latestRevision?.version ?? 1) + 1,
          proofLinks,
          proofFiles,
          notes,
        },
      });

      if (proofFiles.length > 0) {
        await tx.uploadedAsset.updateMany({
          where: {
            userId: session.user.id,
            url: { in: proofFiles },
          },
          data: {
            missionId: params.id,
            submissionId: existing.id,
            usedAt: new Date(),
          },
        });
      }

      return updated;
    });

    await transitionMissionStatus({
      missionId: params.id,
      toStatus: MissionStatus.IN_REVIEW,
      actorRole: Role.ADVENTURER,
      actorId: session.user.id,
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "SUBMISSION_CREATED",
      targetType: "Submission",
      targetId: submission.id,
      metadata: { missionId: params.id, revisionCount: submission.revisionCount },
    });

    await pushNotification({
      userId: mission.patronId,
      type: "REVIEW",
      title: "Nova submissao recebida",
      message: `A missao ${mission.title} recebeu uma nova prova para revisao.`,
      metadata: { missionId: mission.id },
    });

    return NextResponse.json({ submission }, { status: 201 });
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
    return NextResponse.json({ error: "Falha ao enviar prova." }, { status: 500 });
  }
}
