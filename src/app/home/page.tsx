export const dynamic = "force-dynamic";

import Image from "next/image";
import { MissionCategory, MissionStatus, RankName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { alphaCategoryMeta, PIRACICABA_NEIGHBORHOODS } from "@/lib/mission-catalog";
import { missionCategoryIcons } from "@/lib/quest-icons";
import { getMissionRewardPreview } from "@/lib/mission-rewards";
import { MissionBoard } from "@/components/app/mission-board";

type SearchParams = {
  category?: string;
  minRank?: string;
  deadline?: string;
  neighborhood?: string;
  q?: string;
};

function getDeadlineFilter(value?: string) {
  const now = Date.now();
  if (value === "24h") return { lte: new Date(now + 24 * 60 * 60 * 1000) };
  if (value === "48h") return { lte: new Date(now + 48 * 60 * 60 * 1000) };
  if (value === "72h") return { lte: new Date(now + 72 * 60 * 60 * 1000) };
  if (value === "week") return { lte: new Date(now + 7 * 24 * 60 * 60 * 1000) };
  return undefined;
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerAuthSession();
  const isAdventurer = session?.user?.role === "ADVENTURER";
  const category = searchParams.category as MissionCategory | undefined;
  const minRank = searchParams.minRank as "E" | "D" | "C" | "B" | "A" | "S" | undefined;
  const deadline = searchParams.deadline;
  const neighborhood = searchParams.neighborhood;
  const query = searchParams.q;

  const missions = await prisma.mission.findMany({
    where: {
      status: MissionStatus.OPEN,
      city: "Piracicaba",
      state: "SP",
      ...(category ? { category } : {}),
      ...(minRank ? { minRank } : {}),
      ...(neighborhood ? { neighborhood } : {}),
      ...(getDeadlineFilter(deadline) ? { deadlineAt: getDeadlineFilter(deadline) } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { scope: { contains: query, mode: "insensitive" } },
              { narrative: { contains: query, mode: "insensitive" } },
              { rpgTitle: { contains: query, mode: "insensitive" } },
              { rpgNarrative: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { patron: { select: { nick: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const statusLabels: Record<MissionStatus, string> = {
    DRAFT: "Rascunho",
    OPEN: "Aberta",
    ASSIGNED: "Atribuida",
    IN_REVIEW: "Em revisao",
    REVISION_REQUESTED: "Revisao pedida",
    COMPLETED: "Concluida",
    DISPUTED: "Em disputa",
    CANCELLED: "Cancelada",
  };

  const boardMissions = missions.map((mission) => {
    const rewardPreview = getMissionRewardPreview(mission.id, mission.minRank);
    return {
      id: mission.id,
      displayTitle: isAdventurer ? mission.rpgTitle ?? mission.title : mission.title,
      displaySummary: isAdventurer ? mission.rpgNarrative ?? mission.narrative : mission.scope,
      categoryLabel: alphaCategoryMeta[mission.category].label,
      categoryIcon: missionCategoryIcons[mission.category],
      status: mission.status,
      statusLabel: statusLabels[mission.status],
      rank: mission.minRank,
      neighborhood: mission.neighborhood,
      city: mission.city,
      state: mission.state,
      patronName: mission.patron.nick ?? mission.patron.name ?? "Patrono",
      deadlineLabel: new Date(mission.deadlineAt).toLocaleString("pt-BR"),
      enchantiun: rewardPreview.enchantiun,
      dropName: rewardPreview.drop?.name ?? null,
      dropIconPath: rewardPreview.drop?.iconPath ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <section className="relative min-h-[154px] overflow-hidden rounded-2xl md:min-h-[186px]">
        <div className="absolute inset-0 bg-[url('/assets/fundo_quadro.png')] bg-no-repeat bg-center [background-size:112%_112%]" />
        <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(245,221,181,0.26),rgba(245,221,181,0.12)_46%,transparent_76%)]" />
        <div className="relative flex min-h-[154px] flex-col justify-center p-4 md:min-h-[186px] md:p-9">
          <h1 className="inline-flex items-center gap-2 text-2xl font-black text-[#e7ba58] [text-shadow:0_2px_6px_rgba(0,0,0,0.82)] sm:text-3xl md:gap-3 md:text-5xl">
            <Image src="/assets/icones/Misc/Map.png" alt="" aria-hidden width={36} height={36} className="h-8 w-8 object-contain md:h-9 md:w-9" />
            Quadro Ativo da Guilda
          </h1>
        </div>
      </section>

      <form className="quest-panel quest-panel-texture grid gap-2 rounded-2xl border border-amber-200/30 bg-[#161013]/90 p-3 md:grid-cols-5">
        <input name="q" defaultValue={query ?? ""} placeholder="Buscar missao" className="rounded-md border border-amber-100/20 bg-black/35 px-3 py-2 text-sm text-amber-50" />
        <select name="category" defaultValue={category ?? ""} className="rounded-md border border-amber-100/20 bg-black/35 p-2 text-sm text-amber-50">
          <option value="">Todas categorias</option>
          {Object.entries(alphaCategoryMeta).map(([value, item]) => (
            <option key={value} value={value}>
              {item.label} ({item.skin})
            </option>
          ))}
        </select>
        <select name="neighborhood" defaultValue={neighborhood ?? ""} className="rounded-md border border-amber-100/20 bg-black/35 p-2 text-sm text-amber-50">
          <option value="">Todos bairros</option>
          {PIRACICABA_NEIGHBORHOODS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select name="minRank" defaultValue={minRank ?? ""} className="rounded-md border border-amber-100/20 bg-black/35 p-2 text-sm text-amber-50">
          <option value="">Qualquer rank</option>
          {Object.values(RankName).map((item) => <option key={item} value={item}>{item}+</option>)}
        </select>
        <select name="deadline" defaultValue={deadline ?? ""} className="rounded-md border border-amber-100/20 bg-black/35 p-2 text-sm text-amber-50">
          <option value="">Qualquer prazo</option>
          <option value="24h">24h</option>
          <option value="48h">48h</option>
          <option value="72h">72h</option>
          <option value="week">Esta semana</option>
        </select>
        <button className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black md:col-span-5">Aplicar filtros</button>
      </form>

      <MissionBoard missions={boardMissions} viewerRole={session?.user?.role ?? null} />
    </div>
  );
}
