import { describe, expect, it } from "vitest";
import { assessmentQuestions, computeAssessment } from "./adventurer-assessment";

describe("adventurer assessment", () => {
  it("returns dominant skills and profile", () => {
    const answers = assessmentQuestions.map((question) => ({
      questionId: question.id,
      optionId: question.options[0].id,
    }));

    const result = computeAssessment(answers);
    expect(result.profile.length).toBeGreaterThan(3);
    expect(result.dominantSkills.length).toBe(3);
  });

  it("keeps stable score shape", () => {
    const answers = assessmentQuestions.map((question) => ({
      questionId: question.id,
      optionId: question.options[1].id,
    }));

    const result = computeAssessment(answers);
    expect(Object.keys(result.scores).sort()).toEqual([
      "ATENDIMENTO_SUPORTE",
      "AUTOMACAO_NO_CODE",
      "CONTEUDO_COPY",
      "DESIGN_RAPIDO",
      "OPERACOES_PLANILHAS",
      "SOCIAL_MEDIA_LOCAL",
      "VENDAS_PROSPECCAO",
    ]);
  });
});
