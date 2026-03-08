"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MissionCategory } from "@prisma/client";
import { alphaCategoryMeta } from "@/lib/mission-catalog";

const categories = Object.keys(alphaCategoryMeta) as MissionCategory[];
const actionOptions = [
  "Atendimento de leads no WhatsApp",
  "Atualizacao de planilha operacional",
  "Prospeccao digital com lista validada",
  "Criacao de cards para social local",
  "Copy para landing ou campanha",
  "Automacao no-code de rotina",
  "Calendario de publicacoes locais",
];
const deliverables = ["Link", "Arquivo", "Ambos"] as const;

export function EnterpriseRequestBuilder({ canCreateTask }: { canCreateTask: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>(MissionCategory.OPERACOES_PLANILHAS);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [deliverable, setDeliverable] = useState<(typeof deliverables)[number]>("Ambos");
  const [deadline, setDeadline] = useState("48h");
  const [message, setMessage] = useState("");

  const scope = useMemo(() => {
    if (selectedActions.length === 0) return "";
    return `Fazer este pedido com foco em: ${selectedActions.join(", ")}.`;
  }, [selectedActions]);

  const toggleAction = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((item) => item !== action) : [...prev, action],
    );
  };

  const sendToWizard = () => {
    if (!title.trim() || selectedActions.length < 2) {
      setMessage("Digite um titulo e marque pelo menos 2 itens.");
      return;
    }

    const payload = {
      title: title.trim(),
      category,
      scope,
      victoryConditions: selectedActions.map((item) => `Executar: ${item}`),
      deliverableFormat: deliverable === "Link" ? "LINK" : deliverable === "Arquivo" ? "FILE" : "BOTH",
      deadlinePreset: deadline,
    };

    localStorage.setItem("quest_enterprise_preset", JSON.stringify(payload));
    setMessage("Pedido pronto. Vamos para o formulario completo.");
    router.push(canCreateTask ? "/create-mission" : "/login?callbackUrl=/create-mission");
  };

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-6 text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Novo pedido</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Monte seu pedido rapido</h3>
          <p className="mt-1 text-sm text-slate-600">Escolha o que precisa e siga para publicar.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">1. Nome do pedido</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Lista de clientes do Centro"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">2. Categoria</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof categories)[number])}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {alphaCategoryMeta[item].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">3. Acoes praticas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {actionOptions.map((action) => {
                const active = selectedActions.includes(action);
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggleAction(action)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-800"
                        : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {action}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Dica: marque pelo menos 2 itens.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">4. Formato</span>
              <select
                value={deliverable}
                onChange={(e) => setDeliverable(e.target.value as (typeof deliverables)[number])}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                {deliverables.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">5. Prazo</span>
              <select
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="24h">24h</option>
                <option value="48h">48h</option>
                <option value="72h">72h</option>
                <option value="week">Esta semana</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={sendToWizard} className="bg-cyan-600 text-white hover:bg-cyan-500">
              Ir para formulario completo
            </Button>
          </div>
          {message && <p className="text-xs font-medium text-slate-700">{message}</p>}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Resumo rapido</p>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div>
              <p className="text-xs text-slate-500">Nome</p>
              <p className="font-medium text-slate-900">{title.trim() || "Ainda nao informado"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Categoria</p>
              <p className="font-medium text-slate-900">{alphaCategoryMeta[category].label}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Checklist base</p>
              {selectedActions.length > 0 ? (
                <ul className="mt-1 space-y-1 text-xs text-slate-700">
                  {selectedActions.map((action) => (
                    <li key={action}>- {action}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Nenhum item marcado ainda.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
