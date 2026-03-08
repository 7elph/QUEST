import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const draftSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  currentStep: z.number().int().min(1).max(6).default(1),
});

export async function GET() {
  try {
    const session = await requireRole([Role.PATRON]);

    const draft = await prisma.missionDraft.findUnique({
      where: { patronId: session.user.id },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao carregar draft." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireRole([Role.PATRON]);
    const body = await req.json();
    const parsed = draftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const payload = (parsed.data.payload ?? {}) as Prisma.InputJsonValue;

    const draft = await prisma.missionDraft.upsert({
      where: { patronId: session.user.id },
      update: {
        payload,
        currentStep: parsed.data.currentStep,
      },
      create: {
        patronId: session.user.id,
        payload,
        currentStep: parsed.data.currentStep,
      },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao salvar draft." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await requireRole([Role.PATRON]);
    await prisma.missionDraft.deleteMany({ where: { patronId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao limpar draft." }, { status: 500 });
  }
}
