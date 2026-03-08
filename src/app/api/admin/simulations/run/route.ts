import { NextResponse } from "next/server";
import { AdminScope, Availability, MissionStatus, Role, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { claimOpenMissionForAdventurer, transitionMissionStatus } from "@/lib/mission-status";
import { generateSimulationSubmission, getLlmSimulatorIdentity } from "@/lib/simulation-agent";

export async function POST(req: Request) {
  try {
    const session = await requireAdminScope([AdminScope.OPS]);
    const rate = await checkRateLimit(getClientKey(req, `admin-simulation-run:${session.user.id}`), 30, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const identity = getLlmSimulatorIdentity();
    const simulatorPasswordHash = await hashPassword(identity.password);
    const simulator = await prisma.user.upsert({
      where: { email: identity.email },
      update: {
        passwordHash: simulatorPasswordHash,
        role: Role.ADVENTURER,
        name: identity.name,
        nick: identity.nick,
        status: "ACTIVE",
      },
      create: {
        email: identity.email,
        passwordHash: simulatorPasswordHash,
        role: Role.ADVENTURER,
        name: identity.name,
        nick: identity.nick,
        city: "Piracicaba",
        state: "SP",
        profile: {
          create: {
            bio: "Agente de simulacao para testes operacionais da plataforma QUEST.",
            skills: ["Simulacao de fluxo", "Teste de experiencia", "Validacao de jornadas"],
            badges: ["SIMULADOR_LLM"],
            availability: Availability.FLEXIBLE,
          },
        },
      },
      select: { id: true, email: true, name: true, nick: true },
    });

    await prisma.profile.upsert({
      where: { userId: simulator.id },
      update: {
        bio: "Agente de simulacao para testes operacionais da plataforma QUEST.",
        skills: ["Simulacao de fluxo", "Teste de experiencia", "Validacao de jornadas"],
        badges: ["SIMULADOR_LLM"],
        availability: Availability.FLEXIBLE,
      },
      create: {
        userId: simulator.id,
        bio: "Agente de simulacao para testes operacionais da plataforma QUEST.",
        skills: ["Simulacao de fluxo", "Teste de experiencia", "Validacao de jornadas"],
        badges: ["SIMULADOR_LLM"],
        availability: Availability.FLEXIBLE,
      },
    });

    const targetMission = await prisma.mission.findFirst({
      where: {
        status: MissionStatus.OPEN,
        assignedTo: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!targetMission) {
      return NextResponse.json({
        status: "AWAITING",
        message: "Aguardando missoes abertas para simular uso.",
      });
    }

    const claimed = await claimOpenMissionForAdventurer({
      missionId: targetMission.id,
      adventurerId: simulator.id,
    });

    if (!claimed) {
      return NextResponse.json({
        status: "AWAITING",
        message: "Aguardando disponibilidade de missao para simulacao.",
      });
    }

    const generated = await generateSimulationSubmission({
      title: claimed.title,
      category: claimed.category,
      scope: claimed.scope,
      victoryConditions: claimed.victoryConditions,
      city: claimed.city,
      state: claimed.state,
      neighborhood: claimed.neighborhood,
    });

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: {
          missionId: claimed.id,
          adventurerId: simulator.id,
          proofLinks: generated.proofLinks,
          proofFiles: [],
          notes: generated.notes,
          status: SubmissionStatus.SUBMITTED,
          revisionCount: 0,
          submittedAt: new Date(),
        },
      });

      await tx.submissionRevision.create({
        data: {
          submissionId: created.id,
          version: 1,
          proofLinks: generated.proofLinks,
          proofFiles: [],
          notes: generated.notes,
        },
      });

      await transitionMissionStatus({
        missionId: claimed.id,
        toStatus: MissionStatus.IN_REVIEW,
        actorRole: Role.ADVENTURER,
        actorId: simulator.id,
        tx,
      });

      return created;
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "LLM_SIMULATION_RUN",
      targetType: "Mission",
      targetId: claimed.id,
      metadata: {
        simulatorId: simulator.id,
        submissionId: submission.id,
        source: generated.source,
        model: generated.model,
        reason: generated.reason,
      },
    });

    await Promise.all([
      pushNotification({
        userId: claimed.patronId,
        type: "REVIEW",
        title: "Simulacao enviada para revisao",
        message: `O simulador LLM enviou prova na missao ${claimed.title}.`,
        metadata: { missionId: claimed.id, simulatorId: simulator.id, source: generated.source },
      }),
      pushNotification({
        userId: session.user.id,
        type: "SYSTEM",
        title: "Simulacao de uso executada",
        message:
          generated.source === "LLM"
            ? `Missao ${claimed.title} simulada com resposta LLM (${generated.model}).`
            : `Missao ${claimed.title} simulada em fallback: Aguardando.`,
        metadata: { missionId: claimed.id, simulatorId: simulator.id, source: generated.source, reason: generated.reason },
      }),
      pushNotification({
        userId: simulator.id,
        type: "MISSION",
        title: "Simulacao registrada",
        message: `Simulacao da missao ${claimed.title} registrada para teste de fluxo.`,
        metadata: { missionId: claimed.id, submissionId: submission.id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      status: generated.source === "LLM" ? "SIMULATED" : "AWAITING",
      message:
        generated.source === "LLM"
          ? `Simulacao criada via ${generated.model} e enviada para revisao.`
          : `Simulacao criada em modo aguardando e enviada para revisao. (${generated.reason})`,
      missionId: claimed.id,
      submissionId: submission.id,
      simulatorEmail: simulator.email,
      reason: generated.reason,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao executar simulacao." }, { status: 500 });
  }
}
