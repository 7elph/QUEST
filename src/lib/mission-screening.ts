import { z } from "zod";
import { ollamaGenerate } from "@/lib/ollama";
import { parseFirstJsonObject } from "@/lib/llm-json";
import { getResolvedLlmRuntimeConfig } from "@/lib/llm-runtime-config";

const screeningSchema = z.object({
  decision: z.enum(["PASS", "REVIEW", "BLOCK"]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(8).max(1200),
  flags: z.array(z.string().min(1).max(200)).max(8),
});

export type MissionScreeningResult = z.infer<typeof screeningSchema>;

export function getMissionApprovalMode() {
  return (process.env.MISSION_APPROVAL_MODE ?? "direct").toLowerCase();
}

export function shouldRequireMissionApproval() {
  return getMissionApprovalMode() === "llm_review";
}

function buildPrompt(input: {
  title: string;
  category: string;
  missionType: string;
  scope: string;
  victoryConditions: string[];
  deadlineAt: string;
  city: string;
  state: string;
  neighborhood: string;
  sponsored: boolean;
  minRank: string;
}) {
  return [
    "Voce analisa qualidade de solicitacoes de missoes para operacao QUEST.",
    "Objetivo: classificar risco de ambiguidade, risco de fraude e clareza operacional.",
    "Responda SOMENTE JSON valido no formato:",
    JSON.stringify(
      {
        decision: "PASS|REVIEW|BLOCK",
        confidence: 0.0,
        summary: "string",
        flags: ["string"],
      },
      null,
      2,
    ),
    "Regras de decisao:",
    "- PASS: escopo claro, checklist objetivo, prazo viavel.",
    "- REVIEW: pontos ambiguos, mas aproveitavel com ajuste.",
    "- BLOCK: pedido inconsistente, risco alto ou faltando informacao critica.",
    "Entrada:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

export async function runMissionScreening(input: {
  model?: string;
  title: string;
  category: string;
  missionType: string;
  scope: string;
  victoryConditions: string[];
  deadlineAt: string;
  city: string;
  state: string;
  neighborhood: string;
  sponsored: boolean;
  minRank: string;
}) {
  const runtime = await getResolvedLlmRuntimeConfig();
  const timeoutMs = runtime.timeoutsMs.mission;
  const prompt = buildPrompt(input);
  const response = await ollamaGenerate({
    model: input.model ?? runtime.models.mission,
    prompt,
    format: "json",
    temperature: 0.1,
    timeoutMs,
    requestTag: "MISSION_SCREENING",
  });

  const parsedJson = parseFirstJsonObject(response.text);
  if (!parsedJson) {
    throw new Error("MISSION_SCREENING_PARSE_FAILED");
  }

  const parsed = screeningSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("MISSION_SCREENING_PARSE_FAILED");
  }

  return {
    screening: parsed.data,
    model: response.model,
    raw: response.text,
  };
}
