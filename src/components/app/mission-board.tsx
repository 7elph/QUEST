"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type MissionBoardItem = {
  id: string;
  displayTitle: string;
  displaySummary: string;
  categoryLabel: string;
  categoryIcon: string;
  status: "DRAFT" | "OPEN" | "ASSIGNED" | "IN_REVIEW" | "REVISION_REQUESTED" | "COMPLETED" | "DISPUTED" | "CANCELLED";
  statusLabel: string;
  rank: "E" | "D" | "C" | "B" | "A" | "S";
  neighborhood: string;
  city: string;
  state: string;
  patronName: string;
  deadlineLabel: string;
  enchantiun: number;
  dropName: string | null;
  dropIconPath: string | null;
};

type MissionBoardProps = {
  missions: MissionBoardItem[];
  viewerRole: "ADVENTURER" | "PATRON" | "ADMIN" | null;
};

const desktopPageSize = 18;
const mobilePageSize = 12;
const boardSlotsClass = "absolute left-[18.2%] top-[25.6%] h-[52.4%] w-[63%]";

const rankStyle: Record<MissionBoardItem["rank"], { chip: string; glow: string }> = {
  E: {
    chip: "border-slate-300/50 bg-slate-700/90 text-slate-100",
    glow: "shadow-[0_0_18px_rgba(148,163,184,0.32)]",
  },
  D: {
    chip: "border-emerald-300/50 bg-emerald-700/90 text-emerald-100",
    glow: "shadow-[0_0_18px_rgba(16,185,129,0.33)]",
  },
  C: {
    chip: "border-sky-300/50 bg-sky-700/90 text-sky-100",
    glow: "shadow-[0_0_18px_rgba(56,189,248,0.33)]",
  },
  B: {
    chip: "border-violet-300/50 bg-violet-700/90 text-violet-100",
    glow: "shadow-[0_0_18px_rgba(167,139,250,0.33)]",
  },
  A: {
    chip: "border-amber-300/50 bg-amber-700/90 text-amber-100",
    glow: "shadow-[0_0_18px_rgba(251,191,36,0.35)]",
  },
  S: {
    chip: "border-fuchsia-300/50 bg-fuchsia-700/90 text-fuchsia-100",
    glow: "shadow-[0_0_18px_rgba(217,70,239,0.36)]",
  },
};

