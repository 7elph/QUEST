"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type MissionChecklistProgressProps = {
  missionId: string;
  conditions: string[];
  canEdit: boolean;
  initialState: boolean[];
  completionPct: number;
  updatedAt?: string;
};

export function MissionChecklistProgress({
  missionId,
  conditions,
  canEdit,
  initialState,
  completionPct,
  updatedAt,
}: MissionChecklistProgressProps) {
  const router = useRouter();
  const [state, setState] = useState<boolean[]>(() => {
    const base = new Array(conditions.length).fill(false);
    initialState.slice(0, conditions.length).forEach((item, idx) => {
      base[idx] = !!item;
    });
    return base;
  });
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const pct = useMemo(() => {
    const done = state.filter(Boolean).length;
    return conditions.length ? Math.round((done / conditions.length) * 100) : completionPct;
  }, [state, conditions.length, completionPct]);

  const toggle = async (index: number) => {
    if (!canEdit) return;
    const nextValue = !state[index];
    setSavingIndex(index);
    setMessage("");

    const response = await fetch(`/api/missions/${missionId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIndex: index, done: nextValue }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Falha ao atualizar checklist.");
      setSavingIndex(null);
      return;
    }

    setState((prev) => prev.map((item, idx) => (idx === index ? nextValue : item)));
    setMessage("Checklist atualizado.");
    setSavingIndex(null);
    router.refresh();
  };

  return (
    <section className="space-y-3 text-[#1b130f]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#1b130f]">Andamento da Missao</h2>
        <span className="rounded-full border border-[#5a3829]/30 bg-[#f5e3bf]/75 px-2 py-1 text-xs font-semibold text-[#1b130f]">
          {pct}% concluido
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#5a3829]/25">
        <div className="h-full bg-[#d6a354] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 space-y-2">
        {conditions.map((item, idx) => (
          <label key={`${idx}-${item}`} className="flex items-start gap-2 rounded-md border border-[#5a3829]/25 bg-[#f5e3bf]/55 p-2 text-sm">
            <input
              type="checkbox"
              checked={state[idx] ?? false}
              disabled={!canEdit || savingIndex === idx}
              onChange={() => void toggle(idx)}
              className="mt-1"
            />
            <span className={(state[idx] ?? false) ? "line-through opacity-75" : ""}>{item}</span>
          </label>
        ))}
      </div>
      {!canEdit && <p className="mt-2 text-xs text-[#3d271c]/80">Somente o aventureiro atribuido pode marcar itens como concluidos.</p>}
      {updatedAt && <p className="mt-1 text-xs text-[#3d271c]/80">Ultima atualizacao: {new Date(updatedAt).toLocaleString("pt-BR")}</p>}
      {message && <p className="mt-2 text-xs text-[#5a3829]">{message}</p>}
      {canEdit && (
        <div className="mt-2">
          <Button variant="ghost" className="border border-[#5a3829]/35 text-[#1b130f] hover:bg-[#f5e3bf]/55" onClick={() => router.refresh()}>
            Atualizar painel
          </Button>
        </div>
      )}
    </section>
  );
}
