export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { AdminPanel } from "@/components/app/admin-panel";
import { alphaCategoryMeta } from "@/lib/mission-catalog";
import { missionCategoryIcons } from "@/lib/quest-icons";
import { getMissionRewardPreview } from "@/lib/mission-rewards";

type AdminSearchParams = {
  audit?: string;
  error?: string;
  errorSource?: "SERVER" | "CLIENT" | "EDGE";
};

export default async function AdminPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const session = await getServerAuthSession();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  const auditQuery = searchParams.audit?.trim();
  const errorQuery = searchParams.error?.trim();
  const errorSource = searchParams.errorSource;
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const llmActions = [
    "MISSION_LLM_SCREENED",
    "MISSION_APPROVAL_DECIDED",
    "LLM_SIMULATION_RUN",
    "LLM_SIMULATION_FULL_RUN",
    "DISPUTE_TRIAGE_AI",
  ] as const;

  const [users, missions, disputes, founders, pendingEscrow, openDisputes, pendingFounders, pendingApprovals, auditLogs, kpis, errorEvents, errorSummary, storeRequestLogs, storeResolvedLogs, llmScreeningTotal, llmAuditLogs] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, role: true, status: true, adminScope: true }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.mission.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        escrowStatus: true,
        category: true,
        minRank: true,
        scope: true,
        neighborhood: true,
        city: true,
        state: true,
        deadlineAt: true,
        patron: { select: { nick: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.dispute.findMany({ select: { id: true, missionId: true, reason: true, status: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.founderPledge.findMany({ include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.mission.findMany({ where: { sponsored: true, escrowStatus: "PENDING" }, select: { id: true, title: true, escrowStatus: true }, take: 20 }),
    prisma.dispute.findMany({ where: { status: "OPEN" }, select: { id: true, reason: true, missionId: true }, take: 20 }),
    prisma.founderPledge.findMany({ where: { status: "PENDING" }, include: { user: { select: { email: true } } }, take: 20 }),
    prisma.mission.findMany({
      where: { status: "DRAFT" },
      select: {
        id: true,
        title: true,
        patron: { select: { email: true, nick: true } },
        screening: {
          select: {
            decision: true,
            confidence: true,
            summary: true,
            model: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: auditQuery
        ? {
            OR: [
              { action: { contains: auditQuery, mode: "insensitive" } },
              { targetType: { contains: auditQuery, mode: "insensitive" } },
              { targetId: { contains: auditQuery, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    Promise.all([
      prisma.mission.count({ where: { status: "OPEN" } }),
      prisma.mission.count({ where: { status: "COMPLETED" } }),
      prisma.dispute.count(),
      prisma.submission.aggregate({ _avg: { revisionCount: true } }),
    ]),
    prisma.errorEvent.findMany({
      where: {
        ...(errorSource ? { source: errorSource } : {}),
        ...(errorQuery
          ? {
              OR: [
                { message: { contains: errorQuery, mode: "insensitive" } },
                { route: { contains: errorQuery, mode: "insensitive" } },
                { requestId: { contains: errorQuery, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    Promise.all([
      prisma.errorEvent.count({ where: { createdAt: { gte: last24h } } }),
      prisma.errorEvent.count({ where: { source: "SERVER", createdAt: { gte: last24h } } }),
      prisma.errorEvent.count({ where: { source: "CLIENT", createdAt: { gte: last24h } } }),
      prisma.errorEvent.count({ where: { source: "EDGE", createdAt: { gte: last24h } } }),
    ]),
    prisma.auditLog.findMany({
      where: { action: "STORE_ITEM_PURCHASE_REQUESTED", targetType: "StorePurchaseRequest" },
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.auditLog.findMany({
      where: { action: "STORE_ITEM_PURCHASE_RESOLVED", targetType: "StorePurchaseRequest" },
      select: { targetId: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.missionScreening.count(),
    prisma.auditLog.findMany({
      where: { action: { in: [...llmActions] } },
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
  ]);

  const userIds = users.map((user) => user.id);
  const balances = userIds.length
    ? await prisma.xPLog.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _sum: { xpChange: true },
      })
    : [];
  const balanceMap = new Map(balances.map((item) => [item.userId, item._sum.xpChange ?? 0]));

  const resolvedStoreRequestIds = new Set(
    storeResolvedLogs.map((log) => log.targetId).filter((targetId): targetId is string => !!targetId),
  );
  const storeRequests = storeRequestLogs
    .filter((log) => !!log.targetId && !resolvedStoreRequestIds.has(log.targetId))
    .map((log) => {
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      return {
        requestId: log.targetId as string,
        userEmail:
          (typeof meta.userEmail === "string" && meta.userEmail) ||
          log.actor?.email ||
          "desconhecido",
        userId: (typeof meta.userId === "string" && meta.userId) || "",
        itemId: (typeof meta.itemId === "string" && meta.itemId) || "",
        itemName: (typeof meta.itemName === "string" && meta.itemName) || "Item",
        priceEnchantiun:
          typeof meta.priceEnchantiun === "number"
            ? meta.priceEnchantiun
            : Number(meta.priceEnchantiun ?? 0),
        priceBrl: (typeof meta.priceBrl === "string" && meta.priceBrl) || "-",
        proofUrl: (typeof meta.proofUrl === "string" && meta.proofUrl) || "",
        createdAt: log.createdAt.toISOString(),
      };
    });

  const llmApprovalLogs = llmAuditLogs.filter((log) => log.action === "MISSION_APPROVAL_DECIDED");
  const llmSimulationLogs = llmAuditLogs.filter((log) =>
    log.action === "LLM_SIMULATION_RUN" || log.action === "LLM_SIMULATION_FULL_RUN",
  );
  const llmTriageLogs = llmAuditLogs.filter((log) => log.action === "DISPUTE_TRIAGE_AI");
  const llmScreenLogs = llmAuditLogs.filter((log) => log.action === "MISSION_LLM_SCREENED");
  const llm24h = llmAuditLogs.filter((log) => log.createdAt >= last24h);
  const llmSimulationAwaiting = llmSimulationLogs.filter((log) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    return (typeof meta.source === "string" ? meta.source : "AWAITING") !== "LLM";
  }).length;
  const llmEvents = llmAuditLogs.map((log) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const model =
      (typeof meta.model === "string" && meta.model) ||
      (typeof meta.missionBlueprintModel === "string" && meta.missionBlueprintModel) ||
      "aguardando";
    let status = "AGUARDANDO";
    if (log.action === "MISSION_LLM_SCREENED") {
      status = typeof meta.decision === "string" ? meta.decision : "SCREENED";
    } else if (log.action === "MISSION_APPROVAL_DECIDED") {
      status = typeof meta.decision === "string" ? meta.decision : "DECIDED";
    } else if (log.action === "LLM_SIMULATION_RUN") {
      status = typeof meta.source === "string" ? meta.source : "AWAITING";
    } else if (log.action === "LLM_SIMULATION_FULL_RUN") {
      status =
        (typeof meta.outcome === "string" && meta.outcome) ||
        (typeof meta.missionStatus === "string" && meta.missionStatus) ||
        "FULL_RUN";
    } else if (log.action === "DISPUTE_TRIAGE_AI") {
      status = typeof meta.finalRecommendation === "string"
        ? meta.finalRecommendation
        : (typeof meta.recommendation === "string" ? meta.recommendation : "TRIAGED");
    }
    return {
      id: log.id,
      action: log.action,
      status,
      model,
      targetType: log.targetType,
      targetId: log.targetId ?? "",
      actor: log.actor?.email ?? "system",
      createdAt: log.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-amber-200">Admin / Guild Master</h1>
      <p className="text-sm text-amber-100/80">Escopo atual: {session.user.adminScope ?? "SEM_SCOPE"}</p>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-amber-200/20 bg-black/20 p-3 text-sm">Missoes abertas: {kpis[0]}</div>
        <div className="rounded-lg border border-amber-200/20 bg-black/20 p-3 text-sm">Concluidas: {kpis[1]}</div>
        <div className="rounded-lg border border-amber-200/20 bg-black/20 p-3 text-sm">Taxa disputa: {kpis[1] ? ((kpis[2] / kpis[1]) * 100).toFixed(1) : "0"}%</div>
        <div className="rounded-lg border border-amber-200/20 bg-black/20 p-3 text-sm">Tempo medio (proxy): {(kpis[3]._avg.revisionCount ?? 0).toFixed(1)} revisoes</div>
      </section>

      <AdminPanel
        users={users.map((u) => ({
          ...u,
          role: u.role,
          status: u.status,
          adminScope: u.adminScope ?? "",
          enchantiunBalance: balanceMap.get(u.id) ?? 0,
        }))}
        missions={missions.map((m) => {
          const reward = getMissionRewardPreview(m.id, m.minRank);
          return {
            id: m.id,
            title: m.title,
            status: m.status,
            escrowStatus: m.escrowStatus,
            categoryLabel: alphaCategoryMeta[m.category].label,
            categoryIcon: missionCategoryIcons[m.category],
            rank: m.minRank,
            summary: m.scope,
            neighborhood: m.neighborhood,
            city: m.city,
            state: m.state,
            patronName: m.patron.nick ?? m.patron.email,
            deadlineAt: m.deadlineAt.toISOString(),
            enchantiun: reward.enchantiun,
            dropName: reward.drop?.name ?? null,
            dropIconPath: reward.drop?.iconPath ?? null,
          };
        })}
        disputes={disputes.map((d) => ({ ...d, status: d.status }))}
        founders={founders.map((f) => ({ id: f.id, tier: f.tier, status: f.status, userEmail: f.user.email }))}
        inbox={{
          pendingEscrow: pendingEscrow.map((m) => ({ id: m.id, title: m.title, escrowStatus: m.escrowStatus })),
          openDisputes: openDisputes.map((d) => ({ id: d.id, reason: d.reason, missionId: d.missionId })),
          pendingFounders: pendingFounders.map((f) => ({ id: f.id, tier: f.tier, userEmail: f.user.email })),
        }}
        pendingApprovals={pendingApprovals.map((mission) => ({
          id: mission.id,
          title: mission.title,
          patron: mission.patron.nick ?? mission.patron.email,
          screeningDecision: mission.screening?.decision ?? "ERROR",
          screeningConfidence: mission.screening?.confidence ?? 0,
          screeningSummary: mission.screening?.summary ?? "Sem resumo de triagem.",
          screeningModel: mission.screening?.model ?? "-",
          screeningCreatedAt: mission.screening?.createdAt?.toISOString() ?? "",
        }))}
        storeRequests={storeRequests}
        audit={{
          query: auditQuery ?? "",
          logs: auditLogs.map((log) => ({
            id: log.id,
            action: log.action,
            targetType: log.targetType,
            targetId: log.targetId ?? "",
            actor: log.actor?.email ?? "system",
            createdAt: log.createdAt.toISOString(),
          })),
        }}
        errors={{
          query: errorQuery ?? "",
          source: errorSource ?? "",
          summary: {
            total24h: errorSummary[0],
            server24h: errorSummary[1],
            client24h: errorSummary[2],
            edge24h: errorSummary[3],
          },
          events: errorEvents.map((event) => ({
            id: event.id,
            source: event.source,
            route: event.route ?? "",
            method: event.method ?? "",
            statusCode: event.statusCode ?? 500,
            requestId: event.requestId ?? "",
            message: event.message,
            user: event.user?.email ?? "anon",
            createdAt: event.createdAt.toISOString(),
          })),
        }}
        llmPipeline={{
          summary: {
            screenedTotal: llmScreeningTotal,
            screened24h: llm24h.filter((log) => log.action === "MISSION_LLM_SCREENED").length,
            pendingApproval: pendingApprovals.length,
            approvalsTotal: llmApprovalLogs.length,
            approvals24h: llm24h.filter((log) => log.action === "MISSION_APPROVAL_DECIDED").length,
            simulationsTotal: llmSimulationLogs.length,
            simulations24h: llm24h.filter((log) => log.action === "LLM_SIMULATION_RUN").length,
            simulationsAwaiting: llmSimulationAwaiting,
            disputesTriagedTotal: llmTriageLogs.length,
            disputesTriaged24h: llm24h.filter((log) => log.action === "DISPUTE_TRIAGE_AI").length,
            screenEventsLogged: llmScreenLogs.length,
          },
          events: llmEvents,
        }}
      />
    </div>
  );
}
