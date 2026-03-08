import { NextResponse } from "next/server";
import { BudgetRange, DeliverableFormat, MissionCategory, MissionTemplateVisibility, RewardType, Role } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sanitizeArray, sanitizeText } from "@/lib/sanitize";

const templateSchema = z.object({
  name: z.string().min(3).max(80),
  category: z.nativeEnum(MissionCategory),
  scopeTemplate: z.string().min(8).max(1000),
  victoryConditionsTemplate: z.array(z.string().min(2).max(160)).min(3).max(7),
  deliverableFormat: z.nativeEnum(DeliverableFormat),
  budgetRange: z.nativeEnum(BudgetRange),
  rewardType: z.nativeEnum(RewardType),
  sponsoredDefault: z.boolean().default(false),
  narrativeTemplate: z.string().max(3000).optional(),
});

export async function GET() {
  try {
    const session = await requireRole([Role.PATRON, Role.ADMIN]);

    const templates = await prisma.missionTemplate.findMany({
      where: {
        active: true,
        OR: [
          { visibility: MissionTemplateVisibility.SYSTEM },
          { createdById: session.user.id },
        ],
      },
      orderBy: [{ visibility: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao listar templates." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole([Role.PATRON, Role.ADMIN]);
    const body = await req.json();
    const parsed = templateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const template = await prisma.missionTemplate.create({
      data: {
        createdById: session.user.id,
        visibility: MissionTemplateVisibility.PATRON,
        name: sanitizeText(parsed.data.name),
        category: parsed.data.category,
        scopeTemplate: sanitizeText(parsed.data.scopeTemplate),
        victoryConditionsTemplate: sanitizeArray(parsed.data.victoryConditionsTemplate),
        deliverableFormat: parsed.data.deliverableFormat,
        budgetRange: parsed.data.budgetRange,
        rewardType: parsed.data.rewardType,
        sponsoredDefault: parsed.data.sponsoredDefault,
        narrativeTemplate: parsed.data.narrativeTemplate ? sanitizeText(parsed.data.narrativeTemplate) : null,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao criar template." }, { status: 500 });
  }
}
