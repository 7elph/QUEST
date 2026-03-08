import { NextResponse } from "next/server";
import { AdminScope, MissionStatus, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { sanitizeText } from "@/lib/sanitize";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { MissionTransitionError, transitionMissionStatus } from "@/lib/mission-status";

const approvalSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(1200).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminScope([AdminScope.OPS, AdminScope.MODERATOR]);
    const rate = await checkRateLimit(
      getClientKey(req, `admin-mission-approval:${params.id}:${session.user.id}`),
      80,
      10 * 60 * 1000,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = approvalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const mission = await prisma.mission.findUnique({
      where: { id: params.id },
      include: { screening: true },
    });

    if (!mission) {
      return NextResponse.json({ error: "Missao nao encontrada." }, { status: 404 });
    }

    if (mission.status !== MissionStatus.DRAFT) {
      return NextResponse.json({ error: "Missao nao esta pendente de aprovacao." }, { status: 400 });
    }

    const approved = parsed.data.decision === "APPROVE";
    const updatedMission = await transitionMissionStatus({
      missionId: mission.id,
      toStatus: approved ? MissionStatus.OPEN : MissionStatus.CANCELLED,
      actorRole: Role.ADMIN,
      actorId: session.user.id,
    });

    if (mission.screening) {
      await prisma.missionScreening.update({
        where: { missionId: mission.id },
        data: {
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          reviewedComment: parsed.data.comment ? sanitizeText(parsed.data.comment) : null,
        },
      });
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "MISSION_APPROVAL_DECIDED",
      targetType: "Mission",
      targetId: mission.id,
      metadata: {
        decision: parsed.data.decision,
        comment: parsed.data.comment ?? null,
        screeningDecision: mission.screening?.decision ?? null,
      },
    });

    await pushNotification({
      userId: mission.patronId,
      type: "MISSION",
      title: approved ? "Missao aprovada" : "Missao rejeitada",
      message: approved
        ? `Sua missao ${mission.title} entrou no painel de missoes.`
        : `Sua missao ${mission.title} foi rejeitada na triagem.`,
      metadata: {
        missionId: mission.id,
        decision: parsed.data.decision,
      },
    });

    return NextResponse.json({ mission: updatedMission });
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
    return NextResponse.json({ error: "Falha ao decidir aprovacao da missao." }, { status: 500 });
  }
}
