import { NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireSession();

    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      }),
    ]);

    return NextResponse.json({ notifications: items, unread });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao carregar notificacoes." }, { status: 500 });
  }
}
