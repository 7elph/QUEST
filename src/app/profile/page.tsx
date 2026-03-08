export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { getRankByXP } from "@/lib/xp";
import { computePerformanceScore } from "@/lib/ranking";
import { AdventurerAssessment } from "@/components/app/adventurer-assessment";
import { storeCatalog } from "@/lib/store";
import { getMissionRewardPreview } from "@/lib/mission-rewards";
import { ProfileCharacterViewer } from "@/components/app/profile-character-viewer";

const rankTargets = [
  { rank: "E", minXP: 0, nextRank: "D", nextMinXP: 100 },
  { rank: "D", minXP: 100, nextRank: "C", nextMinXP: 300 },
  { rank: "C", minXP: 300, nextRank: "B", nextMinXP: 700 },
  { rank: "B", minXP: 700, nextRank: "A", nextMinXP: 1300 },
  { rank: "A", minXP: 1300, nextRank: "S", nextMinXP: 2000 },
  { rank: "S", minXP: 2000, nextRank: "S", nextMinXP: 2000 },
];

const founderInventoryMeta: Record<string, { name: string; iconPath: string; type: string; description: string }> = {
  Iniciado: {
    name: "Selo Iniciado",
    iconPath: "/assets/icones/Misc/Heart.png",
    type: "FOUNDER",
    description: "Apoio inicial confirmado no Alpha.",
  },
  Fundador: {
    name: "Selo Fundador",
    iconPath: "/assets/icones/Misc/Book.png",
    type: "FOUNDER",
    description: "Apoio fundador confirmado no Alpha.",
  },
  "Patrono Inicial": {
    name: "Selo Patrono Inicial",
    iconPath: "/assets/icones/Misc/Chest.png",
    type: "FOUNDER",
    description: "Apoio premium confirmado no Alpha.",
  },
};

const missionStatusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberta",
  ASSIGNED: "Atribuida",
  IN_REVIEW: "Em revisao",
  REVISION_REQUESTED: "Revisao",
  COMPLETED: "Concluida",
  DISPUTED: "Disputa",
  CANCELLED: "Cancelada",
};

const rankCharacterModel: Record<"E" | "D" | "C" | "B" | "A" | "S", string> = {
  E: "/assets/personagens/Characters/gltf/Rogue.glb",
  D: "/assets/personagens/Characters/gltf/Rogue_Hooded.glb",
  C: "/assets/personagens/Characters/gltf/Ranger.glb",
  B: "/assets/personagens/Characters/gltf/Mage.glb",
  A: "/assets/personagens/Characters/gltf/Knight.glb",
  S: "/assets/personagens/Characters/gltf/Barbarian.glb",
};

function getRankProgress(xp: number, rank: string) {
  const current = rankTargets.find((item) => item.rank === rank) ?? rankTargets[0];
  if (current.rank === "S") {
    return { nextRank: "S", needed: 0, progressPct: 100 };
  }
  const base = current.minXP;
  const span = current.nextMinXP - base;
  const value = Math.max(0, xp - base);
  return {
    nextRank: current.nextRank,
    needed: Math.max(0, current.nextMinXP - xp),
    progressPct: Math.max(0, Math.min(100, Math.round((value / span) * 100))),
  };
}

