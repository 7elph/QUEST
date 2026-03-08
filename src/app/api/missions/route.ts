import { NextResponse } from "next/server";
import { BudgetRange, DeliverableFormat, EscrowStatus, MissionCategory, MissionStatus, RankName, RewardType, Role, ScreeningDecision } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildNarrative } from "@/lib/mission";
import { sanitizeArray, sanitizeText } from "@/lib/sanitize";
import { requireRole, requireSession } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";
import { captureServerError } from "@/lib/observability";
import { OllamaError } from "@/lib/ollama";
import { runMissionScreening, shouldRequireMissionApproval } from "@/lib/mission-screening";
import { getResolvedLlmRuntimeConfig } from "@/lib/llm-runtime-config";
import { PIRACICABA_NEIGHBORHOODS } from "@/lib/mission-catalog";
import { generateRpgNarrative } from "@/lib/rpg-narrative";
import { buildMissionListAccessFilter } from "@/lib/mission-visibility";

const createMissionSchema = z.object({
  title: z.string().min(4).max(120),
  category: z.nativeEnum(MissionCategory),
  missionType: z.string().min(3).max(120),
  scope: z.string().min(8).max(1000),
  desiredFormat: z.string().min(2).max(60),
  victoryConditions: z.array(z.string().min(2).max(160)).min(3).max(7),
  maxRevisions: z.number().int().min(1).max(3).default(1),
  deliverableFormat: z.nativeEnum(DeliverableFormat),
  deadlineAt: z.string(),
  budgetRange: z.nativeEnum(BudgetRange),
  rewardType: z.nativeEnum(RewardType),
  minRank: z.nativeEnum(RankName).default(RankName.E),
  sponsored: z.boolean(),
  city: z.string().trim().min(2).max(80).default("Piracicaba"),
  state: z.string().trim().min(2).max(4).default("SP"),
  neighborhood: z.enum(PIRACICABA_NEIGHBORHOODS).default("Centro"),
  templateId: z.string().optional(),
});

