"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MissionCategory } from "@prisma/client";
import { alphaCategoryMeta } from "@/lib/mission-catalog";

type RankItem = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  rank: string;
  score: number;
  xp: number;
  completed: number;
  punctuality: number;
  quality: number;
  provisional: boolean;
};

export default function RankingPage() {
  const [window, setWindow] = useState("weekly");
  const [category, setCategory] = useState("ALL");
  const [items, setItems] = useState<RankItem[]>([]);

  const rankTheme: Record<string, { card: string; chip: string; bar: string; icon: string }> = {
    E: {
      card: "border-slate-300/40 bg-slate-950/35 shadow-[0_0_25px_rgba(148,163,184,0.16)]",
      chip: "border-slate-300/45 bg-slate-700/60 text-slate-100",
      bar: "bg-slate-300",
      icon: "/assets/icones/Coin.png",
    },
    D: {
      card: "border-emerald-300/35 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.18)]",
      chip: "border-emerald-300/45 bg-emerald-700/65 text-emerald-100",
      bar: "bg-emerald-300",
      icon: "/assets/icones/GemGreen.png",
    },
    C: {
      card: "border-sky-300/35 bg-sky-950/20 shadow-[0_0_30px_rgba(56,189,248,0.2)]",
      chip: "border-sky-300/45 bg-sky-700/65 text-sky-100",
      bar: "bg-sky-300",
      icon: "/assets/icones/GemBlue.png",
    },
    B: {
      card: "border-violet-300/35 bg-violet-950/20 shadow-[0_0_30px_rgba(167,139,250,0.2)]",
      chip: "border-violet-300/45 bg-violet-700/65 text-violet-100",
      bar: "bg-violet-300",
      icon: "/assets/icones/GemYellow.png",
    },
    A: {
      card: "border-amber-300/35 bg-amber-950/20 shadow-[0_0_30px_rgba(251,191,36,0.2)]",
      chip: "border-amber-300/45 bg-amber-700/65 text-amber-100",
      bar: "bg-amber-300",
      icon: "/assets/icones/GemRed.png",
    },
    S: {
      card: "border-fuchsia-300/40 bg-fuchsia-950/20 shadow-[0_0_32px_rgba(217,70,239,0.24)]",
      chip: "border-fuchsia-300/45 bg-fuchsia-700/65 text-fuchsia-100",
      bar: "bg-fuchsia-300",
      icon: "/assets/icones/FrameRound.png",
    },
  };

  useEffect(() => {
    const query = new URLSearchParams({ window });
    if (category !== "ALL") query.set("category", category);

    fetch(`/api/ranking?${query.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(data.ranking ?? []));
  }, [window, category]);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-amber-200">Ranking de Performance</h1>
      <p className="text-sm text-amber-100/80">Ranking por score, pontualidade, qualidade e entregas concluidas.</p>
      <div className="grid gap-2 md:grid-cols-2">
        <select value={window} onChange={(e) => setWindow(e.target.value)} className="rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm">
          <option value="weekly">Ultimos 7 dias</option>
          <option value="all">Historico completo</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm">
          <option value="ALL">Todas categorias</option>
          {Object.values(MissionCategory).map((item) => (
            <option key={item} value={item}>{alphaCategoryMeta[item].label}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, idx) => (
          <article
            key={item.userId}
            className={`rounded-xl border p-3 text-sm ${rankTheme[item.rank]?.card ?? rankTheme.E.card}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full border border-amber-200/25 bg-black/35 px-2 py-0.5 text-xs text-amber-100/90">#{idx + 1}</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${rankTheme[item.rank]?.chip ?? rankTheme.E.chip}`}>
                <Image
                  src={rankTheme[item.rank]?.icon ?? rankTheme.E.icon}
                  alt=""
                  aria-hidden
                  width={12}
                  height={12}
                  className="h-3 w-3 object-contain"
                />
                Rank {item.rank}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-[48px] w-[48px] shrink-0">
                <Image
                  src={item.avatarUrl?.startsWith("/") ? item.avatarUrl : "/assets/icones/Equipment/Wizard Hat.png"}
                  alt={`Retrato de ${item.name}`}
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-semibold text-amber-100">{item.name}</p>
                {item.provisional && (
                  <p className="text-xs text-amber-200/80">Score provisorio (menos de 3 concluidas)</p>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-amber-100/20 bg-black/25 p-2">
                <p className="text-[10px] uppercase tracking-wide text-amber-100/70">Score</p>
                <p className="text-base font-bold text-amber-100">{item.score}</p>
              </div>
              <div className="rounded-md border border-amber-100/20 bg-black/25 p-2">
                <p className="text-[10px] uppercase tracking-wide text-amber-100/70">Concluidas</p>
                <p className="text-base font-bold text-amber-100">{item.completed}</p>
              </div>
              <div className="rounded-md border border-amber-100/20 bg-black/25 p-2">
                <p className="text-[10px] uppercase tracking-wide text-amber-100/70">Enchantiun</p>
                <p className="text-base font-bold text-cyan-200">{item.xp}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs text-amber-100/85">
                  <span>Pontualidade</span>
                  <span>{item.punctuality}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-black/45">
                  <div className={`h-full rounded-full ${rankTheme[item.rank]?.bar ?? rankTheme.E.bar}`} style={{ width: `${Math.max(6, item.punctuality)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-amber-100/85">
                  <span>Qualidade</span>
                  <span>{item.quality}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-black/45">
                  <div className={`h-full rounded-full ${rankTheme[item.rank]?.bar ?? rankTheme.E.bar}`} style={{ width: `${Math.max(6, item.quality)}%` }} />
                </div>
              </div>
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="col-span-full text-sm text-amber-100/80">Sem dados para o periodo selecionado.</p>}
      </div>
    </div>
  );
}
