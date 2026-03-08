"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { missionMetaIcons } from "@/lib/quest-icons";

export type MissionPreviewItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  categoryLabel: string;
  categoryIcon: string;
  statusLabel: string;
  statusChipClassName?: string;
  rank: "E" | "D" | "C" | "B" | "A" | "S";
  neighborhood: string;
  city: string;
  state: string;
  patronName: string;
  deadlineLabel: string;
  enchantiun?: number;
  dropName?: string | null;
  dropIconPath?: string | null;
  secondaryLabel?: string;
};

type MissionPreviewGridProps = {
  missions: MissionPreviewItem[];
  emptyMessage?: string;
};

const rankStyle: Record<MissionPreviewItem["rank"], { chip: string; glow: string }> = {
  E: {
    chip: "border-slate-300/50 bg-slate-700/90 text-slate-100",
    glow: "shadow-[0_0_16px_rgba(148,163,184,0.34)]",
  },
  D: {
    chip: "border-emerald-300/50 bg-emerald-700/90 text-emerald-100",
    glow: "shadow-[0_0_16px_rgba(16,185,129,0.34)]",
  },
  C: {
    chip: "border-sky-300/50 bg-sky-700/90 text-sky-100",
    glow: "shadow-[0_0_16px_rgba(56,189,248,0.34)]",
  },
  B: {
    chip: "border-violet-300/50 bg-violet-700/90 text-violet-100",
    glow: "shadow-[0_0_16px_rgba(167,139,250,0.34)]",
  },
  A: {
    chip: "border-amber-300/50 bg-amber-700/90 text-amber-100",
    glow: "shadow-[0_0_16px_rgba(251,191,36,0.35)]",
  },
  S: {
    chip: "border-fuchsia-300/50 bg-fuchsia-700/90 text-fuchsia-100",
    glow: "shadow-[0_0_16px_rgba(217,70,239,0.36)]",
  },
};

const defaultStatusChip = "border-amber-300/35 bg-amber-900/35 text-amber-100";

export function MissionPreviewGrid({ missions, emptyMessage = "Nenhuma missao para exibir." }: MissionPreviewGridProps) {
  const [activeId, setActiveId] = useState<string | null>(missions[0]?.id ?? null);
  const [popupId, setPopupId] = useState<string | null>(null);

  if (missions.length === 0) {
    return <p className="rounded-md border border-amber-100/20 bg-black/20 p-3 text-sm text-amber-100/80">{emptyMessage}</p>;
  }

  return (
    <section className="space-y-3" onMouseLeave={() => setPopupId(null)}>
      <div className="grid gap-2 md:hidden">
        {missions.map((mission) => (
          <article key={`mobile-${mission.id}`} className="rounded-lg border border-amber-100/20 bg-black/30 p-3 text-amber-100">
            <div className="flex items-center gap-2">
              <Image src={mission.categoryIcon} alt="" aria-hidden width={18} height={18} className="h-4 w-4 object-contain" />
              <p className="line-clamp-1 text-sm font-semibold">{mission.title}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-amber-100/85">{mission.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] font-bold">
              <span className={`rounded-full border px-2 py-0.5 ${rankStyle[mission.rank].chip}`}>Rank {mission.rank}</span>
              <span className={`rounded-full border px-2 py-0.5 ${mission.statusChipClassName ?? defaultStatusChip}`}>{mission.statusLabel}</span>
              {mission.secondaryLabel && (
                <span className="rounded-full border border-cyan-200/30 bg-cyan-950/40 px-2 py-0.5 text-cyan-100">{mission.secondaryLabel}</span>
              )}
            </div>
            <Link
              href={mission.href}
              className="mt-2 inline-flex rounded-md border border-amber-300/35 bg-amber-900/25 px-2.5 py-1 text-xs font-semibold hover:bg-amber-900/40"
            >
              Ver detalhes
            </Link>
          </article>
        ))}
      </div>

      <div className="relative hidden rounded-xl border border-amber-100/20 bg-black/20 p-3 md:block">
        <div className="grid grid-cols-6 gap-2 lg:grid-cols-8 xl:grid-cols-10">
          {missions.map((mission, index) => {
            const isActive = mission.id === activeId;
            const isPopupOpen = popupId === mission.id;
            const col = index % 10;
            const popupToRight = col <= 4;
            return (
              <div key={mission.id} className="relative">
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
                  className={`relative flex h-16 w-full items-center justify-center rounded-md border border-amber-100/25 bg-black/40 transition ${
                    isActive ? `${rankStyle[mission.rank].glow} ring-2 ring-amber-300/45` : "hover:-translate-y-0.5"
                  }`}
                  aria-label={mission.title}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Image src={mission.categoryIcon} alt="" aria-hidden width={16} height={16} className="h-4 w-4 object-contain" />
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${rankStyle[mission.rank].chip}`}>{mission.rank}</span>
                  </div>
                </button>

                {isPopupOpen && (
                  <div
                    className={`absolute top-1/2 z-30 -translate-y-1/2 ${
                      popupToRight ? "left-full ml-2" : "right-full mr-2"
                    }`}
                  >
                    <article className="w-[min(92vw,360px)] rounded-xl border border-amber-200/30 bg-[#1a1317] p-4 text-amber-100 shadow-2xl">
                      <h3 className="line-clamp-2 text-sm font-bold">{mission.title}</h3>
                      <p className="mt-1 line-clamp-5 text-xs text-amber-100/85">{mission.summary}</p>

                      <div className="mt-3 grid gap-1 text-[11px] text-amber-100/85">
                        <p className="inline-flex items-center gap-1.5">
                          <Image src={missionMetaIcons.patron} alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                          Patrono: {mission.patronName}
                        </p>
                        <p className="inline-flex items-center gap-1.5">
                          <Image src={missionMetaIcons.location} alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                          {mission.city}/{mission.state} - {mission.neighborhood}
                        </p>
                        <p className="inline-flex items-center gap-1.5">
                          <Image src={missionMetaIcons.deadline} alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                          Prazo: {mission.deadlineLabel}
                        </p>
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
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-900/30 px-2 py-1">
                          <Image src={mission.categoryIcon} alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                          {mission.categoryLabel}
                        </span>
                        <span className={`rounded-full border px-2 py-1 ${rankStyle[mission.rank].chip}`}>Rank {mission.rank}</span>
                        <span className={`rounded-full border px-2 py-1 ${mission.statusChipClassName ?? defaultStatusChip}`}>{mission.statusLabel}</span>
                        {mission.secondaryLabel && (
                          <span className="rounded-full border border-cyan-200/30 bg-cyan-950/40 px-2 py-1 text-cyan-100">{mission.secondaryLabel}</span>
                        )}
                        {typeof mission.enchantiun === "number" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-700/40 bg-cyan-300/35 px-2 py-1 text-cyan-950">
                            <Image src="/assets/Crystal.png" alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                            +{mission.enchantiun}
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <Link
                          href={mission.href}
                          className="inline-flex rounded-md border border-amber-300/40 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold hover:bg-amber-900/45"
                        >
                          Ver detalhes
                        </Link>
                      </div>
                    </article>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
