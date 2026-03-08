import { NextResponse } from "next/server";
import { AdminScope, DisputeStatus, MissionStatus, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize";
import { requireAdminScope } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { MissionTransitionError, transitionMissionStatus } from "@/lib/mission-status";

const resolveSchema = z.object({
  resolution: z.string().min(5).max(2000),
  missionStatus: z.nativeEnum(MissionStatus).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminScope([AdminScope.OPS, AdminScope.MODERATOR]);
    const rate = await checkRateLimit(
      getClientKey(req, `admin-dispute-resolve:${params.id}:${session.user.id}`),
      80,
      10 * 60 * 1000,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = resolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const dispute = await prisma.dispute.update({
      where: { id: params.id },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution: sanitizeText(parsed.data.resolution),
        resolvedBy: session.user.id,
        resolvedAt: new Date(),
      },
    });

    if (parsed.data.missionStatus) {
      await transitionMissionStatus({
        missionId: dispute.missionId,
        toStatus: parsed.data.missionStatus,
        actorRole: Role.ADMIN,
        actorId: session.user.id,
        force: true,
      });
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "DISPUTE_RESOLVED",
      targetType: "Dispute",
      targetId: dispute.id,
    });

    const mission = await prisma.mission.findUnique({
      where: { id: dispute.missionId },
      select: { patronId: true, assignedTo: true },
    });

    if (mission) {
      await Promise.all([
        pushNotification({
          userId: mission.patronId,
          type: "DISPUTE",
          title: "Disputa resolvida",
          message: "A disputa da sua missao foi resolvida pelo admin.",
        }),
        ...(mission.assignedTo
          ? [
              pushNotification({
                userId: mission.assignedTo,
                type: "DISPUTE",
                title: "Disputa resolvida",
                message: "A disputa da missao atribuida a voce foi resolvida.",
              }),
            ]
          : []),
      ]);
    }

    return NextResponse.json({ dispute });
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
    return NextResponse.json({ error: "Falha ao resolver disputa." }, { status: 500 });
  }
}
