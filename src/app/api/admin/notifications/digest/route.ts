import { NextResponse } from "next/server";
import { AdminScope, DigestType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  type: z.nativeEnum(DigestType).default(DigestType.DAILY),
});

export async function POST(req: Request) {
  try {
    await requireAdminScope([AdminScope.OPS, AdminScope.SUPER_ADMIN]);
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, email: true },
    });

    let sent = 0;
    for (const user of users) {
      const unread = await prisma.notification.findMany({
        where: { userId: user.id, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      if (unread.length === 0) continue;

      const text = unread.map((item) => `- ${item.title}: ${item.message}`).join("\n");
      await sendEmail({
        to: user.email,
        subject: `Resumo ${parsed.data.type.toLowerCase()} QUEST`,
        text: `Voce tem ${unread.length} notificacoes nao lidas:\n${text}`,
      });

      await prisma.notificationDigest.create({
        data: {
          userId: user.id,
          type: parsed.data.type,
          payload: { count: unread.length },
        },
      });

      sent += 1;
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao enviar digest." }, { status: 500 });
  }
}
