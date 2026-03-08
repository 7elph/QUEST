import { describe, expect, it } from "vitest";
import { RankName } from "@prisma/client";
import { getMissionEnchantiunReward, getMissionRewardPreview } from "./mission-rewards";

describe("mission rewards", () => {
  it("returns enchantiun by difficulty rank", () => {
    expect(getMissionEnchantiunReward(RankName.E)).toBe(40);
    expect(getMissionEnchantiunReward(RankName.C)).toBeGreaterThan(getMissionEnchantiunReward(RankName.D));
    expect(getMissionEnchantiunReward(RankName.S)).toBeGreaterThan(getMissionEnchantiunReward(RankName.C));
  });

  it("is deterministic for the same mission id and rank", () => {
    const first = getMissionRewardPreview("mission-alpha", RankName.C);
    const second = getMissionRewardPreview("mission-alpha", RankName.C);
    expect(second).toEqual(first);
  });

  it("does not provide drop for low-rank missions", () => {
    const reward = getMissionRewardPreview("mission-low", RankName.E);
    expect(reward.drop).toBeNull();
  });
});
