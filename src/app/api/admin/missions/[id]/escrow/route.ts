import { NextResponse } from "next/server";
import { AdminScope, EscrowStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";

const escrowSchema = z.object({
  escrowStatus: z.nativeEnum(EscrowStatus),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminScope([AdminScope.FINANCE]);
    const body = await req.json();
    const parsed = escrowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const mission = await prisma.mission.update({
      where: { id: params.id },
      data: { escrowStatus: parsed.data.escrowStatus },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "ESCROW_UPDATED",
      targetType: "Mission",
      targetId: mission.id,
      metadata: { escrowStatus: mission.escrowStatus },
    });

    await pushNotification({
      userId: mission.patronId,
      type: "ESCROW",
      title: "Escrow atualizado",
      message: `Escrow da missao ${mission.title} atualizado para ${mission.escrowStatus}.`,
    });

    if (mission.assignedTo) {
      await pushNotification({
        userId: mission.assignedTo,
        type: "ESCROW",
        title: "Escrow atualizado",
        message: `Escrow da missao ${mission.title} atualizado para ${mission.escrowStatus}.`,
      });
    }

    return NextResponse.json({ mission });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao atualizar escrow." }, { status: 500 });
  }
}
