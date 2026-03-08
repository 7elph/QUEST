import crypto from "crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { getStoreItemById, userOwnsStoreItem } from "@/lib/store";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";

const purchaseSchema = z.object({
  itemId: z.string().min(3).max(80),
  method: z.enum(["ENCHANTIUN", "MANUAL"]),
  proofUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireRole([Role.ADVENTURER]);
    const rate = await checkRateLimit(getClientKey(req, `store-purchase:${session.user.id}`), 20, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const item = getStoreItemById(parsed.data.itemId);
    if (!item) {
      return NextResponse.json({ error: "Item da loja nao encontrado." }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        xpLogs: { select: { xpChange: true } },
      },
    });
    if (!user || !user.profile) {
      return NextResponse.json({ error: "Perfil nao encontrado." }, { status: 404 });
    }

    const currentBadges = user.profile.badges ?? [];
    if (userOwnsStoreItem(currentBadges, item)) {
      return NextResponse.json({ error: "Item ja ativo no seu perfil." }, { status: 409 });
    }

    const enchantiunBalance = user.xpLogs.reduce((sum, log) => sum + log.xpChange, 0);

    if (parsed.data.method === "ENCHANTIUN") {
      if (enchantiunBalance < item.priceEnchantiun) {
        return NextResponse.json(
          { error: "Saldo de Enchantiun insuficiente.", balance: enchantiunBalance, required: item.priceEnchantiun },
          { status: 400 },
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.xPLog.create({
          data: {
            userId: user.id,
            xpChange: -item.priceEnchantiun,
            reason: `Compra em Enchantiun: ${item.name}`,
          },
        });
        await tx.profile.update({
          where: { userId: user.id },
          data: { badges: { push: item.badge } },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "STORE_ITEM_PURCHASED",
            targetType: "StoreItem",
            targetId: item.id,
            metadata: {
              method: "ENCHANTIUN",
              status: "CONFIRMED",
              priceEnchantiun: item.priceEnchantiun,
              itemName: item.name,
            },
          },
        });
        return enchantiunBalance - item.priceEnchantiun;
      });

      await pushNotification({
        userId: user.id,
        type: "SYSTEM",
        title: "Compra confirmada",
        message: `${item.name} ativado no seu perfil por ${item.priceEnchantiun} Enchantiun.`,
      });

      return NextResponse.json({
        status: "CONFIRMED",
        method: "ENCHANTIUN",
        itemId: item.id,
        enchantiunBalance: updated,
      });
    }

    const requestId = crypto.randomUUID();
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "STORE_ITEM_PURCHASE_REQUESTED",
        targetType: "StorePurchaseRequest",
        targetId: requestId,
        metadata: {
          requestId,
          itemId: item.id,
          itemName: item.name,
          userId: user.id,
          userEmail: user.email,
          method: "MANUAL",
          status: "PENDING",
          priceEnchantiun: item.priceEnchantiun,
          priceBrl: item.priceBrl,
          proofUrl: parsed.data.proofUrl ?? null,
        },
      },
    });

    const financeAdmins = await prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        OR: [{ adminScope: "FINANCE" }, { adminScope: "SUPER_ADMIN" }, { adminScope: null }],
      },
      select: { id: true },
    });

    await Promise.all(
      financeAdmins.map((admin) =>
        pushNotification({
          userId: admin.id,
          type: "SYSTEM",
          title: "Pedido manual de artefato",
          message: `${user.email} solicitou ${item.name}.`,
          metadata: { requestId, itemId: item.id, userId: user.id, proofUrl: parsed.data.proofUrl ?? null },
        }),
      ),
    );

    await pushNotification({
      userId: user.id,
      type: "SYSTEM",
      title: "Pedido enviado para aprovacao",
      message: `Sua solicitacao manual de ${item.name} foi enviada para o admin financeiro.`,
      metadata: { requestId, itemId: item.id },
    });

    return NextResponse.json({
      status: "PENDING",
      method: "MANUAL",
      requestId,
      itemId: item.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao processar compra." }, { status: 500 });
  }
}
