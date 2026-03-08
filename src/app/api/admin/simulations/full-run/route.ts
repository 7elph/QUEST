import { NextResponse } from "next/server";
import {
  AdminScope,
  Availability,
  DisputeStatus,
  EscrowStatus,
  MissionStatus,
  RankName,
  ReviewDecision,
  Role,
  RewardType,
  ScreeningDecision,
  SubmissionStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { buildNarrative } from "@/lib/mission";
import { claimOpenMissionForAdventurer, transitionMissionStatus } from "@/lib/mission-status";
import { generateRpgNarrative } from "@/lib/rpg-narrative";
import { getMissionRewardPreview } from "@/lib/mission-rewards";
import { OllamaError } from "@/lib/ollama";
import { runMissionScreening } from "@/lib/mission-screening";
import { getResolvedLlmRuntimeConfig } from "@/lib/llm-runtime-config";
import {
  generateSimulationMissionBlueprint,
  generateSimulationSubmission,
  getLlmPatronIdentity,
  getLlmSimulatorIdentity,
  type LlmSimulationScenario,
} from "@/lib/simulation-agent";

const schema = z.object({
  scenario: z
    .enum(["FULL_CYCLE", "REVISION_CYCLE", "DISPUTE_CYCLE", "APPROVAL_QUEUE", "MIXED"])
    .default("MIXED"),
  model: z.string().min(1).max(80).optional(),
});

async function ensureSimulatorUser(input: {
  email: string;
  password: string;
  name: string;
  nick: string;
  role: Role;
  bio: string;
  badges: string[];
  skills: string[];
}) {
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.upsert({
    where: { email: input.email.toLowerCase() },
    update: {
      role: input.role,
      passwordHash,
      name: input.name,
      nick: input.nick,
      status: "ACTIVE",
      city: "Piracicaba",
      state: "SP",
    },
    create: {
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      name: input.name,
      nick: input.nick,
      city: "Piracicaba",
      state: "SP",
    },
    select: { id: true, email: true, name: true, nick: true },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      bio: input.bio,
      skills: input.skills,
      badges: input.badges,
      availability: Availability.FLEXIBLE,
    },
    create: {
      userId: user.id,
      bio: input.bio,
      skills: input.skills,
      badges: input.badges,
      availability: Availability.FLEXIBLE,
    },
  });

  return user;
}

