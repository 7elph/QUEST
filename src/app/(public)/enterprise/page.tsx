export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { MissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { EnterpriseRequestBuilder } from "@/components/app/enterprise-request-builder";
import { MissionPreviewGrid } from "@/components/app/mission-preview-grid";
import { alphaCategoryMeta } from "@/lib/mission-catalog";
import { missionCategoryIcons } from "@/lib/quest-icons";
import { getMissionRewardPreview } from "@/lib/mission-rewards";

const statusMeta: Record<MissionStatus, { label: string; chip: string }> = {
  DRAFT: {
    label: "Rascunho",
    chip: "border-slate-300 bg-slate-100 text-slate-700",
  },
  OPEN: {
    label: "Aberta",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  ASSIGNED: {
    label: "Em execucao",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  IN_REVIEW: {
    label: "Em analise",
    chip: "border-amber-200 bg-amber-50 text-amber-700",
  },
  REVISION_REQUESTED: {
    label: "Precisa ajuste",
    chip: "border-orange-200 bg-orange-50 text-orange-700",
  },
  COMPLETED: {
    label: "Finalizada",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  DISPUTED: {
    label: "Com problema",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
  },
  CANCELLED: {
    label: "Cancelada",
    chip: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

export default async function EnterprisePage() {
  const session = await getServerAuthSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const isPatron = session?.user?.role === "PATRON";
  const canMonitorQuests = isAdmin || isPatron;
  const missionScopeWhere = isAdmin ? {} : isPatron ? { patronId: session?.user.id } : null;

  let statusGroups: Array<{ status: MissionStatus; _count: { _all: number } }> = [];
  let recentQuests: Array<{
    id: string;
    title: string;
    scope: string;
    categoryLabel: string;
    categoryIcon: string;
    rank: "E" | "D" | "C" | "B" | "A" | "S";
    status: MissionStatus;
    deadlineAt: Date;
    neighborhood: string;
    city: string;
    state: string;
    enchantiun: number;
    dropName: string | null;
    dropIconPath: string | null;
    updatedAt: Date;
    assignedUser: { nick: string | null; email: string } | null;
  }> = [];

  if (canMonitorQuests && missionScopeWhere) {
    const [grouped, quests] = await Promise.all([
      prisma.mission.groupBy({
        by: ["status"],
        where: missionScopeWhere,
        _count: { _all: true },
      }),
      prisma.mission.findMany({
        where: missionScopeWhere,
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          scope: true,
          category: true,
          minRank: true,
          status: true,
          deadlineAt: true,
          neighborhood: true,
          city: true,
          state: true,
          updatedAt: true,
          assignedUser: { select: { nick: true, email: true } },
        },
      }),
    ]);

    statusGroups = grouped;
    recentQuests = quests.map((quest) => {
      const reward = getMissionRewardPreview(quest.id, quest.minRank);
      return {
        id: quest.id,
        title: quest.title,
        scope: quest.scope,
        categoryLabel: alphaCategoryMeta[quest.category].label,
        categoryIcon: missionCategoryIcons[quest.category],
        rank: quest.minRank,
        status: quest.status,
        deadlineAt: quest.deadlineAt,
        neighborhood: quest.neighborhood,
        city: quest.city,
        state: quest.state,
        enchantiun: reward.enchantiun,
        dropName: reward.drop?.name ?? null,
        dropIconPath: reward.drop?.iconPath ?? null,
        updatedAt: quest.updatedAt,
        assignedUser: quest.assignedUser,
      };
    });
  }

  const countMap = new Map(statusGroups.map((item) => [item.status, item._count._all]));
  const openTasks = countMap.get(MissionStatus.OPEN) ?? 0;
  const assignedTasks = countMap.get(MissionStatus.ASSIGNED) ?? 0;
  const reviewTasks =
    (countMap.get(MissionStatus.IN_REVIEW) ?? 0) + (countMap.get(MissionStatus.REVISION_REQUESTED) ?? 0);
  const completedTasks = countMap.get(MissionStatus.COMPLETED) ?? 0;
  const draftTasks = countMap.get(MissionStatus.DRAFT) ?? 0;
  const trackedTotal = statusGroups.reduce((sum, item) => sum + item._count._all, 0);
  const inProgress = openTasks + assignedTasks + reviewTasks;
  const completionRate = trackedTotal > 0 ? (completedTasks / trackedTotal) * 100 : 0;
  const overdueRisk = recentQuests.filter((quest) => {
    const isRunning = ["OPEN", "ASSIGNED", "IN_REVIEW", "REVISION_REQUESTED"].includes(quest.status);
    return isRunning && quest.deadlineAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-7 text-slate-100">
      <section className="relative overflow-hidden rounded-[28px] border border-cyan-200/30 bg-[#071426] shadow-[0_24px_72px_rgba(1,6,16,0.56)]">
        <Image
          src="/assets/enterprise-hero.png"
          alt="Visual corporativo QUEST Enterprise"
          fill
          className="object-cover opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(2,7,14,0.9),rgba(2,11,19,0.76),rgba(2,15,29,0.58))]" />
        <div className="relative grid gap-8 p-7 md:p-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-xs font-medium tracking-[0.28em] text-cyan-200/85">QUEST ENTERPRISE</p>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">
              Crie pedidos digitais e acompanhe tudo em um so lugar.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-200/90">
              Sem linguagem complicada: voce cria, o time faz, voce aprova.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-cyan-100/90">
              <span className="rounded-full border border-cyan-200/35 bg-cyan-400/10 px-3 py-1">Facil de usar</span>
              <span className="rounded-full border border-cyan-200/35 bg-cyan-400/10 px-3 py-1">Status simples</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#solicitacao" className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                Criar pedido
              </a>
              <a href="#acompanhamento" className="rounded-md border border-cyan-200/35 bg-slate-900/40 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-slate-900/65">
                Ver meus pedidos
              </a>
            </div>
          </div>

          <aside className="space-y-3 rounded-2xl border border-cyan-100/25 bg-[#050d1b]/76 p-5 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-200/85">Resumo</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-cyan-100/20 bg-cyan-900/15 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/75">Em andamento</p>
                <p className="mt-1 text-2xl font-semibold">{inProgress}</p>
              </div>
              <div className="rounded-xl border border-cyan-100/20 bg-cyan-900/15 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/75">Finalizadas</p>
                <p className="mt-1 text-2xl font-semibold">{completedTasks}</p>
              </div>
            </div>
            <div className="rounded-xl border border-cyan-100/20 bg-cyan-900/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-cyan-100/80">Percentual finalizado</p>
                <p className="text-sm font-semibold text-cyan-100">{completionRate.toFixed(1)}%</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-cyan-950/80">
                <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, completionRate)}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-cyan-100/20 bg-cyan-900/10 p-3">
              <div className="flex items-center justify-between text-sm text-cyan-100/85">
                <span>Pode atrasar (24h)</span>
                <span className="font-semibold">{overdueRisk}</span>
              </div>
              <p className="mt-2 text-xs text-cyan-100/70">Rascunhos: {draftTasks}</p>
            </div>
          </aside>
        </div>
      </section>

      <section id="solicitacao" className="scroll-mt-20">
        <EnterpriseRequestBuilder canCreateTask={session?.user?.role === "PATRON"} />
      </section>

      {canMonitorQuests ? (
        <section id="acompanhamento" className="scroll-mt-20 space-y-3 rounded-2xl border border-slate-200/70 bg-white p-5 text-slate-900 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Acompanhamento</p>
              <h2 className="mt-1 text-2xl font-semibold">
                {isAdmin ? "Pedidos (visao geral)" : "Meus pedidos"}
              </h2>
            </div>
            <Link
              href={isPatron ? "/create-mission" : "/admin"}
              className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              {isPatron ? "Abrir formulario completo" : "Abrir painel admin"}
            </Link>
          </div>

          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Abertas: {openTasks}</p>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Sendo feitas: {assignedTasks}</p>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Aguardando resposta: {reviewTasks}</p>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Finalizadas: {completedTasks}</p>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Total: {trackedTotal}</p>
          </div>

          <MissionPreviewGrid
            missions={recentQuests.map((quest) => ({
              id: quest.id,
              href: `/mission/${quest.id}`,
              title: quest.title,
              summary: `${quest.scope} Atualizado em ${quest.updatedAt.toLocaleString("pt-BR")}.`,
              categoryLabel: quest.categoryLabel,
              categoryIcon: quest.categoryIcon,
              statusLabel: statusMeta[quest.status].label,
              statusChipClassName: statusMeta[quest.status].chip,
              rank: quest.rank,
              neighborhood: quest.neighborhood,
              city: quest.city,
              state: quest.state,
              patronName: quest.assignedUser?.nick ?? quest.assignedUser?.email ?? "aguardando aventureiro",
              deadlineLabel: quest.deadlineAt.toLocaleString("pt-BR"),
              enchantiun: quest.enchantiun,
              dropName: quest.dropName,
              dropIconPath: quest.dropIconPath,
              secondaryLabel: "Acompanhamento enterprise",
            }))}
            emptyMessage="Voce ainda nao criou pedidos."
          />
        </section>
      ) : (
        <section id="acompanhamento" className="scroll-mt-20 rounded-2xl border border-slate-200/70 bg-white p-5 text-slate-900 shadow-sm">
          <h2 className="text-xl font-semibold">Acompanhar pedidos</h2>
          <p className="mt-2 text-sm text-slate-600">
            Entre com seu login para criar pedidos e ver o andamento.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/login?callbackUrl=/enterprise" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Entrar no enterprise
            </Link>
          </div>
        </section>
      )}

      {session?.user?.role === "ADMIN" && (
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p>
            Para moderacao, aprovacoes e exportacao completa, use o painel dedicado em{" "}
            <Link href="/admin" className="font-semibold text-cyan-700 hover:text-cyan-600">
              /admin
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