export function MissionBoard({ missions, viewerRole }: MissionBoardProps) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [page, setPage] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(missions[0]?.id ?? null);
  const [popupId, setPopupId] = useState<string | null>(null);
  const [loadingAccept, setLoadingAccept] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const pageSize = isMobile ? mobilePageSize : desktopPageSize;
  const pageCount = Math.max(1, Math.ceil(missions.length / pageSize));
  const visible = useMemo(
    () => missions.slice(page * pageSize, page * pageSize + pageSize),
    [missions, page, pageSize],
  );
  const activeMission = useMemo(
    () => visible.find((mission) => mission.id === activeId) ?? visible[0] ?? null,
    [activeId, visible],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncMobileState = () => setIsMobile(mediaQuery.matches);
    syncMobileState();
    mediaQuery.addEventListener("change", syncMobileState);
    return () => mediaQuery.removeEventListener("change", syncMobileState);
  }, []);

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(0);
      return;
    }
    const firstVisible = missions.slice(page * pageSize, page * pageSize + pageSize)[0];
    if (!firstVisible) {
      setActiveId(null);
      return;
    }
    const stillVisible = visible.some((mission) => mission.id === activeId);
    if (!stillVisible) {
      setActiveId(firstVisible.id);
    }
  }, [activeId, missions, page, pageCount, pageSize, visible]);

  const acceptMission = async (missionId: string) => {
    setFeedback("");
    setLoadingAccept(missionId);
    try {
      const response = await fetch(`/api/missions/${missionId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(data.error ?? "Falha ao aceitar missao.");
        return;
      }
      setFeedback("Missao aceita com sucesso. Redirecionando para seu perfil...");
      setPopupId(null);
      router.push("/profile#missoes");
      router.refresh();
    } finally {
      setLoadingAccept(null);
    }
  };

  if (missions.length === 0) {
    return <p className="text-sm text-amber-100/80">Nenhuma missao encontrada com esses filtros.</p>;
  }

  return (
    <section className="space-y-4" onMouseLeave={() => setPopupId(null)}>
      <div className="grid gap-2 md:hidden">
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl">
          <Image
            src="/assets/quadro_guilda.png"
            alt="Quadro da guilda com missoes"
            fill
            priority
            className="object-contain"
          />
          <div className={boardSlotsClass}>
            <div className="h-full w-full p-[0.55%]">
              <div className="grid h-full grid-cols-6 grid-rows-2 gap-[2px]">
              {visible.map((mission) => {
                const isActive = mission.id === activeId;
                return (
                  <button
                    key={`mobile-slot-${mission.id}`}
                    type="button"
                    onClick={() => setActiveId(mission.id)}
                    className={`relative h-full w-full overflow-hidden rounded-sm transition duration-150 ${
                      isActive ? `${rankStyle[mission.rank].glow} ring-2 ring-amber-300/45` : ""
                    }`}
                    aria-label={`Missao rank ${mission.rank}`}
                  >
                    <div className="absolute inset-0 bg-[url('/assets/fundo_missao.png')] bg-no-repeat bg-center [background-size:100%_100%]" />
                    <div className="absolute inset-0 bg-black/8" />
                    <div className="relative flex h-full items-center justify-center p-1">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-extrabold ${rankStyle[mission.rank].chip}`}>
                        {mission.rank}
                      </span>
                    </div>
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        </div>

        {activeMission && (
          <article className="relative aspect-[210/132] overflow-hidden">
            <div className="absolute inset-0 bg-[url('/assets/fundo_missao.png')] bg-no-repeat bg-center [background-size:100%_100%]" />
            <div className="relative flex h-full flex-col justify-center p-3 text-[#1b130f]">
              <h2 className="line-clamp-1 text-sm font-extrabold leading-tight [text-shadow:0_1px_2px_rgba(255,237,200,0.75)]">
                {activeMission.displayTitle}
              </h2>
              <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug [text-shadow:0_1px_2px_rgba(255,237,200,0.72)]">
                {activeMission.displaySummary}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-bold">
                <span className={`rounded-full border px-2 py-0.5 ${rankStyle[activeMission.rank].chip}`}>Rank {activeMission.rank}</span>
                <span className="rounded-full border border-amber-900/35 bg-[#f5e3bf]/92 px-2 py-0.5">{activeMission.neighborhood}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-700/40 bg-cyan-300/35 px-2 py-0.5 text-cyan-950">
                  <Image src="/assets/Crystal.png" alt="" aria-hidden width={11} height={11} className="h-2.5 w-2.5 object-contain" />
                  +{activeMission.enchantiun}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {viewerRole === "ADVENTURER" && activeMission.status === "OPEN" && (
                  <button
                    type="button"
                    disabled={loadingAccept === activeMission.id}
                    onClick={() => void acceptMission(activeMission.id)}
                    className="rounded-md border border-amber-900/45 bg-[#efd09a]/95 px-2.5 py-1 text-[11px] font-bold text-[#170d09] hover:bg-[#f2d9ab] disabled:opacity-55"
                  >
                    {loadingAccept === activeMission.id ? "Aceitando..." : "Aceitar"}
                  </button>
                )}
                <Link
                  href={`/mission/${activeMission.id}`}
                  className="inline-flex rounded-md border border-amber-900/40 bg-[#f5e3bf]/90 px-2.5 py-1 text-[11px] font-bold text-[#1a100b] hover:bg-[#f8e9cc]"
                >
                  Detalhes da missao
                </Link>
              </div>
            </div>
          </article>
        )}
      </div>

      <div className="relative hidden aspect-[3/2] w-full overflow-visible rounded-2xl md:block">
        <Image
          src="/assets/quadro_guilda.png"
          alt="Quadro da guilda com missoes"
          fill
          priority
          className="object-contain"
        />

        <div className={boardSlotsClass}>
          <div className="h-full w-full p-[0.55%]">
            <div className="grid h-full grid-cols-6 grid-rows-3 gap-[2px]">
            {visible.map((mission, index) => {
              const isActive = mission.id === activeId;
              const isPopupOpen = popupId === mission.id;
              const canAcceptMission = viewerRole === "ADVENTURER" && mission.status === "OPEN";
              const col = index % 6;
              const popupToRight = col <= 2;
              return (
                <div key={mission.id} className="relative h-full w-full">
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setActiveId(mission.id);
                      setPopupId(mission.id);
                    }}
                    onFocus={() => setActiveId(mission.id)}
                    onClick={() => {
                      setActiveId(mission.id);
                      setPopupId(mission.id);
                    }}
                    className={`relative h-full w-full overflow-hidden rounded-sm transition duration-150 hover:-translate-y-0.5 ${
                      isActive ? `${rankStyle[mission.rank].glow} ring-2 ring-amber-300/45` : ""
                    }`}
                    aria-label={`Missao rank ${mission.rank}`}
                  >
                    <div className="absolute inset-0 bg-[url('/assets/fundo_missao.png')] bg-no-repeat bg-center [background-size:100%_100%]" />
                    <div className="absolute inset-0 bg-black/6" />
                    <div className="relative flex h-full items-center justify-center p-2">
                      <span className={`rounded-full border px-2 py-1 text-xs font-extrabold ${rankStyle[mission.rank].chip}`}>
                        Rank {mission.rank}
                      </span>
                    </div>
                  </button>

                  {isPopupOpen && (
                    <div
                      className={`pointer-events-none absolute top-1/2 z-30 -translate-y-1/2 ${
                        popupToRight ? "left-full ml-1.5" : "right-full mr-1.5"
                      }`}
                    >
                      <article className="pointer-events-auto relative aspect-[210/330] w-[min(92vw,360px)] overflow-hidden">
                        <div className="absolute inset-0 bg-[url('/assets/fundo_missao.png')] bg-no-repeat bg-center [background-size:100%_100%]" />
                        <div className="relative flex h-full flex-col p-6 text-[#1b130f]">
                          <div className="mx-auto flex h-full w-[90%] flex-col justify-center">
                            <h2 className="line-clamp-2 text-base font-extrabold leading-tight [text-shadow:0_1px_2px_rgba(255,237,200,0.75)]">
                              {mission.displayTitle}
                            </h2>
                            <p className="mt-2 line-clamp-6 text-xs font-bold leading-relaxed [text-shadow:0_1px_2px_rgba(255,237,200,0.72)]">
                              {mission.displaySummary}
                            </p>

                            <div className="mt-3 text-[11px] font-bold leading-relaxed [text-shadow:0_1px_2px_rgba(255,237,200,0.66)]">
                              <p>Patrono: {mission.patronName}</p>
                              <p>Local: {mission.city}/{mission.state} - {mission.neighborhood}</p>
                              <p>Prazo: {mission.deadlineLabel}</p>
                              {mission.dropName && (
                                <p className="inline-flex items-center gap-1.5">
                                  {mission.dropIconPath && (
                                    <Image src={mission.dropIconPath} alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                                  )}
                                  Drop: {mission.dropName}
                                </p>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-900/35 bg-[#f5e3bf]/92 px-2 py-1">
                                <Image src={mission.categoryIcon} alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                                {mission.categoryLabel}
                              </span>
                              <span className="rounded-full border border-amber-900/35 bg-[#f5e3bf]/92 px-2 py-1">{mission.statusLabel}</span>
                              <span className={`rounded-full border px-2 py-1 ${rankStyle[mission.rank].chip}`}>Rank {mission.rank}</span>
                              <span className="rounded-full border border-amber-900/35 bg-[#f5e3bf]/92 px-2 py-1">{mission.neighborhood}</span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-700/40 bg-cyan-300/35 px-2 py-1 text-cyan-950">
                                <Image src="/assets/Crystal.png" alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                                +{mission.enchantiun}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2 pt-1">
                              {canAcceptMission && (
                                <button
                                  type="button"
                                  disabled={loadingAccept === mission.id}
                                  onClick={() => void acceptMission(mission.id)}
                                  className="rounded-md border border-amber-900/45 bg-[#efd09a]/95 px-3 py-1.5 text-xs font-bold text-[#170d09] hover:bg-[#f2d9ab] disabled:opacity-55"
                                >
                                  {loadingAccept === mission.id ? "Aceitando..." : "Aceitar missao"}
                                </button>
                              )}
                              <Link
                                href={`/mission/${mission.id}`}
                                className="inline-flex rounded-md border border-amber-900/40 bg-[#f5e3bf]/90 px-3 py-1.5 text-xs font-bold text-[#1a100b] hover:bg-[#f8e9cc]"
                              >
                                Detalhes da missao
                              </Link>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 text-xs text-amber-100/85">
          <span>Exibindo {visible.length} de {missions.length} missoes</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="rounded-md border border-amber-200/30 bg-black/25 px-2 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <span>Pagina {page + 1}/{pageCount}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={page >= pageCount - 1}
              className="rounded-md border border-amber-200/30 bg-black/25 px-2 py-1 disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>
      )}

      {feedback && <p className="text-xs text-amber-100">{feedback}</p>}
    </section>
  );
}
