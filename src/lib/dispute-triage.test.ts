import { describe, expect, it } from "vitest";
import { applyDisputeTriageGate, extractFirstJsonObject } from "./dispute-triage";

describe("dispute triage utils", () => {
  it("extracts a JSON object from noisy text", () => {
    const raw = "Analise:\n{\"summary\":\"ok\",\"inconsistencies\":[],\"recommendation\":\"KEEP_DISPUTE_OPEN\",\"confidence\":0.5,\"adminChecklist\":[\"a\",\"b\",\"c\"]}\nFim.";
    const json = extractFirstJsonObject(raw);
    expect(json?.startsWith("{")).toBe(true);
    expect(json?.endsWith("}")).toBe(true);
  });

  it("returns null when no json braces are present", () => {
    expect(extractFirstJsonObject("sem objeto")).toBeNull();
  });

  it("blocks COMPLETE_MISSION when confidence is below threshold", () => {
    const gate = applyDisputeTriageGate({
      summary: "Resumo",
      inconsistencies: [],
      recommendation: "COMPLETE_MISSION",
      confidence: 0.5,
      adminChecklist: ["A", "B", "C"],
    });

    expect(gate.wasOverridden).toBe(true);
    expect(gate.finalRecommendation).toBe("KEEP_DISPUTE_OPEN");
    expect(gate.reasons).toContain("CONFIANCA_BAIXA_PARA_COMPLETE");
  });

  it("blocks COMPLETE_MISSION when there is HIGH inconsistency", () => {
    const gate = applyDisputeTriageGate({
      summary: "Resumo",
      inconsistencies: [
        {
          severity: "HIGH",
          title: "Falha de evidencias",
          details: "Checklist nao comprovado",
          evidence: ["submissao sem link"],
        },
      ],
      recommendation: "COMPLETE_MISSION",
      confidence: 0.95,
      adminChecklist: ["A", "B", "C"],
    });

    expect(gate.wasOverridden).toBe(true);
    expect(gate.finalRecommendation).toBe("KEEP_DISPUTE_OPEN");
    expect(gate.reasons).toContain("INCONSISTENCIA_HIGH_PRESENTE");
  });
});
