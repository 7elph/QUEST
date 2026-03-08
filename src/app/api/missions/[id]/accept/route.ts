import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { claimOpenMissionForAdventurer } from "@/lib/mission-status";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole([Role.ADVENTURER]);
    const rate = await checkRateLimit(
      getClientKey(req, `mission-accept:${params.id}:${session.user.id}`),
      20,
      10 * 60 * 1000,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const updated = await claimOpenMissionForAdventurer({
      missionId: params.id,
      adventurerId: session.user.id,
    });
    if (!updated) {
      return NextResponse.json({ error: "Missao indisponivel para aceite." }, { status: 409 });
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "MISSION_ACCEPTED",
      targetType: "Mission",
      targetId: params.id,
    });

    await Promise.all([
      pushNotification({
        userId: updated.patronId,
        type: "MISSION",
        title: "Missao aceita",
        message: `A missao ${updated.title} foi aceita por um aventureiro.`,
      }),
      pushNotification({
        userId: session.user.id,
        type: "MISSION",
        title: "Missao atribuida",
        message: `Voce aceitou a missao ${updated.title}.`,
      }),
    ]);

    return NextResponse.json({ mission: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao aceitar missao." }, { status: 500 });
  }
}
