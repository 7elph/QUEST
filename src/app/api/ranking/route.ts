import { NextResponse } from "next/server";
import { MissionCategory, Role } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getRankByXP } from "@/lib/xp";
import { computePerformanceScore } from "@/lib/ranking";

function getWindowStart(window: string | null) {
  if (window === "weekly") {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    await requireRole([Role.ADVENTURER, Role.PATRON, Role.ADMIN]);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") as MissionCategory | null;
    const window = searchParams.get("window");
    const startAt = getWindowStart(window);

    const adventurers = await prisma.user.findMany({
      where: { role: Role.ADVENTURER, status: "ACTIVE" },
      select: {
        id: true,
        nick: true,
        name: true,
        email: true,
        profile: { select: { avatarUrl: true } },
      },
    });

    const ranking = await Promise.all(
      adventurers.map(async (user) => {
        const submissions = await prisma.submission.findMany({
          where: {
            adventurerId: user.id,
            ...(startAt ? { submittedAt: { gte: startAt } } : {}),
            ...(category ? { mission: { category } } : {}),
          },
          include: {
            mission: {
              select: {
                id: true,
                deadlineAt: true,
                dispute: { select: { id: true } },
              },
            },
          },
        });

        const accepted = submissions.filter((item) => item.status === "ACCEPTED");
        const onTime = accepted.filter((item) => item.submittedAt <= item.mission.deadlineAt);
        const completed = accepted.length;
        const disputes = submissions.filter((item) => !!item.mission.dispute).length;
        const perf = computePerformanceScore({
          completed,
          accepted: accepted.length,
          totalSubmissions: submissions.length,
          onTime: onTime.length,
          disputes,
        });

        const xp = await prisma.xPLog.aggregate({
          where: {
            userId: user.id,
            ...(startAt ? { createdAt: { gte: startAt } } : {}),
            ...(category ? { mission: { category } } : {}),
          },
          _sum: { xpChange: true },
        });

        const totalXP = await prisma.xPLog.aggregate({
          where: { userId: user.id },
          _sum: { xpChange: true },
        });

        return {
          userId: user.id,
          name: user.nick ?? user.name ?? user.email,
          avatarUrl: user.profile?.avatarUrl ?? null,
          rank: getRankByXP(totalXP._sum.xpChange ?? 0),
          score: perf.score,
          xp: xp._sum.xpChange ?? 0,
          completed,
          punctuality: Number((perf.punctuality * 100).toFixed(1)),
          quality: Number((perf.quality * 100).toFixed(1)),
          provisional: perf.provisional,
        };
      }),
    );

    ranking.sort((a, b) => (b.score === a.score ? b.xp - a.xp : b.score - a.score));

    return NextResponse.json({
      window: window ?? "all",
      category: category ?? "ALL",
      ranking,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao carregar ranking." }, { status: 500 });
  }
}
