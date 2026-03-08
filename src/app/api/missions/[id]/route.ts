import { NextResponse } from "next/server";
import { MissionStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/rbac";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { MissionTransitionError, transitionMissionStatus } from "@/lib/mission-status";
import { canViewMissionDetails, isPublicMissionStatus } from "@/lib/mission-visibility";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const mission = await prisma.mission.findUnique({
      where: { id: params.id },
      include: {
        patron: { select: { id: true, name: true, nick: true } },
        assignedUser: { select: { id: true, name: true, nick: true } },
        progressRecords: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    });

    if (!mission) {
      return NextResponse.json({ error: "Missao nao encontrada." }, { status: 404 });
    }

    const isAdmin = session.user.role === Role.ADMIN;
    const isPatronOwner = session.user.role === Role.PATRON && mission.patronId === session.user.id;
    const isAssignedAdventurer = session.user.role === Role.ADVENTURER && mission.assignedTo === session.user.id;
    const canView = canViewMissionDetails({
      role: session.user.role as Role,
      userId: session.user.id,
      patronId: mission.patronId,
      assignedTo: mission.assignedTo,
      status: mission.status,
    });

    if (!canView) {
      return NextResponse.json({ error: "Sem permissao para visualizar esta missao." }, { status: 403 });
    }

    if (!isAdmin && !isPatronOwner && !isAssignedAdventurer && isPublicMissionStatus(mission.status)) {
      return NextResponse.json({
        mission: {
          ...mission,
          submissions: [],
          reviews: [],
          dispute: null,
        },
      });
    }

    const detailed = await prisma.mission.findUnique({
      where: { id: params.id },
      include: {
        patron: { select: { id: true, name: true, nick: true } },
        assignedUser: { select: { id: true, name: true, nick: true } },
        submissions: {
          where: isAssignedAdventurer && !isPatronOwner && !isAdmin ? { adventurerId: session.user.id } : undefined,
          orderBy: { submittedAt: "desc" },
          include: { revisions: { orderBy: { version: "desc" } } },
        },
        reviews: { orderBy: { createdAt: "desc" } },
        dispute: true,
        progressRecords: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({ mission: detailed });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao carregar missao." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole([Role.PATRON, Role.ADMIN]);
    const rate = await checkRateLimit(
      getClientKey(req, `mission-patch:${params.id}:${session.user.id}`),
      60,
      10 * 60 * 1000,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }
    const body = await req.json();

    if (!Object.values(MissionStatus).includes(body.status)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const current = await prisma.mission.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json({ error: "Missao nao encontrada." }, { status: 404 });
    }
    if (session.user.role === Role.PATRON && current.patronId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }

    const mission = await transitionMissionStatus({
      missionId: params.id,
      toStatus: body.status,
      actorRole: session.user.role as Role,
      actorId: session.user.id,
      force: session.user.role === Role.ADMIN,
    });

    return NextResponse.json({ mission });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    if (error instanceof MissionTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao atualizar missao." }, { status: 500 });
  }
}
