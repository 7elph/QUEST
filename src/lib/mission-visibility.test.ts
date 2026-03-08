import { describe, expect, it } from "vitest";
import { MissionStatus, Role } from "@prisma/client";
import { buildMissionListAccessFilter, canViewMissionDetails, isPublicMissionStatus } from "./mission-visibility";

describe("mission-visibility", () => {
  it("marks only OPEN missions as public", () => {
    expect(isPublicMissionStatus(MissionStatus.OPEN)).toBe(true);
    expect(isPublicMissionStatus(MissionStatus.ASSIGNED)).toBe(false);
  });

  it("builds patron filter scoped to owner", () => {
    expect(buildMissionListAccessFilter(Role.PATRON, "user-1")).toEqual({ patronId: "user-1" });
  });

  it("builds adventurer filter for open or assigned", () => {
    expect(buildMissionListAccessFilter(Role.ADVENTURER, "adv-1")).toEqual({
      OR: [{ status: MissionStatus.OPEN }, { assignedTo: "adv-1" }],
    });
  });

  it("allows detailed access for admin", () => {
    expect(
      canViewMissionDetails({
        role: Role.ADMIN,
        userId: "admin-1",
        patronId: "patron-1",
        assignedTo: "adv-1",
        status: MissionStatus.IN_REVIEW,
      }),
    ).toBe(true);
  });

  it("blocks unrelated users from non-open mission", () => {
    expect(
      canViewMissionDetails({
        role: Role.ADVENTURER,
        userId: "adv-2",
        patronId: "patron-1",
        assignedTo: "adv-1",
        status: MissionStatus.IN_REVIEW,
      }),
    ).toBe(false);
  });
});
