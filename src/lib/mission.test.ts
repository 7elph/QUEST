import { describe, expect, it } from "vitest";
import { MissionCategory } from "@prisma/client";
import { buildNarrative } from "./mission";
import { getRankByXP } from "./xp";

describe("mission domain", () => {
  it("builds narrative with title and conditions", () => {
    const narrative = buildNarrative({
      title: "Missao de teste",
      category: MissionCategory.CONTEUDO_COPY,
      scope: "Produzir copy",
      victoryConditions: ["Prazo", "Checklist"],
    });

    expect(narrative).toContain("Missao: Missao de teste");
    expect(narrative).toContain("Condicoes de Vitoria");
  });

  it("returns S rank for high XP", () => {
    expect(getRankByXP(2100)).toBe("S");
  });
});
