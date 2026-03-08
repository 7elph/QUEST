import { describe, expect, it } from "vitest";
import { getPasswordRules, validatePasswordPolicy } from "./password-policy";

describe("password policy", () => {
  it("accepts a strong password", () => {
    const result = validatePasswordPolicy("Quest@2026Strong");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects weak passwords with missing rules", () => {
    const result = validatePasswordPolicy("fraca");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns detailed rule status", () => {
    const rules = getPasswordRules("NoSpaces2026!");
    expect(rules.every((rule) => rule.valid)).toBe(true);
  });
});
