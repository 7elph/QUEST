import { NextResponse } from "next/server";
import { AdminScope } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";

const adjustSchema = z.object({
  amount: z.number().int().min(-50000).max(50000).refine((value) => value !== 0, "Valor nao pode ser zero."),
  reason: z.string().trim().min(3).max(240).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminScope([AdminScope.FINANCE]);
    const rate = await checkRateLimit(getClientKey(req, `admin-users-enchantiun:${session.user.id}`), 120, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    const amount = parsed.data.amount;
    const reason = parsed.data.reason ?? `Ajuste manual de Enchantiun por ${session.user.email}`;

    const balance = await prisma.$transaction(async (tx) => {
      await tx.xPLog.create({
        data: {
          userId: targetUser.id,
          xpChange: amount,
          reason,
        },
      });

      const updated = await tx.xPLog.aggregate({
        where: { userId: targetUser.id },
        _sum: { xpChange: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "ADMIN_ENCHANTIUN_ADJUSTED",
          targetType: "User",
          targetId: targetUser.id,
          metadata: {
            amount,
            reason,
            email: targetUser.email,
          },
        },
      });

      return updated._sum.xpChange ?? 0;
    });

    await pushNotification({
      userId: targetUser.id,
      type: "SYSTEM",
      title: "Saldo Enchantiun atualizado",
      message: `${amount > 0 ? "+" : ""}${amount} Enchantiun aplicado no seu saldo.`,
      metadata: { amount, reason },
    });

    return NextResponse.json({
      success: true,
      userId: targetUser.id,
      balance,
      delta: amount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao ajustar Enchantiun." }, { status: 500 });
  }
}