function getDeadlineFilter(value: string | null) {
  if (!value) return undefined;
  const now = Date.now();
  if (value === "24h") return { lte: new Date(now + 24 * 60 * 60 * 1000) };
  if (value === "48h") return { lte: new Date(now + 48 * 60 * 60 * 1000) };
  if (value === "72h") return { lte: new Date(now + 72 * 60 * 60 * 1000) };
  if (value === "week") return { lte: new Date(now + 7 * 24 * 60 * 60 * 1000) };
  return undefined;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category") as MissionCategory | null;
    const status = searchParams.get("status") as MissionStatus | null;
    const minRank = searchParams.get("minRank") as RankName | null;
    const neighborhood = searchParams.get("neighborhood");
    const deadlineFilter = getDeadlineFilter(searchParams.get("deadline"));
    const query = searchParams.get("q");

    const accessFilter: Prisma.MissionWhereInput = buildMissionListAccessFilter(session.user.role as Role, session.user.id);

    const missions = await prisma.mission.findMany({
      where: {
        AND: [
          accessFilter,
          {
        ...(category && { category }),
        ...(status && { status }),
        ...(minRank && { minRank }),
        ...(neighborhood ? { neighborhood } : {}),
        ...(deadlineFilter && { deadlineAt: deadlineFilter }),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { narrative: { contains: query, mode: "insensitive" } },
                { rpgTitle: { contains: query, mode: "insensitive" } },
                { rpgNarrative: { contains: query, mode: "insensitive" } },
                { scope: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        patron: { select: { id: true, nick: true, name: true } },
        assignedUser: { select: { id: true, nick: true, name: true } },
        submissions: { select: { id: true } },
        template: { select: { id: true, name: true } },
      },
      take: 60,
    });

    return NextResponse.json({ missions });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao listar missoes." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole([Role.PATRON]);
    const requireApproval = shouldRequireMissionApproval();
    const body = await req.json();
    const parsed = createMissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const title = sanitizeText(parsed.data.title);
    const missionType = sanitizeText(parsed.data.missionType);
    const scope = sanitizeText(parsed.data.scope);
    const desiredFormat = sanitizeText(parsed.data.desiredFormat);
    const victoryConditions = sanitizeArray(parsed.data.victoryConditions);
    const narrative = buildNarrative({ title, category: parsed.data.category, scope, victoryConditions });

    const alphaMode = (process.env.ALPHA_MODE ?? "false").toLowerCase() === "true";
    const city = alphaMode ? "Piracicaba" : sanitizeText(parsed.data.city) || "Piracicaba";
    const state = alphaMode ? "SP" : sanitizeText(parsed.data.state).toUpperCase() || "SP";
    const neighborhood = parsed.data.neighborhood;
    const rpg = await generateRpgNarrative({
      title,
      category: parsed.data.category,
      missionType,
      scope,
      victoryConditions,
      city,
      state,
      neighborhood,
    });

    const mission = await prisma.mission.create({
      data: {
        patronId: session.user.id,
        title,
        category: parsed.data.category,
        missionType,
        scope,
        desiredFormat,
        narrative,
        rpgTitle: rpg.rpgTitle,
        rpgNarrative: rpg.rpgNarrative,
        rpgRewardFlavor: rpg.rpgRewardFlavor,
        victoryConditions,
        maxRevisions: parsed.data.maxRevisions,
        deliverableFormat: parsed.data.deliverableFormat,
        deadlineAt: new Date(parsed.data.deadlineAt),
        city,
        state,
        neighborhood,
        budgetRange: parsed.data.budgetRange,
        rewardType: parsed.data.rewardType,
        minRank: parsed.data.minRank,
        templateId: parsed.data.templateId,
        sponsored: parsed.data.sponsored,
        escrowStatus: parsed.data.sponsored ? EscrowStatus.PENDING : EscrowStatus.NONE,
        status: requireApproval ? MissionStatus.DRAFT : MissionStatus.OPEN,
      },
    });

    if (requireApproval) {
      const runtime = await getResolvedLlmRuntimeConfig();
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
        summary: "Triagem pendente. Revisar manualmente.",
        flags: [],
        raw: { reason: "screening_not_executed" },
      };

      try {
        const screening = await runMissionScreening({
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
      } catch (screeningError) {
        const fallbackDecision = screeningError instanceof OllamaError ? ScreeningDecision.ERROR : ScreeningDecision.REVIEW;
        screeningRecord = {
          model: runtime.models.mission,
          decision: fallbackDecision,
          confidence: 0.2,
          summary: "Falha na triagem LLM. Revisar manualmente.",
          flags: ["TRIAGEM_LLM_FALHOU"],
          raw: { error: screeningError instanceof Error ? screeningError.message : "unknown_error" },
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
        actorId: session.user.id,
        action: "MISSION_LLM_SCREENED",
        targetType: "Mission",
        targetId: mission.id,
        metadata: {
          decision: screeningRecord.decision,
          confidence: screeningRecord.confidence,
          model: screeningRecord.model,
          flags: screeningRecord.flags,
          rpgNarrativeSource: rpg.source,
        },
      });

      const opsAdmins = await prisma.user.findMany({
        where: {
          role: Role.ADMIN,
          OR: [{ adminScope: "OPS" }, { adminScope: "MODERATOR" }, { adminScope: "SUPER_ADMIN" }],
        },
        select: { id: true },
      });

      await Promise.all(
        opsAdmins.map((admin) =>
          pushNotification({
            userId: admin.id,
            type: "MISSION",
            title: "Missao aguardando aprovacao",
            message: `Missao ${mission.title} entrou na fila com triagem ${screeningRecord.decision}.`,
            metadata: {
              missionId: mission.id,
              screeningDecision: screeningRecord.decision,
              screeningConfidence: screeningRecord.confidence,
            },
          }),
        ),
      );
    }

    await prisma.missionDraft.deleteMany({ where: { patronId: session.user.id } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "MISSION_CREATED",
      targetType: "Mission",
      targetId: mission.id,
      metadata: {
        category: mission.category,
        missionType: mission.missionType,
        city: mission.city,
        neighborhood: mission.neighborhood,
        rpgNarrativeSource: rpg.source,
      },
    });

    if (mission.sponsored) {
      const financeAdmins = await prisma.user.findMany({
        where: {
          role: Role.ADMIN,
          OR: [{ adminScope: "FINANCE" }, { adminScope: "SUPER_ADMIN" }],
        },
        select: { id: true },
      });

      await Promise.all(
        financeAdmins.map((admin) =>
          pushNotification({
            userId: admin.id,
            type: "ESCROW",
            title: "Nova missao patrocinada",
            message: `Missao ${mission.title} criada com escrow pendente.`,
            metadata: { missionId: mission.id },
          }),
        ),
      );
    }

    return NextResponse.json(
      {
        mission,
        workflow: requireApproval ? "PENDING_APPROVAL" : "DIRECT_PUBLISH",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao criar missao." }, { status: 500 });
  }
}
