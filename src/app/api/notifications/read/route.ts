import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  notificationId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    if (parsed.data.notificationId) {
      await prisma.notification.updateMany({
        where: { id: parsed.data.notificationId, userId: session.user.id },
        data: { readAt: new Date() },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao atualizar notificacoes." }, { status: 500 });
  }
}
