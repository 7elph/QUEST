import { describe, expect, it } from "vitest";
import { MissionStatus } from "@prisma/client";
import { isMissionTransitionAllowed } from "./mission-status";

describe("mission status transitions", () => {
  it("allows expected operational transitions", () => {
    expect(isMissionTransitionAllowed(MissionStatus.DRAFT, MissionStatus.OPEN)).toBe(true);
    expect(isMissionTransitionAllowed(MissionStatus.OPEN, MissionStatus.ASSIGNED)).toBe(true);
    expect(isMissionTransitionAllowed(MissionStatus.ASSIGNED, MissionStatus.IN_REVIEW)).toBe(true);
    expect(isMissionTransitionAllowed(MissionStatus.IN_REVIEW, MissionStatus.REVISION_REQUESTED)).toBe(true);
    expect(isMissionTransitionAllowed(MissionStatus.REVISION_REQUESTED, MissionStatus.IN_REVIEW)).toBe(true);
    expect(isMissionTransitionAllowed(MissionStatus.IN_REVIEW, MissionStatus.COMPLETED)).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(isMissionTransitionAllowed(MissionStatus.OPEN, MissionStatus.COMPLETED)).toBe(false);
    expect(isMissionTransitionAllowed(MissionStatus.CANCELLED, MissionStatus.OPEN)).toBe(false);
    expect(isMissionTransitionAllowed(MissionStatus.DRAFT, MissionStatus.COMPLETED)).toBe(false);
  });
});
