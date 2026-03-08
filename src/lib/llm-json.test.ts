import { describe, expect, it } from "vitest";
import { extractFirstJsonObject, parseFirstJsonObject } from "./llm-json";

describe("llm-json utils", () => {
  it("extracts json from noisy text", () => {
    const raw = "Resposta:\n{\"ok\":true,\"value\":1}\nFim.";
    expect(extractFirstJsonObject(raw)).toBe("{\"ok\":true,\"value\":1}");
  });

  it("extracts json from fenced block", () => {
    const raw = "```json\n{\"decision\":\"PASS\",\"confidence\":0.9}\n```";
    expect(extractFirstJsonObject(raw)).toBe("{\"decision\":\"PASS\",\"confidence\":0.9}");
  });

  it("handles braces inside strings", () => {
    const raw = "{\"summary\":\"Texto com {chaves} internas\",\"ok\":true} resto";
    const parsed = parseFirstJsonObject(raw) as { summary: string; ok: boolean };
    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toContain("{chaves}");
  });

  it("returns null when json cannot be extracted", () => {
    expect(extractFirstJsonObject("sem json aqui")).toBeNull();
    expect(parseFirstJsonObject("sem json aqui")).toBeNull();
  });
});
