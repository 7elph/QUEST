import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [users, openMissions, completedMissions, disputes, submissions] = await Promise.all([
    prisma.user.count(),
    prisma.mission.count({ where: { status: "OPEN" } }),
    prisma.mission.count({ where: { status: "COMPLETED" } }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.submission.count(),
  ]);

  return NextResponse.json({
    users,
    openMissions,
    completedMissions,
    openDisputes: disputes,
    submissions,
    timestamp: new Date().toISOString(),
  });
}
