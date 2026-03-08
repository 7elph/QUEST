import { z } from "zod";
import { ollamaGenerate } from "./ollama";
import { extractFirstJsonObject as extractJsonObject, parseFirstJsonObject } from "./llm-json";
import { getResolvedLlmRuntimeConfig } from "./llm-runtime-config";

const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const recommendationSchema = z.enum([
  "COMPLETE_MISSION",
  "KEEP_DISPUTE_OPEN",
  "REQUEST_REVISION",
  "REJECT_SUBMISSION",
]);

const triageSchema = z.object({
  summary: z.string().min(10).max(1200),
  inconsistencies: z.array(
    z.object({
      severity: severitySchema,
      title: z.string().min(3).max(200),
      details: z.string().min(3).max(500),
      evidence: z.array(z.string().min(1).max(220)).max(6),
    }),
  ),
  recommendation: recommendationSchema,
  confidence: z.number().min(0).max(1),
  adminChecklist: z.array(z.string().min(1).max(220)).min(3).max(8),
});

export type DisputeTriage = z.infer<typeof triageSchema>;
export type DisputeRecommendation = z.infer<typeof recommendationSchema>;

export type DisputeTriageGate = {
  finalRecommendation: DisputeRecommendation;
  wasOverridden: boolean;
  reasons: string[];
  minConfidenceForComplete: number;
  hasHighSeverity: boolean;
};

type DisputeContext = {
  dispute: {
    id: string;
    reason: string;
    evidenceNotes: string | null;
    createdAt: string;
    openedBy: string;
  };
  mission: {
    id: string;
    title: string;
    scope: string;
    status: string;
    victoryConditions: string[];
    deadlineAt: string;
    createdAt: string;
    patron: string;
    assignedTo: string | null;
  };
  submissions: Array<{
    id: string;
    by: string;
    submittedAt: string;
    status: string;
    revisionCount: number;
    notes: string | null;
    proofLinks: string[];
    proofFiles: string[];
    revisions: Array<{
      version: number;
      notes: string | null;
      proofLinks: string[];
      proofFiles: string[];
      createdAt: string;
    }>;
  }>;
  reviews: Array<{
    decision: string;
    comment: string | null;
    createdAt: string;
  }>;
};

export function extractFirstJsonObject(raw: string) {
  return extractJsonObject(raw);
}

function safeTrimList(values: string[], maxItems: number, maxLen = 180) {
  return values.slice(0, maxItems).map((item) => item.trim().slice(0, maxLen));
}

function safeTrimText(value: string, maxLen = 500) {
  return value.trim().slice(0, maxLen);
}

