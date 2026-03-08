import { MissionCategory } from "@prisma/client";
import { z } from "zod";
import { ollamaGenerate } from "@/lib/ollama";
import { parseFirstJsonObject } from "@/lib/llm-json";
import { getCategoryDisplay } from "@/lib/mission-catalog";
import { getResolvedLlmRuntimeConfig } from "@/lib/llm-runtime-config";

type RpgNarrativeInput = {
  title: string;
  category: MissionCategory;
  missionType: string;
  scope: string;
  victoryConditions: string[];
  city: string;
  state: string;
  neighborhood: string;
};

const responseSchema = z.object({
  rpgTitle: z.string().min(4).max(160),
  rpgNarrative: z.string().min(40).max(2600),
  rpgRewardFlavor: z.string().max(220).optional(),
});

function buildPrompt(input: RpgNarrativeInput) {
  const intent =
    "Transforme a tarefa abaixo em uma missão RPG curta e imersiva da Guilda QUEST™, citando Piracicaba e o bairro como ambientação. Não invente requisitos. Preserve o checklist e o objetivo. Gere: título RPG e narrativa curta (2-5 parágrafos).";

  return [
    intent,
    "Responda somente JSON valido com chaves: rpgTitle, rpgNarrative, rpgRewardFlavor.",
    "Mantenha o objetivo e todas as condicoes de vitoria exatamente como informadas.",
    "Dados da tarefa:",
    JSON.stringify(
      {
        title: input.title,
        category: getCategoryDisplay(input.category),
        missionType: input.missionType,
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

async function shouldUseRpgLlm() {
  const runtime = await getResolvedLlmRuntimeConfig();
  const explicit = process.env.RPG_LLM_ENABLED;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return explicit.trim().toLowerCase() === "true";
  }

  // Compatibilidade com configuracao antiga.
  if (process.env.RPG_LLM_KEY?.trim()) {
    return true;
  }

  return runtime.enabled;
}

function buildFallback(input: RpgNarrativeInput) {
  const checklist = input.victoryConditions.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
  const rpgTitle = `${input.title} - Contrato da Guilda`;
  const rpgNarrative = [
    `Nos corredores da Guilda QUEST, um Patrono em ${input.city}/${input.state}, distrito de ${input.neighborhood}, abriu um chamado para ${getCategoryDisplay(input.category)}.`,
    `Objetivo da missao: ${input.scope}`,
    `Condicoes de Vitoria:\n${checklist}`,
    "Complete a entrega dentro do prazo, registre evidencias claras e mantenha aderencia total ao checklist.",
  ].join("\n\n");
  return {
    rpgTitle,
    rpgNarrative,
    rpgRewardFlavor: "Gloria da Guilda + progresso de rank por entrega objetiva.",
    source: "fallback" as const,
  };
}

export async function generateRpgNarrative(input: RpgNarrativeInput) {
  const fallback = buildFallback(input);
  if (!(await shouldUseRpgLlm())) {
    return fallback;
  }

  try {
    const runtime = await getResolvedLlmRuntimeConfig();
    const timeoutMs = runtime.timeoutsMs.rpg;
    const output = await ollamaGenerate({
      model: runtime.models.rpg,
      prompt: buildPrompt(input),
      format: "json",
      temperature: 0.3,
      timeoutMs,
      requestTag: "RPG_NARRATIVE",
    });

    const parsedJson = parseFirstJsonObject(output.text);
    if (!parsedJson) {
      return fallback;
    }

    const parsed = responseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return fallback;
    }

    return {
      rpgTitle: parsed.data.rpgTitle,
      rpgNarrative: parsed.data.rpgNarrative,
      rpgRewardFlavor: parsed.data.rpgRewardFlavor ?? fallback.rpgRewardFlavor,
      source: "llm" as const,
    };
  } catch {
    return fallback;
  }
}
