import { NextResponse } from "next/server";
import { AdminScope, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";

const statusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminScope([AdminScope.MODERATOR]);
    const body = await req.json();
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { status: parsed.data.status },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "USER_STATUS_UPDATED",
      targetType: "User",
      targetId: user.id,
      metadata: { status: user.status },
    });

    await pushNotification({
      userId: user.id,
      type: "SYSTEM",
      title: "Status da conta atualizado",
      message: `Seu status foi atualizado para ${user.status}.`,
      sendEmailTo: user.email,
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao atualizar usuario." }, { status: 500 });
  }
}
