import { BudgetRange, DeliverableFormat, MissionCategory, RankName, RewardType } from "@prisma/client";
import { z } from "zod";
import { OllamaError, ollamaGenerate } from "@/lib/ollama";
import { parseFirstJsonObject } from "@/lib/llm-json";
import { alphaCategoryMeta, getCategoryDisplay, missionTypeCatalog, PIRACICABA_NEIGHBORHOODS } from "@/lib/mission-catalog";
import { sanitizeArray, sanitizeText } from "@/lib/sanitize";
import { getResolvedLlmRuntimeConfig } from "@/lib/llm-runtime-config";

const simulationSchema = z.object({
  notes: z.string().min(8).max(1200),
  proofLinks: z.array(z.string().url()).max(3).default([]),
});

export type LlmSimulationScenario =
  | "FULL_CYCLE"
  | "REVISION_CYCLE"
  | "DISPUTE_CYCLE"
  | "APPROVAL_QUEUE"
  | "MIXED";

const missionBlueprintSchema = z.object({
  title: z.string().min(6).max(120),
  category: z.nativeEnum(MissionCategory),
  missionType: z.string().min(3).max(120),
  scope: z.string().min(20).max(1000),
  victoryConditions: z.array(z.string().min(3).max(160)).min(3).max(7),
  deliverableFormat: z.nativeEnum(DeliverableFormat),
  budgetRange: z.nativeEnum(BudgetRange),
  rewardType: z.nativeEnum(RewardType),
  minRank: z.nativeEnum(RankName),
  sponsored: z.boolean(),
  deadlineHours: z.number().int().min(24).max(168),
  neighborhood: z.enum(PIRACICABA_NEIGHBORHOODS),
});

const scenarioChoices: LlmSimulationScenario[] = [
  "FULL_CYCLE",
  "REVISION_CYCLE",
  "DISPUTE_CYCLE",
  "APPROVAL_QUEUE",
];

function pickRandom<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function resolveScenario(scenario: LlmSimulationScenario) {
  if (scenario === "MIXED") {
    return pickRandom(scenarioChoices);
  }
  return scenario;
}

export function getLlmSimulatorIdentity() {
  return {
    email: (process.env.LLM_SIM_EMAIL ?? "llm.simulador@quest.local").toLowerCase(),
    password: process.env.LLM_SIM_PASSWORD ?? "Quest1234!",
    name: process.env.LLM_SIM_NAME ?? "Simulador LLM",
    nick: process.env.LLM_SIM_NICK ?? "OraculoLLM",
  };
}

export function getLlmPatronIdentity() {
  return {
    email: (process.env.LLM_SIM_PATRON_EMAIL ?? "llm.patrono@quest.local").toLowerCase(),
    password: process.env.LLM_SIM_PATRON_PASSWORD ?? "Quest1234!",
    name: process.env.LLM_SIM_PATRON_NAME ?? "Patrono LLM",
    nick: process.env.LLM_SIM_PATRON_NICK ?? "PatronoIA",
  };
}

function buildMissionBlueprintPrompt(input: { scenario: LlmSimulationScenario }) {
  return [
    "Voce e um simulador de testes do app QUEST.",
    "Gere uma missao digital realista de Piracicaba/SP para teste de sistema.",
    "A resposta deve ser SOMENTE JSON.",
    "Nao use empresas reais; use comercio local, clinica, restaurante, loja ou prestador de servico.",
    "Respeite os enums e regras:",
    `- category: ${Object.keys(alphaCategoryMeta).join("|")}`,
    "- deliverableFormat: LINK|FILE|BOTH",
    "- budgetRange: LOW|MEDIUM|HIGH",
    "- rewardType: TRAINING_XP|SPONSORED_CASH|MIXED",
    "- minRank: E|D|C|B|A|S",
    "- deadlineHours: 24, 48, 72 ou 168",
    `- neighborhood: ${PIRACICABA_NEIGHBORHOODS.join("|")}`,
    `- scenario de teste: ${input.scenario}`,
    "Formato JSON obrigatorio:",
    JSON.stringify(
      {
        title: "string",
        category: "ATENDIMENTO_SUPORTE",
        missionType: "string",
        scope: "string",
        victoryConditions: ["string", "string", "string"],
        deliverableFormat: "BOTH",
        budgetRange: "MEDIUM",
        rewardType: "TRAINING_XP",
        minRank: "D",
        sponsored: false,
        deadlineHours: 48,
        neighborhood: "Centro",
      },
      null,
      2,
    ),
  ].join("\n");
}

function fallbackMissionBlueprint(scenario: LlmSimulationScenario) {
  const resolved = resolveScenario(scenario);
  const category = pickRandom(Object.keys(alphaCategoryMeta) as MissionCategory[]);
  const preset = pickRandom(missionTypeCatalog[category]);
  const neighborhood =
    resolved === "DISPUTE_CYCLE" ? "CECAP" : pickRandom(PIRACICABA_NEIGHBORHOODS);

  const deadlineMap: Record<LlmSimulationScenario, number> = {
    FULL_CYCLE: 48,
    REVISION_CYCLE: 72,
    DISPUTE_CYCLE: 48,
    APPROVAL_QUEUE: 24,
    MIXED: 48,
  };

  const sponsored = resolved === "APPROVAL_QUEUE" ? true : Math.random() < 0.35;
  const rewardType =
    sponsored ? RewardType.SPONSORED_CASH : RewardType.TRAINING_XP;
  const minRank = resolved === "DISPUTE_CYCLE" ? RankName.C : RankName.D;

  return {
    scenario: resolved,
    title: `Teste ${preset.label} ${neighborhood}`,
    category,
    missionType: preset.label,
    scope: preset.scopeTemplate,
    victoryConditions: preset.checklist.slice(0, Math.max(3, Math.min(6, preset.checklist.length))),
    deliverableFormat: preset.deliverableFormat,
    budgetRange:
      preset.budgetRange === BudgetRange.PREMIUM ? BudgetRange.HIGH : preset.budgetRange,
    rewardType,
    minRank,
    sponsored,
    deadlineHours: deadlineMap[resolved],
    neighborhood,
    source: "FALLBACK" as const,
    model: "aguardando",
    reason: "MISSION_BLUEPRINT_FALLBACK",
  };
}