export default async function ProfilePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return (
      <section className="quest-panel quest-panel-solid rounded-2xl border border-amber-200/25 bg-black/30 p-6">
        <h1 className="text-2xl font-semibold text-amber-100">Sessao necessaria</h1>
        <p className="mt-2 text-sm text-amber-100/80">Faca login para acessar seu centro de comando e suas missoes.</p>
        <Link href="/login?callbackUrl=/profile" className="mt-4 inline-flex rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400">
          Entrar no perfil
        </Link>
      </section>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      xpLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      submissions: {
        include: {
          mission: {
            select: {
              id: true,
              title: true,
              deadlineAt: true,
              status: true,
              dispute: { select: { id: true } },
            },
          },
        },
        take: 20,
        orderBy: { submittedAt: "desc" },
      },
      missionProgresses: {
        include: { mission: { select: { id: true, title: true, status: true } } },
        take: 12,
        orderBy: { updatedAt: "desc" },
      },
      notifications: { where: { readAt: null }, take: 20 },
      assessment: true,
    },
  });

  if (!user) {
    return <p>Usuario nao encontrado.</p>;
  }

  const myMissions = await prisma.mission.findMany({
    where:
      session.user.role === "PATRON"
        ? { patronId: session.user.id }
        : { assignedTo: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      rpgTitle: true,
      status: true,
      deadlineAt: true,
      minRank: true,
      neighborhood: true,
      updatedAt: true,
    },
  });

  const xp = user.xpLogs.reduce((sum, item) => sum + item.xpChange, 0);
  const rank = getRankByXP(xp);
  const rankProgress = getRankProgress(xp, rank);

  const accepted = user.submissions.filter((item) => item.status === "ACCEPTED");
  const onTime = accepted.filter((item) => item.submittedAt <= item.mission.deadlineAt);
  const disputes = user.submissions.filter((item) => !!item.mission.dispute).length;
  const activeProgress = user.missionProgresses
    .filter((item) => item.mission.status !== "COMPLETED")
    .slice(0, 6);

  const perf = computePerformanceScore({
    completed: accepted.length,
    accepted: accepted.length,
    totalSubmissions: user.submissions.length,
    onTime: onTime.length,
    disputes,
  });

  const roleLabel =
    session.user.role === "ADVENTURER"
      ? "Aventureiro"
      : session.user.role === "PATRON"
        ? "Patrono"
        : "Admin";
  const missionStepByStep =
    session.user.role === "PATRON"
      ? [
          "1. Crie a missao dizendo o que quer pronto.",
          "2. Publique e espere um aventureiro aceitar.",
          "3. Veja a prova enviada e peca ajuste se precisar.",
          "4. Aprove quando estiver certo.",
          "5. Se der problema, abra disputa.",
        ]
      : session.user.role === "ADMIN"
        ? [
            "1. Veja pedidos pendentes de aprovacao.",
            "2. Ajuste status dos usuarios quando necessario.",
            "3. Resolva disputas com base nas provas.",
            "4. Confirme pagamentos manuais do Alpha.",
            "5. Acompanhe os testes da LLM.",
          ]
        : [
            "1. Aceite uma missao aberta no quadro.",
            "2. Execute os itens do checklist de vitoria.",
            "3. Envie prova por link ou arquivo.",
            "4. Acompanhe revisao e ajuste quando solicitado.",
            "5. Conclua para receber XP, Enchantiun e possiveis drops.",
          ];
  const name = user.nick ?? user.name ?? "Usuario";
  const profileBadges = user.profile?.badges ?? [];
  const badgeCountMap = profileBadges.reduce<Record<string, number>>((acc, badge) => {
    acc[badge] = (acc[badge] ?? 0) + 1;
    return acc;
  }, {});
  const storeBadgeMap = new Map(storeCatalog.map((item) => [item.badge, item] as const));
  const inventoryItems = Object.entries(badgeCountMap)
    .map(([badge, count]) => {
      const storeItem = storeBadgeMap.get(badge);
      if (storeItem) {
        return {
          id: badge,
          name: storeItem.name,
          type: storeItem.type,
          description: storeItem.effect,
          iconPath: storeItem.iconPath,
          count,
        };
      }

      const founder = founderInventoryMeta[badge];
      if (founder) {
        return {
          id: badge,
          name: founder.name,
          type: founder.type,
          description: founder.description,
          iconPath: founder.iconPath,
          count,
        };
      }

      return {
        id: badge,
        name: badge,
        type: "COLECIONAVEL",
        description: "Item registrado no historico da conta.",
        iconPath: "/assets/icones/Equipment/Bag.png",
        count,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const enchantiunBalance = xp;
  const avatarSrc = user.profile?.avatarUrl?.startsWith("/")
    ? user.profile.avatarUrl
    : "/assets/icones/Equipment/Wizard Hat.png";
  const configuredModel = user.profile?.avatarUrl?.toLowerCase().endsWith(".glb")
    ? user.profile.avatarUrl
    : null;
  const characterModelSrc = configuredModel ?? rankCharacterModel[rank];
  const healthCap = rank === "S" ? 2500 : (rankTargets.find((item) => item.rank === rank)?.nextMinXP ?? 2000);
  const healthPct = Math.max(5, Math.min(100, Math.round((enchantiunBalance / healthCap) * 100)));
  const staminaPct = Math.max(10, Math.min(100, Math.round(perf.punctuality * 100)));

  return (
    <div className="space-y-6">
      <section className="quest-panel quest-panel-solid rounded-2xl border border-amber-200/30 bg-[linear-gradient(120deg,rgba(24,17,14,0.88),rgba(15,12,13,0.9))] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="quest-panel quest-panel-texture rounded-xl border border-amber-200/30 bg-black/35 p-3">
              <div className="mx-auto h-[112px] w-[112px]">
                <ProfileCharacterViewer
                  modelSrc={characterModelSrc}
                  posterSrc={avatarSrc}
                  alt={`Personagem de perfil de ${name}`}
                />
              </div>
              <p className="mt-2 text-center text-xs text-amber-100/80">Avatar vivo</p>
            </div>
            <div>
              <p className="text-xs tracking-[0.18em] text-amber-200/80">PERFIL DO AVENTUREIRO</p>
              <h1 className="mt-2 text-3xl font-semibold text-amber-100">{name}</h1>
              <p className="mt-1 text-sm text-amber-100/80">{user.email} - {roleLabel}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1 text-amber-100">
                  Rank {rank}
                </span>
                <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1 text-amber-100">
                  {xp} XP
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-500/12 px-3 py-1 text-cyan-100">
                  <Image src="/assets/Crystal.png" alt="" aria-hidden width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                  {enchantiunBalance} Enchantiun
                </span>
                <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1 text-amber-100">
                  Notificacoes: {user.notifications.length}
                </span>
              </div>
            </div>
          </div>

          <div className="quest-panel quest-panel-texture w-full rounded-xl border border-amber-200/30 bg-black/30 p-4 md:min-w-[290px] md:w-auto">
            <p className="text-xs uppercase tracking-wider text-amber-200/80">Atributos</p>
            <p className="mt-1 text-sm text-amber-100/90">Rank: {rank} - Proximo: {rankProgress.nextRank}</p>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-rose-200/90">
                <span>Saude</span>
                <span>{enchantiunBalance}/{healthCap}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-900/80">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${healthPct}%` }} />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-cyan-200/90">
                <span>Energia</span>
                <span>{staminaPct}%</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-900/80">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${staminaPct}%` }} />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-amber-200/90">
                <span>Progresso de rank</span>
                <span>{rankProgress.progressPct}%</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-900/80">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${rankProgress.progressPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        <div className="quest-panel quest-panel-solid rounded-xl border border-amber-200/20 bg-black/25 p-3">
          <p className="text-xs text-amber-100/70">Score</p>
          <p className="text-2xl font-semibold text-amber-100">{perf.score}</p>
        </div>
        <div className="quest-panel quest-panel-texture rounded-xl border border-amber-200/20 bg-black/25 p-3">
          <p className="text-xs text-amber-100/70">Pontualidade</p>
          <p className="text-2xl font-semibold text-amber-100">{(perf.punctuality * 100).toFixed(0)}%</p>
        </div>
        <div className="quest-panel quest-panel-solid rounded-xl border border-amber-200/20 bg-black/25 p-3">
          <p className="text-xs text-amber-100/70">Qualidade</p>
          <p className="text-2xl font-semibold text-amber-100">{(perf.quality * 100).toFixed(0)}%</p>
        </div>
        <div className="quest-panel quest-panel-texture rounded-xl border border-amber-200/20 bg-black/25 p-3">
          <p className="text-xs text-amber-100/70">Concluidas</p>
          <p className="text-2xl font-semibold text-amber-100">{accepted.length}</p>
        </div>
        <div className="quest-panel quest-panel-solid rounded-xl border border-amber-200/20 bg-black/25 p-3">
          <p className="text-xs text-amber-100/70">Disputas</p>
          <p className="text-2xl font-semibold text-amber-100">{disputes}</p>
        </div>
      </section>

      <section className="quest-panel quest-panel-texture rounded-xl border border-amber-200/20 bg-black/25 p-5">
        <h2 className="text-lg font-semibold text-amber-100">Inventario</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inventoryItems.map((item) => (
            <article key={item.id} className="quest-panel quest-panel-solid rounded-lg border border-amber-100/15 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <Image src={item.iconPath} alt={item.name} width={22} height={22} className="h-[22px] w-[22px] object-contain" />
                <p className="text-sm font-semibold text-amber-100">{item.name}</p>
              </div>
              <p className="mt-1 text-xs text-amber-200/80">{item.type}</p>
              <p className="mt-1 text-xs text-amber-100/75">{item.description}</p>
              <p className="mt-2 text-xs font-semibold text-cyan-200">Quantidade: x{item.count}</p>
            </article>
          ))}
          {inventoryItems.length === 0 && (
            <p className="text-sm text-amber-100/75">Sem itens no inventario ainda.</p>
          )}
        </div>
      </section>

      <section id="missoes" className="quest-panel quest-panel-texture rounded-xl border border-amber-200/20 bg-black/25 p-5">
        <h2 className="text-lg font-semibold text-amber-100">Minhas missoes</h2>
        <details className="mt-3 rounded-lg border border-amber-200/25 bg-black/25 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-amber-100">O que eu consigo fazer com as missoes (passo a passo)</summary>
          <div className="mt-3 grid gap-1 text-sm text-amber-100/85">
            {missionStepByStep.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </details>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {myMissions.map((mission) => {
            const rewardPreview = getMissionRewardPreview(mission.id, mission.minRank);
            const displayTitle = session.user.role === "ADVENTURER" ? mission.rpgTitle ?? mission.title : mission.title;
            return (
              <article key={mission.id} className="relative aspect-[210/300] overflow-hidden">
                <div className="absolute inset-0 bg-[url('/assets/fundo_missao.png')] bg-no-repeat bg-center [background-size:100%_100%]" />
                <div className="relative flex h-full flex-col justify-center p-5 text-[#1b130f]">
                  <h3 className="line-clamp-2 text-base font-extrabold leading-tight [text-shadow:0_1px_2px_rgba(255,237,200,0.75)]">
                    {displayTitle}
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className="rounded-full border border-amber-900/35 bg-[#f5e3bf]/92 px-2 py-1">
                      {missionStatusLabel[mission.status] ?? mission.status}
                    </span>
                    <span className="rounded-full border border-amber-900/35 bg-[#f5e3bf]/92 px-2 py-1">Rank {mission.minRank}</span>
                    <span className="rounded-full border border-amber-900/35 bg-[#f5e3bf]/92 px-2 py-1">{mission.neighborhood}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-700/40 bg-cyan-300/35 px-2 py-1 text-cyan-950">
                      <Image src="/assets/Crystal.png" alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                      +{rewardPreview.enchantiun}
                    </span>
                  </div>

                  <div className="mt-3 text-[11px] font-bold leading-relaxed [text-shadow:0_1px_2px_rgba(255,237,200,0.66)]">
                    <p>Prazo: {new Date(mission.deadlineAt).toLocaleString("pt-BR")}</p>
                    <p>Atualizada: {new Date(mission.updatedAt).toLocaleString("pt-BR")}</p>
                  </div>

                  <div className="mt-2">
                    <Link
                      href={`/mission/${mission.id}`}
                      className="inline-flex rounded-md border border-amber-900/40 bg-[#f5e3bf]/90 px-3 py-1.5 text-xs font-bold text-[#1a100b] hover:bg-[#f8e9cc]"
                    >
                      Detalhes da missao
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
          {myMissions.length === 0 && <p className="text-sm text-amber-100/75">Sem missoes vinculadas por enquanto.</p>}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <article className="quest-panel quest-panel-texture rounded-xl border border-amber-200/20 bg-black/25 p-5">
          <h2 className="text-lg font-semibold text-amber-100">Habilidades</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(user.profile?.skills ?? []).length > 0 ? (
              (user.profile?.skills ?? []).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-amber-300/35 bg-amber-500/12 px-3 py-1 text-xs text-amber-100"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-sm text-amber-100/75">Sem habilidades mapeadas ainda.</span>
            )}
          </div>
        </article>

        <article className="quest-panel quest-panel-solid rounded-xl border border-amber-200/20 bg-black/25 p-5">
          <h2 className="text-lg font-semibold text-amber-100">Andamento pratico</h2>
          <div className="mt-3 space-y-2">
            {activeProgress.length > 0 ? (
              activeProgress.map((item) => (
                <div key={item.id} className="quest-panel quest-panel-texture rounded-md border border-amber-100/15 bg-black/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/mission/${item.mission.id}`} className="text-sm font-medium text-amber-100 hover:text-amber-200">
                      {item.mission.title}
                    </Link>
                    <span className="text-xs text-amber-100/75">{item.completionPct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-900/80">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${item.completionPct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-amber-100/70">
                    Atualizado em {new Date(item.updatedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-amber-100/75">Sem missoes em andamento no momento.</p>
            )}
          </div>
        </article>
      </section>

      {session.user.role === "ADVENTURER" && (
        <div id="assessment">
          <AdventurerAssessment
            initialAssessment={
              user.assessment
                ? {
                    id: user.assessment.id,
                    resultProfile: user.assessment.resultProfile,
                    dominantSkills: user.assessment.dominantSkills,
                    skillScores: (user.assessment.skillScores as Record<string, number>) ?? {},
                    completedAt: user.assessment.completedAt.toISOString(),
                  }
                : null
            }
          />
        </div>
      )}

      <section className="quest-panel quest-panel-texture rounded-xl border border-amber-200/20 bg-black/25 p-5">
        <h3 className="font-semibold text-amber-100">Historico de XP</h3>
        <div className="mt-3 space-y-2 text-sm">
          {user.xpLogs.map((log) => (
            <div key={log.id} className="quest-panel quest-panel-solid rounded-md border border-amber-100/10 bg-black/30 px-3 py-2">
              <p className="text-amber-100">{log.reason}</p>
              <p className="text-xs text-amber-100/70">
                {new Date(log.createdAt).toLocaleDateString("pt-BR")} - {log.xpChange > 0 ? "+" : ""}
                {log.xpChange} XP
              </p>
            </div>
          ))}
          {user.xpLogs.length === 0 && <p className="text-amber-100/70">Sem historico de XP ainda.</p>}
        </div>
      </section>

    </div>
  );
}
