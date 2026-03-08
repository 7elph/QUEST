import { describe, expect, it } from "vitest";
import { computePerformanceScore } from "./ranking";

describe("ranking score", () => {
  it("flags low volume as provisional", () => {
    const result = computePerformanceScore({
      completed: 1,
      accepted: 1,
      totalSubmissions: 1,
      onTime: 1,
      disputes: 0,
    });

    expect(result.provisional).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it("applies dispute penalty", () => {
    const noDispute = computePerformanceScore({
      completed: 4,
      accepted: 4,
      totalSubmissions: 4,
      onTime: 4,
      disputes: 0,
    });

    const withDispute = computePerformanceScore({
      completed: 4,
      accepted: 4,
      totalSubmissions: 4,
      onTime: 4,
      disputes: 2,
    });

    expect(withDispute.score).toBeLessThan(noDispute.score);
  });
});
