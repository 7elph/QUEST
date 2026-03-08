import { NextResponse } from "next/server";
import { DisputeStatus, MissionStatus, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { MissionTransitionError, transitionMissionStatus } from "@/lib/mission-status";

const disputeSchema = z.object({
  reason: z.string().min(3).max(500),
  evidenceNotes: z.string().max(1500).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole([Role.PATRON, Role.ADVENTURER]);
    const rate = await checkRateLimit(
      getClientKey(req, `mission-dispute:${params.id}:${session.user.id}`),
      20,
      10 * 60 * 1000,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = disputeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const mission = await prisma.mission.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, patronId: true, assignedTo: true, status: true },
    });
    if (!mission) {
      return NextResponse.json({ error: "Missao nao encontrada." }, { status: 404 });
    }
    if (session.user.role === Role.PATRON && mission.patronId !== session.user.id) {
      return NextResponse.json({ error: "Missao nao pertence ao patrono." }, { status: 403 });
    }
    if (session.user.role === Role.ADVENTURER && mission.assignedTo !== session.user.id) {
      return NextResponse.json({ error: "Voce nao esta atribuido nesta missao." }, { status: 403 });
    }

    const dispute = await prisma.dispute.upsert({
      where: { missionId: params.id },
      update: {
        reason: sanitizeText(parsed.data.reason),
        evidenceNotes: parsed.data.evidenceNotes ? sanitizeText(parsed.data.evidenceNotes) : null,
        openedBy: session.user.id,
        status: DisputeStatus.OPEN,
      },
      create: {
        missionId: params.id,
        openedBy: session.user.id,
        reason: sanitizeText(parsed.data.reason),
        evidenceNotes: parsed.data.evidenceNotes ? sanitizeText(parsed.data.evidenceNotes) : null,
      },
    });

    await transitionMissionStatus({
      missionId: params.id,
      toStatus: MissionStatus.DISPUTED,
      actorRole: session.user.role as Role,
      actorId: session.user.id,
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "DISPUTE_OPENED",
      targetType: "Dispute",
      targetId: dispute.id,
      metadata: { missionId: params.id },
    });

    const admins = await prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        OR: [{ adminScope: "OPS" }, { adminScope: "MODERATOR" }, { adminScope: "SUPER_ADMIN" }],
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        pushNotification({
          userId: admin.id,
          type: "DISPUTE",
          title: "Nova disputa aberta",
          message: `Disputa aberta para a missao ${mission?.title ?? params.id}.`,
          metadata: { disputeId: dispute.id, missionId: params.id },
        }),
      ),
    );

    if (mission?.patronId && mission.patronId !== session.user.id) {
      await pushNotification({
        userId: mission.patronId,
        type: "DISPUTE",
        title: "Disputa aberta em sua missao",
        message: `Uma disputa foi aberta na missao ${mission.title}.`,
      });
    }
    if (mission?.assignedTo && mission.assignedTo !== session.user.id) {
      await pushNotification({
        userId: mission.assignedTo,
        type: "DISPUTE",
        title: "Disputa aberta na missao atribuida",
        message: `Uma disputa foi aberta na missao ${mission.title}.`,
      });
    }

    return NextResponse.json({ dispute }, { status: 201 });
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
    return NextResponse.json({ error: "Falha ao abrir disputa." }, { status: 500 });
  }
}