function safeTrimOptional(value: string | null | undefined, maxLen = 500) {
  if (!value) return null;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeContext(input: DisputeContext) {
  return {
    dispute: {
      ...input.dispute,
      reason: safeTrimText(input.dispute.reason, 380),
      evidenceNotes: safeTrimOptional(input.dispute.evidenceNotes, 700),
      openedBy: safeTrimText(input.dispute.openedBy, 120),
    },
    mission: {
      ...input.mission,
      title: safeTrimText(input.mission.title, 180),
      scope: safeTrimText(input.mission.scope, 900),
      patron: safeTrimText(input.mission.patron, 120),
      assignedTo: safeTrimOptional(input.mission.assignedTo, 120),
      victoryConditions: safeTrimList(input.mission.victoryConditions, 7),
    },
    submissions: input.submissions.slice(0, 4).map((submission) => ({
      ...submission,
      by: safeTrimText(submission.by, 120),
      notes: safeTrimOptional(submission.notes, 700),
      proofLinks: safeTrimList(submission.proofLinks, 5),
      proofFiles: safeTrimList(submission.proofFiles, 5),
      revisions: submission.revisions.slice(0, 4).map((revision) => ({
        ...revision,
        notes: safeTrimOptional(revision.notes, 700),
        proofLinks: safeTrimList(revision.proofLinks, 4),
        proofFiles: safeTrimList(revision.proofFiles, 4),
      })),
    })),
    reviews: input.reviews.slice(0, 8).map((review) => ({
      ...review,
      comment: safeTrimOptional(review.comment, 500),
    })),
  };
}

function buildPrompt(context: DisputeContext) {
  const compact = normalizeContext(context);
  const contextJson = JSON.stringify(compact, null, 2);

  return [
    "Voce e auditor objetivo de disputas da plataforma QUEST.",
    "Objetivo: identificar inconsistencias factuais no caso e sugerir uma acao para o admin humano decidir.",
    "Regras:",
    "1) Nao invente fatos ausentes no contexto.",
    "2) Foque em checklist de condicoes de vitoria, prazos e evidencias (links/arquivos).",
    "3) Se houver pouca evidencia, deixe claro no resumo.",
    "4) Responda SOMENTE JSON valido.",
    "Esquema JSON obrigatorio:",
    JSON.stringify(
      {
        summary: "string",
        inconsistencies: [
          {
            severity: "LOW|MEDIUM|HIGH",
            title: "string",
            details: "string",
            evidence: ["string"],
          },
        ],
        recommendation: "COMPLETE_MISSION|KEEP_DISPUTE_OPEN|REQUEST_REVISION|REJECT_SUBMISSION",
        confidence: 0.0,
        adminChecklist: ["string"],
      },
      null,
      2,
    ),
    "Contexto do caso:",
    contextJson,
  ].join("\n");
}

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function getGateConfig() {
  const minConfidenceForComplete = clamp01(Number(process.env.OLLAMA_DISPUTE_COMPLETE_MIN_CONFIDENCE ?? 0.78));
  const blockOnHighSeverity = (process.env.OLLAMA_DISPUTE_BLOCK_COMPLETE_ON_HIGH ?? "true").toLowerCase() === "true";
  return {
    minConfidenceForComplete,
    blockOnHighSeverity,
  };
}

export function applyDisputeTriageGate(triage: DisputeTriage): DisputeTriageGate {
  const config = getGateConfig();
  const hasHighSeverity = triage.inconsistencies.some((item) => item.severity === "HIGH");
  const reasons: string[] = [];
  let finalRecommendation = triage.recommendation;

  if (triage.recommendation === "COMPLETE_MISSION") {
    if (triage.confidence < config.minConfidenceForComplete) {
      reasons.push("CONFIANCA_BAIXA_PARA_COMPLETE");
    }
    if (config.blockOnHighSeverity && hasHighSeverity) {
      reasons.push("INCONSISTENCIA_HIGH_PRESENTE");
    }
    if (reasons.length > 0) {
      finalRecommendation = "KEEP_DISPUTE_OPEN";
    }
  }

  return {
    finalRecommendation,
    wasOverridden: finalRecommendation !== triage.recommendation,
    reasons,
    minConfidenceForComplete: config.minConfidenceForComplete,
    hasHighSeverity,
  };
}

export async function runDisputeTriage(input: { context: DisputeContext; model?: string }) {
  const runtime = await getResolvedLlmRuntimeConfig();
  const timeoutMs = runtime.timeoutsMs.dispute;
  const prompt = buildPrompt(input.context);
  const ollama = await ollamaGenerate({
    prompt,
    model: input.model ?? runtime.models.dispute,
    format: "json",
    temperature: 0.1,
    timeoutMs,
    requestTag: "DISPUTE_TRIAGE",
  });

  const raw = ollama.text.trim();
  const json = parseFirstJsonObject(raw);
  if (!json) {
    throw new Error("TRIAGE_PARSE_FAILED");
  }
  const parsed = triageSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error("TRIAGE_PARSE_FAILED");
  }

  const gate = applyDisputeTriageGate(parsed.data);

  return {
    triage: parsed.data,
    gate,
    model: ollama.model,
    raw,
    durationNs: ollama.durationNs,
    evalCount: ollama.evalCount,
  };
}
