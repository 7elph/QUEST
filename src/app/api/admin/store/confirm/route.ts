import { NextResponse } from "next/server";
import { AdminScope } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { getStoreItemById, userOwnsStoreItem } from "@/lib/store";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";

const confirmSchema = z.object({
  requestId: z.string().min(6).max(120),
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(600).optional(),
});

const requestMetaSchema = z.object({
  requestId: z.string(),
  itemId: z.string(),
  userId: z.string(),
  userEmail: z.string().email().optional(),
  itemName: z.string(),
  method: z.literal("MANUAL"),
  status: z.literal("PENDING"),
  priceEnchantiun: z.number(),
  priceBrl: z.string(),
  proofUrl: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireAdminScope([AdminScope.FINANCE]);
    const rate = await checkRateLimit(getClientKey(req, `admin-store-confirm:${session.user.id}`), 60, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const requestLog = await prisma.auditLog.findFirst({
      where: {
        action: "STORE_ITEM_PURCHASE_REQUESTED",
        targetType: "StorePurchaseRequest",
        targetId: parsed.data.requestId,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!requestLog) {
      return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
    }

    const resolved = await prisma.auditLog.findFirst({
      where: {
        action: "STORE_ITEM_PURCHASE_RESOLVED",
        targetType: "StorePurchaseRequest",
        targetId: parsed.data.requestId,
      },
    });
    if (resolved) {
      return NextResponse.json({ error: "Pedido ja foi resolvido." }, { status: 400 });
    }

    const meta = requestMetaSchema.safeParse(requestLog.metadata);
    if (!meta.success) {
      return NextResponse.json({ error: "Metadados de pedido invalidos." }, { status: 400 });
    }

    const item = getStoreItemById(meta.data.itemId);
    if (!item) {
      return NextResponse.json({ error: "Item da loja nao encontrado." }, { status: 404 });
    }

    if (parsed.data.decision === "APPROVE") {
      const user = await prisma.user.findUnique({
        where: { id: meta.data.userId },
        include: { profile: true },
      });
      if (!user || !user.profile) {
        return NextResponse.json({ error: "Usuario do pedido nao encontrado." }, { status: 404 });
      }
      if (!userOwnsStoreItem(user.profile.badges ?? [], item)) {
        await prisma.profile.update({
          where: { userId: user.id },
          data: { badges: { push: item.badge } },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "STORE_ITEM_PURCHASE_RESOLVED",
        targetType: "StorePurchaseRequest",
        targetId: parsed.data.requestId,
        metadata: {
          requestId: parsed.data.requestId,
          decision: parsed.data.decision,
          comment: parsed.data.comment ?? null,
          userId: meta.data.userId,
          itemId: meta.data.itemId,
          itemName: meta.data.itemName,
          status: parsed.data.decision === "APPROVE" ? "CONFIRMED" : "REJECTED",
        },
      },
    });

    await pushNotification({
      userId: meta.data.userId,
      type: "SYSTEM",
      title: parsed.data.decision === "APPROVE" ? "Compra manual aprovada" : "Compra manual rejeitada",
      message:
        parsed.data.decision === "APPROVE"
          ? `${meta.data.itemName} foi ativado no seu perfil.`
          : `${meta.data.itemName} foi rejeitado pelo admin. ${parsed.data.comment ? `Motivo: ${parsed.data.comment}` : ""}`,
      metadata: {
        requestId: parsed.data.requestId,
        decision: parsed.data.decision,
        comment: parsed.data.comment ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao confirmar compra da loja." }, { status: 500 });
  }
}