async function applyAcceptDecision(input: {
  missionId: string;
  submissionId: string;
  patronId: string;
  assignedTo: string;
  minRank: RankName;
}) {
  const rewardPreview = getMissionRewardPreview(input.missionId, input.minRank);

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        missionId: input.missionId,
        patronId: input.patronId,
        decision: ReviewDecision.ACCEPT,
        comment: "Aprovacao automatica da simulacao LLM.",
      },
    });

    await tx.submission.update({
      where: { id: input.submissionId },
      data: { status: SubmissionStatus.ACCEPTED },
    });

    await transitionMissionStatus({
      missionId: input.missionId,
      toStatus: MissionStatus.COMPLETED,
      actorRole: Role.PATRON,
      actorId: input.patronId,
      tx,
    });

    await tx.xPLog.create({
      data: {
        userId: input.assignedTo,
        missionId: input.missionId,
        xpChange: rewardPreview.enchantiun,
        reason: `Missao aprovada (+${rewardPreview.enchantiun} Enchantiun)`,
      },
    });

    if (rewardPreview.drop) {
      const profile = await tx.profile.findUnique({
        where: { userId: input.assignedTo },
        select: { id: true },
      });
      if (profile) {
        await tx.profile.update({
          where: { id: profile.id },
          data: {
            badges: {
              push: rewardPreview.drop.badge,
            },
          },
        });
      }
    }
  });
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminScope([AdminScope.OPS]);
    const rate = await checkRateLimit(getClientKey(req, `admin-simulation-full-run:${session.user.id}`), 20, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }
    const runtime = await getResolvedLlmRuntimeConfig();

    const patronIdentity = getLlmPatronIdentity();
    const adventurerIdentity = getLlmSimulatorIdentity();

    const [patron, adventurer] = await Promise.all([
      ensureSimulatorUser({
        ...patronIdentity,
        role: Role.PATRON,
        bio: "Agente Patrono para testes ponta a ponta da plataforma QUEST.",
        badges: ["SIMULADOR_LLM", "SIM_PATRON"],
        skills: ["Criacao de missoes", "Revisao de entregas", "Gestao de fluxo"],
      }),
      ensureSimulatorUser({
        ...adventurerIdentity,
        role: Role.ADVENTURER,
        bio: "Agente Aventureiro para testes ponta a ponta da plataforma QUEST.",
        badges: ["SIMULADOR_LLM", "SIM_AVENTUREIRO"],
        skills: ["Execucao de checklist", "Submissao de provas", "Revisao de entregas"],
      }),
    ]);

    const blueprint = await generateSimulationMissionBlueprint({
      scenario: parsed.data.scenario as LlmSimulationScenario,
      model: parsed.data.model,
    });

    const deadlineAt = new Date(Date.now() + blueprint.deadlineHours * 60 * 60 * 1000);
    const narrative = buildNarrative({
      title: blueprint.title,
      category: blueprint.category,
      scope: blueprint.scope,
      victoryConditions: blueprint.victoryConditions,
    });
    const rpg = await generateRpgNarrative({
      title: blueprint.title,
      category: blueprint.category,
      missionType: blueprint.missionType,
      scope: blueprint.scope,
      victoryConditions: blueprint.victoryConditions,
      city: "Piracicaba",
      state: "SP",
      neighborhood: blueprint.neighborhood,
    });

    const startsAsDraft = blueprint.scenario === "APPROVAL_QUEUE";
    const mission = await prisma.mission.create({
      data: {
        patronId: patron.id,
        title: blueprint.title,
        category: blueprint.category,
        missionType: blueprint.missionType,
        scope: blueprint.scope,
        desiredFormat: "Link",
        narrative,
        rpgTitle: rpg.rpgTitle,
        rpgNarrative: rpg.rpgNarrative,
        rpgRewardFlavor: rpg.rpgRewardFlavor,
        victoryConditions: blueprint.victoryConditions,
        maxRevisions: 1,
        deliverableFormat: blueprint.deliverableFormat,
        deadlineAt,
        city: "Piracicaba",
        state: "SP",
        neighborhood: blueprint.neighborhood,
        minRank: blueprint.minRank,
        budgetRange: blueprint.budgetRange,
        rewardType: blueprint.sponsored ? RewardType.SPONSORED_CASH : blueprint.rewardType,
        sponsored: blueprint.sponsored,
        escrowStatus: blueprint.sponsored ? EscrowStatus.PENDING : EscrowStatus.NONE,
        status: startsAsDraft ? MissionStatus.DRAFT : MissionStatus.OPEN,
      },
    });

    await writeAuditLog({
      actorId: patron.id,
      action: "MISSION_CREATED",
      targetType: "Mission",
      targetId: mission.id,
      metadata: {
        category: mission.category,
        missionType: mission.missionType,
        simulationSource: blueprint.source,
      },
    });

    if (startsAsDraft) {
      let screeningRecord: {
        model: string;
        decision: ScreeningDecision;
        confidence: number;
        summary: string;
        flags: string[];
        raw: Prisma.InputJsonValue;
      } = {
        model: runtime.models.mission,
        decision: ScreeningDecision.REVIEW,
        confidence: 0.5,
        summary: "Triagem pendente para simulacao.",
        flags: [],
        raw: { reason: "screening_not_executed" },
      };

      try {
        const screening = await runMissionScreening({
          model: parsed.data.model,
          title: mission.title,
          category: mission.category,
          missionType: mission.missionType,
          scope: mission.scope,
          victoryConditions: mission.victoryConditions,
          deadlineAt: mission.deadlineAt.toISOString(),
          city: mission.city,
          state: mission.state,
          neighborhood: mission.neighborhood,
          sponsored: mission.sponsored,
          minRank: mission.minRank,
        });
        screeningRecord = {
          model: screening.model,
          decision: screening.screening.decision,
          confidence: screening.screening.confidence,
          summary: screening.screening.summary,
          flags: screening.screening.flags,
          raw: { raw: screening.raw },
        };
      } catch (error) {
        const fallbackDecision =
          error instanceof OllamaError ? ScreeningDecision.ERROR : ScreeningDecision.REVIEW;
        screeningRecord = {
          model: runtime.models.mission,
          decision: fallbackDecision,
          confidence: 0.2,
          summary: "Falha na triagem LLM da simulacao. Revisar manualmente.",
          flags: ["TRIAGEM_LLM_FALHOU"],
          raw: { error: error instanceof Error ? error.message : "unknown_error" },
        };
      }

      await prisma.missionScreening.upsert({
        where: { missionId: mission.id },
        update: {
          model: screeningRecord.model,
          decision: screeningRecord.decision,
          confidence: screeningRecord.confidence,
          summary: screeningRecord.summary,
          flags: screeningRecord.flags,
          raw: screeningRecord.raw,
        },
        create: {
          missionId: mission.id,
          model: screeningRecord.model,
          decision: screeningRecord.decision,
          confidence: screeningRecord.confidence,
          summary: screeningRecord.summary,
          flags: screeningRecord.flags,
          raw: screeningRecord.raw,
        },
      });

      await writeAuditLog({
        actorId: patron.id,
        action: "MISSION_LLM_SCREENED",
        targetType: "Mission",
        targetId: mission.id,
        metadata: {
          decision: screeningRecord.decision,
          confidence: screeningRecord.confidence,
          model: screeningRecord.model,
          flags: screeningRecord.flags,
          simulation: true,
        },
      });

      await writeAuditLog({
        actorId: session.user.id,
        action: "LLM_SIMULATION_FULL_RUN",
        targetType: "Mission",
        targetId: mission.id,
        metadata: {
          scenario: blueprint.scenario,
          outcome: "AWAITING_ADMIN_APPROVAL",
          missionStatus: MissionStatus.DRAFT,
          source: blueprint.source,
          model: blueprint.model,
          reason: blueprint.reason,
          patronEmail: patron.email,
          adventurerEmail: adventurer.email,
        },
      });

      return NextResponse.json({
        success: true,
        status: "AWAITING_ADMIN_APPROVAL",
        scenario: blueprint.scenario,
        missionId: mission.id,
        missionStatus: MissionStatus.DRAFT,
        patronEmail: patron.email,
        adventurerEmail: adventurer.email,
        source: blueprint.source,
        model: blueprint.model,
        reason: blueprint.reason,
        nextAction: "Aprovar ou rejeitar missao na aba Missoes (Admin).",
      });
    }

    const claimed = await claimOpenMissionForAdventurer({
      missionId: mission.id,
      adventurerId: adventurer.id,
    });

    if (!claimed) {
      await writeAuditLog({
        actorId: session.user.id,
        action: "LLM_SIMULATION_FULL_RUN",
        targetType: "Mission",
        targetId: mission.id,
        metadata: {
          scenario: blueprint.scenario,
          outcome: "MISSION_NOT_CLAIMED",
          missionStatus: mission.status,
          source: blueprint.source,
          model: blueprint.model,
          reason: blueprint.reason,
        },
      });

      return NextResponse.json({
        success: false,
        status: "MISSION_NOT_CLAIMED",
        message: "Missao criada, mas nao foi possivel atribuir ao aventureiro simulador.",
        missionId: mission.id,
      });
    }

    await writeAuditLog({
      actorId: adventurer.id,
      action: "MISSION_ACCEPTED",
      targetType: "Mission",
      targetId: claimed.id,
      metadata: { simulation: true },
    });

    const checklistState = new Array(claimed.victoryConditions.length).fill(true);
    const completionPct = claimed.victoryConditions.length > 0 ? 100 : 0;
    const progress = await prisma.missionProgress.upsert({
      where: {
        missionId_adventurerId: {
          missionId: claimed.id,
          adventurerId: adventurer.id,
        },
      },
      update: {
        checklistState,
        completionPct,
      },
      create: {
        missionId: claimed.id,
        adventurerId: adventurer.id,
        checklistState,
        completionPct,
      },
    });

    await writeAuditLog({
      actorId: adventurer.id,
      action: "MISSION_CHECKLIST_UPDATED",
      targetType: "MissionProgress",
      targetId: progress.id,
      metadata: {
        missionId: claimed.id,
        completionPct,
        simulation: true,
      },
    });

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
          adventurerId: adventurer.id,
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
        actorId: adventurer.id,
        tx,
      });

      return created;
    });

    await writeAuditLog({
      actorId: adventurer.id,
      action: "SUBMISSION_CREATED",
      targetType: "Submission",
      targetId: submission.id,
      metadata: {
        missionId: claimed.id,
        revisionCount: submission.revisionCount,
        simulation: true,
      },
    });

    let finalMissionStatus: MissionStatus = MissionStatus.IN_REVIEW;
    let disputeId: string | null = null;

    if (blueprint.scenario === "FULL_CYCLE") {
      await applyAcceptDecision({
        missionId: claimed.id,
        submissionId: submission.id,
        patronId: patron.id,
        assignedTo: adventurer.id,
        minRank: claimed.minRank,
      });
      finalMissionStatus = MissionStatus.COMPLETED;
    } else if (blueprint.scenario === "REVISION_CYCLE") {
      await prisma.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            missionId: claimed.id,
            patronId: patron.id,
            decision: ReviewDecision.REVISION,
            comment: "Simulacao: ajustar formato da prova.",
          },
        });
        await tx.submission.update({
          where: { id: submission.id },
          data: { status: SubmissionStatus.REVISION_REQUESTED },
        });
        await transitionMissionStatus({
          missionId: claimed.id,
          toStatus: MissionStatus.REVISION_REQUESTED,
          actorRole: Role.PATRON,
          actorId: patron.id,
          tx,
        });
      });

      const generatedRevision = await generateSimulationSubmission({
        title: `${claimed.title} (revisao)`,
        category: claimed.category,
        scope: claimed.scope,
        victoryConditions: claimed.victoryConditions,
        city: claimed.city,
        state: claimed.state,
        neighborhood: claimed.neighborhood,
      });

      await prisma.$transaction(async (tx) => {
        await tx.submission.update({
          where: { id: submission.id },
          data: {
            proofLinks: generatedRevision.proofLinks,
            proofFiles: [],
            notes: generatedRevision.notes,
            status: SubmissionStatus.SUBMITTED,
            revisionCount: 1,
            submittedAt: new Date(),
          },
        });
        await tx.submissionRevision.create({
          data: {
            submissionId: submission.id,
            version: 2,
            proofLinks: generatedRevision.proofLinks,
            proofFiles: [],
            notes: generatedRevision.notes,
          },
        });
        await transitionMissionStatus({
          missionId: claimed.id,
          toStatus: MissionStatus.IN_REVIEW,
          actorRole: Role.ADVENTURER,
          actorId: adventurer.id,
          tx,
        });
      });

      await applyAcceptDecision({
        missionId: claimed.id,
        submissionId: submission.id,
        patronId: patron.id,
        assignedTo: adventurer.id,
        minRank: claimed.minRank,
      });
      finalMissionStatus = MissionStatus.COMPLETED;
    } else if (blueprint.scenario === "DISPUTE_CYCLE") {
      const dispute = await prisma.dispute.upsert({
        where: { missionId: claimed.id },
        update: {
          openedBy: patron.id,
          reason: "Simulacao: divergencia de comprovacao de entrega.",
          evidenceNotes: "Checklist marcado, mas prova pede revisao manual.",
          status: DisputeStatus.OPEN,
        },
        create: {
          missionId: claimed.id,
          openedBy: patron.id,
          reason: "Simulacao: divergencia de comprovacao de entrega.",
          evidenceNotes: "Checklist marcado, mas prova pede revisao manual.",
          status: DisputeStatus.OPEN,
        },
      });

      await transitionMissionStatus({
        missionId: claimed.id,
        toStatus: MissionStatus.DISPUTED,
        actorRole: Role.PATRON,
        actorId: patron.id,
      });

      await writeAuditLog({
        actorId: patron.id,
        action: "DISPUTE_OPENED",
        targetType: "Dispute",
        targetId: dispute.id,
        metadata: {
          missionId: claimed.id,
          simulation: true,
        },
      });
      disputeId = dispute.id;
      finalMissionStatus = MissionStatus.DISPUTED;
    }

    const nextAction =
      finalMissionStatus === MissionStatus.DISPUTED
        ? "Resolver disputa na aba Disputas (Admin)."
        : "Acompanhar resultado na aba Missoes/LLM.";

    await writeAuditLog({
      actorId: session.user.id,
      action: "LLM_SIMULATION_FULL_RUN",
      targetType: "Mission",
      targetId: claimed.id,
      metadata: {
        scenario: blueprint.scenario,
        outcome: finalMissionStatus,
        missionStatus: finalMissionStatus,
        submissionId: submission.id,
        disputeId,
        source: generated.source,
        reason: generated.reason,
        model: generated.model,
        missionBlueprintSource: blueprint.source,
        missionBlueprintReason: blueprint.reason,
        missionBlueprintModel: blueprint.model,
        patronEmail: patron.email,
        adventurerEmail: adventurer.email,
      },
    });

    await Promise.all([
      pushNotification({
        userId: session.user.id,
        type: "SYSTEM",
        title: "Jornada LLM finalizada",
        message: `Cenario ${blueprint.scenario} executado. Missao ${claimed.title} em ${finalMissionStatus}.`,
        metadata: {
          missionId: claimed.id,
          submissionId: submission.id,
          disputeId,
          scenario: blueprint.scenario,
        },
      }),
      pushNotification({
        userId: patron.id,
        type: "MISSION",
        title: "Patrono simulador executou jornada",
        message: `Cenario ${blueprint.scenario} processado na missao ${claimed.title}.`,
        metadata: { missionId: claimed.id, submissionId: submission.id, disputeId },
      }),
      pushNotification({
        userId: adventurer.id,
        type: "MISSION",
        title: "Aventureiro simulador executou jornada",
        message: `Cenario ${blueprint.scenario} processado na missao ${claimed.title}.`,
        metadata: { missionId: claimed.id, submissionId: submission.id, disputeId },
      }),
    ]);

    return NextResponse.json({
      success: true,
      status: finalMissionStatus,
      scenario: blueprint.scenario,
      missionId: claimed.id,
      submissionId: submission.id,
      disputeId,
      patronEmail: patron.email,
      adventurerEmail: adventurer.email,
      source: generated.source,
      model: generated.model,
      reason: generated.reason,
      nextAction,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao executar jornada completa da LLM." }, { status: 500 });
  }
}
