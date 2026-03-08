import { NextResponse } from "next/server";
import { MissionStatus, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";

const checklistSchema = z.object({
  itemIndex: z.number().int().min(0),
  done: z.boolean(),
});

function normalizeState(current: boolean[], size: number) {
  const base = new Array(size).fill(false);
  current.slice(0, size).forEach((value, index) => {
    base[index] = !!value;
  });
  return base;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole([Role.ADVENTURER]);
    const body = await req.json();
    const parsed = checklistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const mission = await prisma.mission.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        patronId: true,
        assignedTo: true,
        status: true,
        victoryConditions: true,
      },
    });

    if (!mission) {
      return NextResponse.json({ error: "Missao nao encontrada." }, { status: 404 });
    }

    if (mission.assignedTo !== session.user.id) {
      return NextResponse.json({ error: "Voce nao esta atribuido nesta missao." }, { status: 403 });
    }

    if (mission.status === MissionStatus.CANCELLED || mission.status === MissionStatus.COMPLETED) {
      return NextResponse.json({ error: "Checklist bloqueado para missao finalizada." }, { status: 400 });
    }

    if (parsed.data.itemIndex >= mission.victoryConditions.length) {
      return NextResponse.json({ error: "Item de checklist invalido." }, { status: 400 });
    }

    const existing = await prisma.missionProgress.findUnique({
      where: {
        missionId_adventurerId: {
          missionId: mission.id,
          adventurerId: session.user.id,
        },
      },
    });

    const progress = existing
      ? existing
      : await prisma.missionProgress.create({
          data: {
            missionId: mission.id,
            adventurerId: session.user.id,
            checklistState: new Array(mission.victoryConditions.length).fill(false),
            completionPct: 0,
          },
        });

    const state = normalizeState(progress.checklistState, mission.victoryConditions.length);
    state[parsed.data.itemIndex] = parsed.data.done;
    const doneCount = state.filter(Boolean).length;
    const completionPct = mission.victoryConditions.length
      ? Math.round((doneCount / mission.victoryConditions.length) * 100)
      : 0;

    const updated = await prisma.missionProgress.update({
      where: { id: progress.id },
      data: {
        checklistState: state,
        completionPct,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "MISSION_CHECKLIST_UPDATED",
      targetType: "MissionProgress",
      targetId: updated.id,
      metadata: {
        missionId: mission.id,
        itemIndex: parsed.data.itemIndex,
        done: parsed.data.done,
        completionPct,
      },
    });

    if (completionPct === 100) {
      await pushNotification({
        userId: mission.patronId,
        type: "MISSION",
        title: "Checklist concluido",
        message: `Checklist da missao ${mission.title} foi marcado como completo pelo aventureiro.`,
        metadata: { missionId: mission.id, completionPct },
      });
    }

    return NextResponse.json({
      progress: {
        id: updated.id,
        checklistState: updated.checklistState,
        completionPct: updated.completionPct,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao atualizar checklist." }, { status: 500 });
  }
}
