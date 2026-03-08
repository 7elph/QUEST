import type { Prisma, PrismaClient } from "@prisma/client";
import { MissionStatus, Role } from "@prisma/client";
import { prisma } from "./prisma";

type MissionDbClient = PrismaClient | Prisma.TransactionClient;

const allowedTransitions: Record<MissionStatus, MissionStatus[]> = {
  DRAFT: [MissionStatus.OPEN, MissionStatus.CANCELLED],
  OPEN: [MissionStatus.ASSIGNED, MissionStatus.DISPUTED, MissionStatus.CANCELLED],
  ASSIGNED: [MissionStatus.IN_REVIEW, MissionStatus.DISPUTED, MissionStatus.CANCELLED],
  IN_REVIEW: [
    MissionStatus.REVISION_REQUESTED,
    MissionStatus.COMPLETED,
    MissionStatus.CANCELLED,
    MissionStatus.DISPUTED,
  ],
  REVISION_REQUESTED: [MissionStatus.IN_REVIEW, MissionStatus.DISPUTED, MissionStatus.CANCELLED],
  COMPLETED: [MissionStatus.DISPUTED],
  DISPUTED: [
    MissionStatus.OPEN,
    MissionStatus.ASSIGNED,
    MissionStatus.IN_REVIEW,
    MissionStatus.REVISION_REQUESTED,
    MissionStatus.COMPLETED,
    MissionStatus.CANCELLED,
  ],
  CANCELLED: [],
};

export class MissionTransitionError extends Error {
  code: "MISSION_NOT_FOUND" | "MISSION_INVALID_TRANSITION" | "FORBIDDEN";

  constructor(code: "MISSION_NOT_FOUND" | "MISSION_INVALID_TRANSITION" | "FORBIDDEN", message: string) {
    super(message);
    this.code = code;
  }
}

function canTransition(from: MissionStatus, to: MissionStatus) {
  if (from === to) return true;
  return allowedTransitions[from].includes(to);
}

export function isMissionTransitionAllowed(from: MissionStatus, to: MissionStatus) {
  return canTransition(from, to);
}

type TransitionMissionStatusInput = {
  missionId: string;
  toStatus: MissionStatus;
  actorRole: Role | "SYSTEM";
  actorId?: string;
  force?: boolean;
  clearAssignee?: boolean;
  assignTo?: string;
  tx?: MissionDbClient;
};

export async function transitionMissionStatus({
  missionId,
  toStatus,
  actorRole,
  actorId,
  force = false,
  clearAssignee = false,
  assignTo,
  tx,
}: TransitionMissionStatusInput) {
  const db = tx ?? prisma;
  const mission = await db.mission.findUnique({ where: { id: missionId } });

  if (!mission) {
    throw new MissionTransitionError("MISSION_NOT_FOUND", "Missao nao encontrada.");
  }

  if (!force && !canTransition(mission.status, toStatus)) {
    throw new MissionTransitionError(
      "MISSION_INVALID_TRANSITION",
      `Transicao invalida: ${mission.status} -> ${toStatus}.`,
    );
  }

  if (actorRole === Role.PATRON && mission.patronId !== actorId) {
    throw new MissionTransitionError("FORBIDDEN", "Missao nao pertence ao patrono.");
  }

  if (actorRole === Role.ADVENTURER) {
    const acceptingOwnOpen = mission.status === MissionStatus.OPEN && toStatus === MissionStatus.ASSIGNED;
    if (!acceptingOwnOpen && mission.assignedTo !== actorId) {
      throw new MissionTransitionError("FORBIDDEN", "Voce nao esta atribuido nesta missao.");
    }
  }

  const data: Prisma.MissionUncheckedUpdateInput = {
    status: toStatus,
  };

  if (toStatus === MissionStatus.COMPLETED) {
    data.completedAt = new Date();
  } else if (mission.completedAt) {
    data.completedAt = null;
  }

  if (toStatus === MissionStatus.ASSIGNED) {
    data.assignedTo = assignTo ?? actorId ?? mission.assignedTo;
    data.assignedAt = new Date();
  }

  if (clearAssignee) {
    data.assignedTo = null;
    data.assignedAt = null;
  }

  return db.mission.update({
    where: { id: missionId },
    data,
  });
}

type ClaimMissionInput = {
  missionId: string;
  adventurerId: string;
  tx?: MissionDbClient;
};

export async function claimOpenMissionForAdventurer({ missionId, adventurerId, tx }: ClaimMissionInput) {
  const db = tx ?? prisma;
  const claimed = await db.mission.updateMany({
    where: {
      id: missionId,
      status: MissionStatus.OPEN,
      assignedTo: null,
    },
    data: {
      status: MissionStatus.ASSIGNED,
      assignedTo: adventurerId,
      assignedAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  return db.mission.findUnique({ where: { id: missionId } });
}