export async function generateSimulationMissionBlueprint(input: {
  scenario: LlmSimulationScenario;
  model?: string;
}) {
  const fallback = fallbackMissionBlueprint(input.scenario);
  const runtime = await getResolvedLlmRuntimeConfig();

  if (!runtime.enabled) {
    return { ...fallback, reason: "OLLAMA_DISABLED" as const };
  }

  try {
    const response = await ollamaGenerate({
      model: input.model ?? runtime.models.simulation,
      prompt: buildMissionBlueprintPrompt({ scenario: fallback.scenario }),
      format: "json",
      temperature: 0.2,
      timeoutMs: runtime.timeoutsMs.simulation,
      requestTag: "SIMULATION_MISSION_BLUEPRINT",
    });

    const parsedJson = parseFirstJsonObject(response.text);
    if (!parsedJson) {
      return { ...fallback, reason: "MISSION_JSON_NOT_FOUND" as const };
    }

    const parsed = missionBlueprintSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { ...fallback, reason: "MISSION_SCHEMA_INVALID" as const };
    }
    const victoryConditions = sanitizeArray(parsed.data.victoryConditions).slice(0, 7);
    if (victoryConditions.length < 3) {
      return { ...fallback, reason: "MISSION_CHECKLIST_INVALID" as const };
    }

    return {
      scenario: fallback.scenario,
      title: sanitizeText(parsed.data.title),
      category: parsed.data.category,
      missionType: sanitizeText(parsed.data.missionType),
      scope: sanitizeText(parsed.data.scope),
      victoryConditions,
      deliverableFormat: parsed.data.deliverableFormat,
      budgetRange: parsed.data.budgetRange === BudgetRange.PREMIUM ? BudgetRange.HIGH : parsed.data.budgetRange,
      rewardType: parsed.data.sponsored ? RewardType.SPONSORED_CASH : parsed.data.rewardType,
      minRank: parsed.data.minRank,
      sponsored: parsed.data.sponsored,
      deadlineHours: parsed.data.deadlineHours,
      neighborhood: parsed.data.neighborhood,
      source: "LLM" as const,
      model: response.model,
      reason: "OK" as const,
    };
  } catch (error) {
    if (error instanceof OllamaError) {
      return { ...fallback, reason: error.code };
    }
    return { ...fallback, reason: "MISSION_UNKNOWN_ERROR" as const };
  }
}

function buildPrompt(input: {
  title: string;
  category: MissionCategory;
  scope: string;
  victoryConditions: string[];
  city: string;
  state: string;
  neighborhood: string;
}) {
  return [
    "Voce e um agente simulador de uso do app QUEST.",
    "Gere uma submissao curta e plausivel para teste de produto.",
    "Nao invente requisitos fora do checklist.",
    "Responda SOMENTE JSON com chaves: notes, proofLinks.",
    "proofLinks deve conter URLs validas ou lista vazia.",
    "Contexto da missao:",
    JSON.stringify(
      {
        title: input.title,
        category: getCategoryDisplay(input.category),
        scope: input.scope,
        victoryConditions: input.victoryConditions,
        city: input.city,
        state: input.state,
        neighborhood: input.neighborhood,
      },
      null,
      2,
    ),
  ].join("\n");
}

export async function generateSimulationSubmission(input: {
  title: string;
  category: MissionCategory;
  scope: string;
  victoryConditions: string[];
  city: string;
  state: string;
  neighborhood: string;
}) {
  const fallback = {
    notes: `Aguardando simulacao detalhada para a missao "${input.title}".`,
    proofLinks: [] as string[],
    source: "AWAITING" as const,
    model: "aguardando",
    reason: "AWAITING",
  };
  const runtime = await getResolvedLlmRuntimeConfig();

  if (!runtime.enabled) {
    return { ...fallback, reason: "OLLAMA_DISABLED" as const };
  }

  try {
    const response = await ollamaGenerate({
      model: runtime.models.simulation,
      prompt: buildPrompt(input),
      format: "json",
      temperature: 0.2,
      timeoutMs: runtime.timeoutsMs.simulation,
      requestTag: "SIMULATION_SUBMISSION",
    });

    const parsedJson = parseFirstJsonObject(response.text);
    if (!parsedJson) {
      return { ...fallback, reason: "SIMULATION_JSON_NOT_FOUND" as const };
    }

    const parsed = simulationSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { ...fallback, reason: "SIMULATION_SCHEMA_INVALID" as const };
    }

    return {
      notes: sanitizeText(parsed.data.notes),
      proofLinks: sanitizeArray(parsed.data.proofLinks),
      source: "LLM" as const,
      model: response.model,
      reason: "OK" as const,
    };
  } catch (error) {
    if (error instanceof OllamaError) {
      return { ...fallback, reason: error.code };
    }
    return { ...fallback, reason: "SIMULATION_UNKNOWN_ERROR" as const };
  }
}
