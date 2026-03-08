import { MissionStatus, Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export function isPublicMissionStatus(status: MissionStatus) {
  return status === MissionStatus.OPEN;
}

export function buildMissionListAccessFilter(role: Role, userId: string): Prisma.MissionWhereInput {
  if (role === Role.ADMIN) {
    return {};
  }
  if (role === Role.PATRON) {
    return { patronId: userId };
  }
  return {
    OR: [
      { status: MissionStatus.OPEN },
      { assignedTo: userId },
    ],
  };
}

export function canViewMissionDetails(input: {
  role: Role;
  userId: string;
  patronId: string;
  assignedTo: string | null;
  status: MissionStatus;
}) {
  if (input.role === Role.ADMIN) return true;
  if (input.role === Role.PATRON && input.patronId === input.userId) return true;
  if (input.role === Role.ADVENTURER && input.assignedTo === input.userId) return true;
  return isPublicMissionStatus(input.status);
}
