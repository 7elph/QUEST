"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { EscrowStatus, MissionStatus, UserStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MissionPreviewGrid, type MissionPreviewItem } from "@/components/app/mission-preview-grid";
import { formatDate, getEscrowLabel, getMissionStatusLabel, getPipelineTone, getStatusTone, parseMissionStatus } from "@/components/app/admin-panel.helpers";
import { type AdminPanelProps, type AdminTab, type FullRunResult, type LlmControlSnapshot, type MissionViewMode, type TriageGate, type TriageResult, missionKanbanColumns, tabs } from "@/components/app/admin-panel.types";

export function AdminPanel({ users, missions, disputes, founders, storeRequests, pendingApprovals, inbox, audit, errors, llmPipeline }: AdminPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [triageModel, setTriageModel] = useState("phi3:mini");
  const [triageLoadingId, setTriageLoadingId] = useState<string | null>(null);
  const [triageResults, setTriageResults] = useState<Record<string, { model: string; triage: TriageResult; gate: TriageGate }>>({});
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [enchantiunAmount, setEnchantiunAmount] = useState("60");
  const [enchantiunReason, setEnchantiunReason] = useState("Ajuste manual por admin");
  const [missionQuery, setMissionQuery] = useState("");
  const [missionStatusFilter, setMissionStatusFilter] = useState("ALL");
  const [missionViewMode, setMissionViewMode] = useState<MissionViewMode>("KANBAN");
  const [dragMissionId, setDragMissionId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<MissionStatus | null>(null);
  const [statusUpdatingMissionId, setStatusUpdatingMissionId] = useState<string | null>(null);
  const [fullRunScenario, setFullRunScenario] = useState<FullRunResult["scenario"]>("MIXED");
  const [fullRunModel, setFullRunModel] = useState("phi3:mini");
  const [fullRunLoading, setFullRunLoading] = useState(false);
  const [fullRunResult, setFullRunResult] = useState<FullRunResult | null>(null);
  const [llmControl, setLlmControl] = useState<LlmControlSnapshot | null>(null);
  const [llmControlLoading, setLlmControlLoading] = useState(false);
  const [llmControlActionLoading, setLlmControlActionLoading] = useState(false);
  const [llmControlError, setLlmControlError] = useState("");
  const [llmWarmupModelsInput, setLlmWarmupModelsInput] = useState("");
  const [llmWarmupPrompt, setLlmWarmupPrompt] = useState("");
  const [llmTestPrompt, setLlmTestPrompt] = useState("Responda apenas JSON: {\"ok\": true}");
  const [llmTestModel, setLlmTestModel] = useState("");
  const [llmTestResult, setLlmTestResult] = useState<{
    model: string;
    response: string;
    durationNs?: number;
    evalCount?: number;
  } | null>(null);
  const [message, setMessage] = useState("");

  const selectedUser = users.find((user) => user.id === selectedUserId);
  const missionStatusOptions = Array.from(new Set(missions.map((item) => item.status))).sort();
  const filteredMissions = missions.filter((mission) => {
    const matchesStatus = missionStatusFilter === "ALL" || mission.status === missionStatusFilter;
    const normalizedQuery = missionQuery.trim().toLowerCase();
    const matchesQuery = normalizedQuery.length === 0 || mission.title.toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
  const filteredMissionsByStatus = missionKanbanColumns.map((column) => ({
    ...column,
    items: filteredMissions.filter((mission) => mission.status === column.status),
  }));
  const missionMetrics = {
    total: missions.length,
    pendingApproval: pendingApprovals.length,
    open: missions.filter((item) => item.status === MissionStatus.OPEN).length,
    inReview: missions.filter((item) => item.status === MissionStatus.IN_REVIEW || item.status === MissionStatus.REVISION_REQUESTED).length,
    disputed: missions.filter((item) => item.status === MissionStatus.DISPUTED).length,
    escrowPending: missions.filter((item) => item.escrowStatus === EscrowStatus.PENDING).length,
  };

  const missionPreviewItems: MissionPreviewItem[] = filteredMissions.map((mission) => ({
    id: mission.id,
    href: `/mission/${mission.id}`,
    title: mission.title,
    summary: mission.summary,
    categoryLabel: mission.categoryLabel,
    categoryIcon: mission.categoryIcon,
    statusLabel: getMissionStatusLabel(mission.status),
    rank: mission.rank,
    neighborhood: mission.neighborhood,
    city: mission.city,
    state: mission.state,
    patronName: mission.patronName,
    deadlineLabel: formatDate(mission.deadlineAt),
    enchantiun: mission.enchantiun,
    dropName: mission.dropName,
    dropIconPath: mission.dropIconPath,
    secondaryLabel: getEscrowLabel(mission.escrowStatus),
  }));

  const requestAction = async (url: string, method: "POST" | "PATCH", payload?: unknown) => {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message ?? "Acao executada." : data.error ?? "Falha na acao.");
    router.refresh();
  };

  const post = async (url: string, payload?: unknown) => requestAction(url, "POST", payload);
  const patch = async (url: string, payload?: unknown) => requestAction(url, "PATCH", payload);

  const updateMissionStatus = async (missionId: string, toStatus: MissionStatus) => {
    const currentMission = missions.find((item) => item.id === missionId);
    const currentStatus = currentMission ? parseMissionStatus(currentMission.status) : null;
    if (!currentStatus || currentStatus === toStatus) {
      setDragMissionId(null);
      setDragOverStatus(null);
      return;
    }

    setStatusUpdatingMissionId(missionId);
    try {
      await patch(`/api/missions/${missionId}`, { status: toStatus });
    } finally {
      setStatusUpdatingMissionId(null);
      setDragMissionId(null);
      setDragOverStatus(null);
    }
  };

  const runTriage = async (disputeId: string, model?: string) => {
    setTriageLoadingId(disputeId);
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model ?? triageModel }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "Falha na triagem IA.");
        return;
      }
      setTriageResults((prev) => ({
        ...prev,
        [disputeId]: {
          model: data.model as string,
          triage: data.triage as TriageResult,
          gate: data.gate as TriageGate,
        },
      }));
      setMessage("Triagem IA concluida.");
    } finally {
      setTriageLoadingId(null);
    }
  };

  const adjustEnchantiun = async () => {
    if (!selectedUserId) {
      setMessage("Selecione um usuario para ajustar Enchantiun.");
      return;
    }

    const amount = Number(enchantiunAmount);
    if (!Number.isInteger(amount) || amount === 0) {
      setMessage("Informe um valor inteiro diferente de zero.");
      return;
    }

    await post(`/api/admin/users/${selectedUserId}/enchantiun`, {
      amount,
      reason: enchantiunReason.trim() || undefined,
    });
  };

  const runFullSimulation = async () => {
    setFullRunLoading(true);
    try {
      const response = await fetch("/api/admin/simulations/full-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: fullRunScenario,
          model: fullRunModel.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<FullRunResult> & { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Falha ao rodar jornada completa da LLM.");
        return;
      }
      setFullRunResult(data as FullRunResult);
      setMessage(data.nextAction ?? data.message ?? "Jornada completa da LLM executada.");
      router.refresh();
    } finally {
      setFullRunLoading(false);
    }
  };

  const fetchLlmControl = async () => {
    setLlmControlLoading(true);
    setLlmControlError("");
    try {
      const response = await fetch("/api/admin/llm/control");
      const data = (await response.json().catch(() => ({}))) as LlmControlSnapshot & { error?: string };
      if (!response.ok) {
        setLlmControlError(data.error ?? "Falha ao carregar controle de LLM.");
        return;
      }
      setLlmControl(data);
      setLlmWarmupModelsInput(data.runtime.warmup.models.join(", "));
      setLlmWarmupPrompt(data.runtime.warmup.prompt);
    } finally {
      setLlmControlLoading(false);
    }
  };

  const runLlmControlAction = async (payload: Record<string, unknown>) => {
    setLlmControlActionLoading(true);
    setLlmControlError("");
    try {
      const response = await fetch("/api/admin/llm/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as LlmControlSnapshot & {
        error?: string;
        message?: string;
        test?: { model: string; response: string; durationNs?: number; evalCount?: number };
      };
      if (!response.ok) {
        setLlmControlError(data.error ?? "Falha ao executar acao de controle.");
        return null;
      }
      if (data.runtime) {
        setLlmControl(data);
        setLlmWarmupModelsInput(data.runtime.warmup.models.join(", "));
        setLlmWarmupPrompt(data.runtime.warmup.prompt);
      }
      if (data.test) {
        setLlmTestResult(data.test);
      }
      if (data.message) {
        setMessage(data.message);
      }
      return data;
    } finally {
      setLlmControlActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "llm") {
      void fetchLlmControl();
    }
  }, [activeTab]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200/20 bg-black/20 p-2">
        <div className="grid gap-2 md:grid-cols-6">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              className="justify-start"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-5">
          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Inbox operacional</h2>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg border border-amber-100/20 p-3">
                <p className="font-semibold">Escrow pendente ({inbox.pendingEscrow.length})</p>
                {inbox.pendingEscrow.slice(0, 5).map((item) => (
                  <p key={item.id} className="mt-1">{item.title} [{item.escrowStatus}]</p>
                ))}
              </div>
              <div className="rounded-lg border border-amber-100/20 p-3">
                <p className="font-semibold">Disputas abertas ({inbox.openDisputes.length})</p>
                {inbox.openDisputes.slice(0, 5).map((item) => (
                  <p key={item.id} className="mt-1">{item.reason}</p>
                ))}
              </div>
              <div className="rounded-lg border border-amber-100/20 p-3">
                <p className="font-semibold">Founders pendentes ({inbox.pendingFounders.length})</p>
                {inbox.pendingFounders.slice(0, 5).map((item) => (
                  <p key={item.id} className="mt-1">{item.userEmail} - {item.tier}</p>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Roadmap interno</h2>
            <p className="text-sm">Alpha: escrow manual + ranking simples.</p>
            <p className="text-sm">Beta: pagamentos integrados + triagem automatizada + notificacoes.</p>
            <p className="text-sm">v1: PWA mobile, APIs, export CSV.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => post("/api/admin/reset-demo")}>Reset demo data</Button>
              <Button variant="ghost" onClick={() => post("/api/admin/notifications/digest", { type: "DAILY" })}>Enviar digest diario</Button>
              <a href="/api/admin/export?entity=missions" className="rounded-md border border-amber-200/40 px-3 py-2 text-sm">Exportar missoes CSV</a>
              <a href="/api/admin/export?entity=users" className="rounded-md border border-amber-200/40 px-3 py-2 text-sm">Exportar usuarios CSV</a>
            </div>
          </section>

          <section className="rounded-xl border border-cyan-200/25 bg-cyan-950/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Pipeline de testes LLM</h2>
              <Button variant="ghost" onClick={() => setActiveTab("llm")}>Abrir monitor completo</Button>
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-5">
              <p className="rounded-md border border-cyan-200/25 bg-black/20 p-2">Triagens: {llmPipeline.summary.screenedTotal}</p>
              <p className="rounded-md border border-cyan-200/25 bg-black/20 p-2">Aprovacoes pendentes: {llmPipeline.summary.pendingApproval}</p>
              <p className="rounded-md border border-cyan-200/25 bg-black/20 p-2">Decisoes humanas: {llmPipeline.summary.approvalsTotal}</p>
              <p className="rounded-md border border-cyan-200/25 bg-black/20 p-2">Simulacoes: {llmPipeline.summary.simulationsTotal}</p>
              <p className="rounded-md border border-cyan-200/25 bg-black/20 p-2">Fallback aguardando: {llmPipeline.summary.simulationsAwaiting}</p>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Aprovacoes de missao</h2>
              <Button variant="ghost" onClick={() => setActiveTab("missions")}>Abrir aba Missoes</Button>
            </div>
            <p className="mt-2 text-sm">
              Pendencias atuais: <strong>{pendingApprovals.length}</strong>. Aprovacao/rejeicao agora fica centralizada na aba Missoes.
            </p>
          </section>

          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Anuncios</h2>
            <div className="mt-2 grid gap-2">
              <input className="w-full rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm" placeholder="Titulo" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} />
              <textarea className="h-20 w-full rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm" placeholder="Conteudo" value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} />
              <div>
                <Button onClick={() => post("/api/admin/announcements", { title: announcementTitle, content: announcementContent })}>Publicar</Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-5">
          <section className="rounded-xl border border-cyan-200/20 bg-cyan-950/10 p-4">
            <h2 className="font-semibold">Carteira Enchantiun (finance)</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-[1.5fr_160px_1fr_auto]">
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm">
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} ({user.role}) - saldo {user.enchantiunBalance}
                  </option>
                ))}
              </select>
              <input
                value={enchantiunAmount}
                onChange={(e) => setEnchantiunAmount(e.target.value)}
                className="rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm"
                type="number"
                step="1"
                placeholder="+60 ou -30"
              />
              <input
                value={enchantiunReason}
                onChange={(e) => setEnchantiunReason(e.target.value)}
                className="rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm"
                placeholder="Motivo"
              />
              <Button onClick={adjustEnchantiun}>Aplicar ajuste</Button>
            </div>
            {selectedUser && (
              <p className="mt-2 text-xs text-cyan-100/85">
                Saldo atual: {selectedUser.enchantiunBalance} Enchantiun
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setEnchantiunAmount("25")}>+25</Button>
              <Button variant="ghost" onClick={() => setEnchantiunAmount("60")}>+60</Button>
              <Button variant="ghost" onClick={() => setEnchantiunAmount("-25")}>-25</Button>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Usuarios</h2>
            <div className="mt-2 space-y-2 text-sm">
              {users.map((user) => (
                <article key={user.id} className="rounded-lg border border-amber-100/10 bg-black/25 p-3">
                  <div className="grid gap-3 md:grid-cols-[1.2fr_auto_auto] md:items-center">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-xs text-amber-100/75">{user.role}/{user.adminScope || "-"}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-xs ${getStatusTone(user.status)}`}>
                      {user.status}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-700/20 px-2 py-1 text-xs text-cyan-100">
                      <Image src="/assets/Crystal.png" alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                      {user.enchantiunBalance}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <Button variant="ghost" onClick={() => post(`/api/admin/users/${user.id}/status`, { status: UserStatus.SUSPENDED })}>Suspender</Button>
                    <Button variant="danger" onClick={() => post(`/api/admin/users/${user.id}/status`, { status: UserStatus.BANNED })}>Banir</Button>
                    <Button onClick={() => post(`/api/admin/users/${user.id}/status`, { status: UserStatus.ACTIVE })}>Ativar</Button>
                    <Button variant="ghost" onClick={() => post(`/api/admin/users/${user.id}/enchantiun`, { amount: 25, reason: "Bonus operacional admin" })}>+25 Enchantiun</Button>
                    <Button variant="ghost" onClick={() => post(`/api/admin/users/${user.id}/enchantiun`, { amount: -15, reason: "Ajuste operacional admin" })}>-15 Enchantiun</Button>
                    {user.role === "ADMIN" && (
                      <Button variant="ghost" onClick={() => post(`/api/admin/users/${user.id}/scope`, { adminScope: "MODERATOR" })}>Scope MOD</Button>
                    )}
                    {user.role === "ADMIN" && (
                      <Button variant="ghost" onClick={() => post(`/api/admin/users/${user.id}/scope`, { adminScope: "FINANCE" })}>Scope FIN</Button>
                    )}
                    {user.role === "ADMIN" && (
                      <Button variant="ghost" onClick={() => post(`/api/admin/users/${user.id}/scope`, { adminScope: "OPS" })}>Scope OPS</Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "missions" && (
        <div className="space-y-5">
          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Painel de missoes</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setActiveTab("llm")}>Abrir pipeline LLM</Button>
                <Button variant="ghost" onClick={() => setActiveTab("disputes")}>Abrir disputas</Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-3 xl:grid-cols-6">
              <article className="rounded-md border border-amber-100/20 bg-black/25 p-3">
                <p className="text-xs text-amber-100/70">Pendentes aprovacao</p>
                <p className="text-xl font-semibold">{missionMetrics.pendingApproval}</p>
              </article>
              <article className="rounded-md border border-amber-100/20 bg-black/25 p-3">
                <p className="text-xs text-amber-100/70">Abertas</p>
                <p className="text-xl font-semibold">{missionMetrics.open}</p>
              </article>
              <article className="rounded-md border border-amber-100/20 bg-black/25 p-3">
                <p className="text-xs text-amber-100/70">Em analise</p>
                <p className="text-xl font-semibold">{missionMetrics.inReview}</p>
              </article>
              <article className="rounded-md border border-amber-100/20 bg-black/25 p-3">
                <p className="text-xs text-amber-100/70">Disputa</p>
                <p className="text-xl font-semibold">{missionMetrics.disputed}</p>
              </article>
              <article className="rounded-md border border-amber-100/20 bg-black/25 p-3">
                <p className="text-xs text-amber-100/70">Escrow pendente</p>
                <p className="text-xl font-semibold">{missionMetrics.escrowPending}</p>
              </article>
              <article className="rounded-md border border-amber-100/20 bg-black/25 p-3">
                <p className="text-xs text-amber-100/70">Total</p>
                <p className="text-xl font-semibold">{missionMetrics.total}</p>
              </article>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Fila de aprovacao</h2>
              <span className="rounded-full border border-amber-200/30 bg-amber-700/15 px-2 py-1 text-xs">
                Pendentes: {pendingApprovals.length}
              </span>
            </div>
            <div className="mt-3 hidden grid-cols-[1.5fr_1fr_1fr_1.2fr] gap-2 rounded-md border border-amber-100/20 bg-black/20 px-3 py-2 text-xs text-amber-100/70 lg:grid">
              <p>Missao</p>
              <p>Patrono</p>
              <p>Triagem</p>
              <p>Acoes</p>
            </div>
            <div className="mt-2 max-h-[320px] space-y-2 overflow-auto pr-1 text-sm">
              {pendingApprovals.map((item) => (
                <article key={item.id} className="rounded-md border border-amber-100/15 bg-black/25 p-3">
                  <div className="grid gap-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr] lg:items-center">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-amber-100/75">{item.screeningSummary}</p>
                    </div>
                    <p className="text-xs text-amber-100/85">{item.patron}</p>
                    <p className="text-xs text-amber-100/85">
                      {item.screeningDecision} ({(item.screeningConfidence * 100).toFixed(0)}%) via {item.screeningModel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => post(`/api/admin/missions/${item.id}/approval`, { decision: "APPROVE", comment: "Aprovado apos triagem." })}>
                        Aprovar
                      </Button>
                      <Button variant="danger" onClick={() => post(`/api/admin/missions/${item.id}/approval`, { decision: "REJECT", comment: "Rejeitado na moderacao." })}>
                        Rejeitar
                      </Button>
                      <Link href={`/mission/${item.id}`} className="rounded-md border border-amber-200/35 px-2 py-1 text-xs hover:bg-amber-900/30">
                        Detalhes
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
              {pendingApprovals.length === 0 && (
                <p className="rounded-md border border-amber-100/20 bg-black/20 p-3 text-sm">
                  Nenhuma missao pendente de aprovacao.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Controle de missoes</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto_auto]">
              <input
                value={missionQuery}
                onChange={(e) => setMissionQuery(e.target.value)}
                className="rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm"
                placeholder="Buscar por nome da missao"
              />
              <select
                value={missionStatusFilter}
                onChange={(e) => setMissionStatusFilter(e.target.value)}
                className="rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm"
              >
                <option value="ALL">Todos status</option>
                {missionStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <p className="rounded-md border border-amber-100/20 bg-black/25 px-3 py-2 text-xs">
                Exibindo {filteredMissions.length} de {missions.length}
              </p>
              <div className="flex gap-2">
                <Button variant={missionViewMode === "KANBAN" ? "default" : "ghost"} onClick={() => setMissionViewMode("KANBAN")}>
                  Kanban
                </Button>
                <Button variant={missionViewMode === "LIST" ? "default" : "ghost"} onClick={() => setMissionViewMode("LIST")}>
                  Lista
                </Button>
                <Button variant={missionViewMode === "PREVIEW" ? "default" : "ghost"} onClick={() => setMissionViewMode("PREVIEW")}>
                  Hover
                </Button>
              </div>
            </div>
            {missionViewMode === "KANBAN" && (
              <p className="mt-2 text-xs text-amber-100/75">
                Arraste a missao para outra coluna para mudar o status.
              </p>
            )}
            {missionViewMode === "PREVIEW" && (
              <p className="mt-2 text-xs text-amber-100/75">
                Passe o mouse nos icones para ver resumo da missao antes de abrir detalhes.
              </p>
            )}

            {missionViewMode === "KANBAN" ? (
              <div className="mt-3 overflow-x-auto pb-2">
                <div className="grid min-w-[1380px] grid-cols-8 gap-3">
                  {filteredMissionsByStatus.map((column) => (
                    <section
                      key={column.status}
                      className={`rounded-lg border p-2 ${dragOverStatus === column.status ? "border-amber-300/60 bg-amber-900/20" : "border-amber-100/20 bg-black/25"}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (dragMissionId) setDragOverStatus(column.status);
                      }}
                      onDrop={async (event) => {
                        event.preventDefault();
                        if (!dragMissionId) return;
                        await updateMissionStatus(dragMissionId, column.status);
                      }}
                      onDragLeave={() => {
                        if (dragOverStatus === column.status) {
                          setDragOverStatus(null);
                        }
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold text-amber-100/90">{column.label}</h3>
                        <span className="rounded-full border border-amber-100/30 bg-black/35 px-2 py-0.5 text-[10px] text-amber-100/85">
                          {column.items.length}
                        </span>
                      </div>

                      <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                        {column.items.map((mission) => (
                          <article
                            key={mission.id}
                            draggable
                            onDragStart={() => setDragMissionId(mission.id)}
                            onDragEnd={() => {
                              setDragMissionId(null);
                              setDragOverStatus(null);
                            }}
                            className={`rounded-md border border-amber-100/15 bg-black/35 p-2 ${dragMissionId === mission.id ? "opacity-60" : ""}`}
                          >
                            <p className="line-clamp-2 text-xs font-semibold">{mission.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${getStatusTone(mission.escrowStatus)}`}>
                                {getEscrowLabel(mission.escrowStatus)}
                              </span>
                              {statusUpdatingMissionId === mission.id && (
                                <span className="rounded-full border border-amber-300/35 bg-amber-800/20 px-1.5 py-0.5 text-[10px] text-amber-100">
                                  Atualizando...
                                </span>
                              )}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              <Button
                                variant="ghost"
                                className="px-2 py-1 text-[10px]"
                                onClick={() => post(`/api/admin/missions/${mission.id}/escrow`, { escrowStatus: EscrowStatus.CONFIRMED })}
                                disabled={mission.escrowStatus === EscrowStatus.CONFIRMED || mission.escrowStatus === EscrowStatus.RELEASED}
                              >
                                Confirmar
                              </Button>
                              <Button
                                className="px-2 py-1 text-[10px]"
                                onClick={() => post(`/api/admin/missions/${mission.id}/escrow`, { escrowStatus: EscrowStatus.RELEASED })}
                                disabled={mission.escrowStatus === EscrowStatus.RELEASED || mission.escrowStatus === EscrowStatus.NONE}
                              >
                                Liberar
                              </Button>
                              <Link href={`/mission/${mission.id}`} className="rounded-md border border-amber-200/35 px-2 py-1 text-center text-[10px] hover:bg-amber-900/30">
                                Detalhes
                              </Link>
                              <Button
                                variant="danger"
                                className="px-2 py-1 text-[10px]"
                                onClick={() => patch(`/api/missions/${mission.id}`, { status: MissionStatus.CANCELLED })}
                                disabled={mission.status === MissionStatus.CANCELLED || mission.status === MissionStatus.COMPLETED}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </article>
                        ))}
                        {column.items.length === 0 && (
                          <p className="rounded-md border border-dashed border-amber-100/20 bg-black/20 px-2 py-3 text-center text-[11px] text-amber-100/70">
                            Solte uma missao aqui
                          </p>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              missionViewMode === "PREVIEW" ? (
              <div className="mt-3">
                <MissionPreviewGrid missions={missionPreviewItems} emptyMessage="Nenhuma missao encontrada para o filtro atual." />
              </div>
            ) : (
              <>
                <div className="mt-3 hidden grid-cols-[1.5fr_0.8fr_0.9fr_1.5fr] gap-2 rounded-md border border-amber-100/20 bg-black/20 px-3 py-2 text-xs text-amber-100/70 lg:grid">
                  <p>Missao</p>
                  <p>Status</p>
                  <p>Escrow</p>
                  <p>Acoes</p>
                </div>
                <div className="mt-2 max-h-[460px] space-y-2 overflow-auto pr-1 text-sm">
                  {filteredMissions.map((mission) => (
                    <article key={mission.id} className="rounded-lg border border-amber-100/10 bg-black/25 p-3">
                      <div className="grid gap-2 lg:grid-cols-[1.5fr_0.8fr_0.9fr_1.5fr] lg:items-center">
                        <p className="font-medium">{mission.title}</p>
                        <span className={`w-fit rounded-full border px-2 py-1 text-xs ${getStatusTone(mission.status)}`}>
                          {getMissionStatusLabel(mission.status)}
                        </span>
                        <span className={`w-fit rounded-full border px-2 py-1 text-xs ${getStatusTone(mission.escrowStatus)}`}>
                          {getEscrowLabel(mission.escrowStatus)}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => post(`/api/admin/missions/${mission.id}/escrow`, { escrowStatus: EscrowStatus.CONFIRMED })}
                            disabled={mission.escrowStatus === EscrowStatus.CONFIRMED || mission.escrowStatus === EscrowStatus.RELEASED}
                          >
                            Confirmar
                          </Button>
                          <Button
                            onClick={() => post(`/api/admin/missions/${mission.id}/escrow`, { escrowStatus: EscrowStatus.RELEASED })}
                            disabled={mission.escrowStatus === EscrowStatus.RELEASED || mission.escrowStatus === EscrowStatus.NONE}
                          >
                            Liberar
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => patch(`/api/missions/${mission.id}`, { status: MissionStatus.CANCELLED })}
                            disabled={mission.status === MissionStatus.CANCELLED || mission.status === MissionStatus.COMPLETED}
                          >
                            Cancelar
                          </Button>
                          <Link href={`/mission/${mission.id}`} className="rounded-md border border-amber-200/35 px-2 py-1 text-xs text-center hover:bg-amber-900/30">
                            Detalhes
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                  {filteredMissions.length === 0 && (
                    <p className="rounded-md border border-amber-100/20 bg-black/20 p-3 text-sm">
                      Nenhuma missao encontrada para o filtro atual.
                    </p>
                  )}
                </div>
              </>
            )
            )}
          </section>
        </div>
      )}

      {activeTab === "disputes" && (
        <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
          <h2 className="font-semibold">Disputas (com filtro IA)</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <input
              className="rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2"
              value={triageModel}
              onChange={(e) => setTriageModel(e.target.value)}
              placeholder="Modelo Ollama (ex: phi3:mini)"
            />
            <Button variant="ghost" onClick={() => setTriageModel("tinyllama")}>Usar tinyllama</Button>
            <Button variant="ghost" onClick={() => setTriageModel("phi3:mini")}>Usar phi3:mini</Button>
          </div>
          <div className="mt-2 space-y-2 text-sm">
            {disputes.map((dispute) => (
              <article key={dispute.id} className="rounded-lg border border-amber-100/10 bg-black/25 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{dispute.reason}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${getStatusTone(dispute.status)}`}>{dispute.status}</span>
                  <Button onClick={() => post(`/api/admin/disputes/${dispute.id}/resolve`, { resolution: "Checklist e evidencias confirmam entrega.", missionStatus: MissionStatus.COMPLETED })}>Resolver</Button>
                  <Button
                    variant="ghost"
                    disabled={triageLoadingId === dispute.id}
                    onClick={() => runTriage(dispute.id)}
                  >
                    {triageLoadingId === dispute.id ? "Triando..." : "Filtro IA"}
                  </Button>
                </div>
                {triageResults[dispute.id] && (
                  <div className="mt-2 rounded-md border border-amber-100/20 bg-black/25 p-3 text-xs">
                    <p>
                      Modelo: {triageResults[dispute.id].model} | Recom.: {triageResults[dispute.id].triage.recommendation} | Conf.: {(triageResults[dispute.id].triage.confidence * 100).toFixed(0)}%
                    </p>
                    <p className="mt-1">
                      Pos-gate: {triageResults[dispute.id].gate.finalRecommendation}
                      {triageResults[dispute.id].gate.wasOverridden ? " (bloqueada)" : " (liberada)"}
                    </p>
                    {triageResults[dispute.id].gate.wasOverridden && triageResults[dispute.id].gate.reasons.length > 0 && (
                      <p className="mt-1 text-amber-300/90">Motivos do gate: {triageResults[dispute.id].gate.reasons.join(", ")}</p>
                    )}
                    <p className="mt-1 text-amber-100/90">{triageResults[dispute.id].triage.summary}</p>
                    {triageResults[dispute.id].triage.inconsistencies.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {triageResults[dispute.id].triage.inconsistencies.map((item, idx) => (
                          <p key={`${item.title}-${idx}`}>
                            [{item.severity}] {item.title}: {item.details}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2">Sem inconsistencias fortes detectadas.</p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "llm" && (
        <div className="space-y-5">
          <section className="rounded-xl border border-cyan-200/25 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Controle do servidor Ollama</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => void fetchLlmControl()} disabled={llmControlLoading || llmControlActionLoading}>
                  Atualizar status
                </Button>
                <Button variant="danger" onClick={() => void runLlmControlAction({ action: "reset" })} disabled={llmControlActionLoading}>
                  Reset runtime
                </Button>
              </div>
            </div>

            {llmControlLoading && <p className="mt-3 text-sm text-cyan-100/80">Carregando estado da LLM...</p>}
            {llmControlError && <p className="mt-3 text-sm text-rose-200">{llmControlError}</p>}

            {llmControl && (
              <>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                  <p className="rounded-md border border-cyan-200/30 bg-black/30 p-2">
                    Servidor: <strong>{llmControl.server.reachable ? "ONLINE" : "OFFLINE"}</strong>
                  </p>
                  <p className="rounded-md border border-cyan-200/30 bg-black/30 p-2">
                    LLM runtime: <strong>{llmControl.runtime.enabled ? "ATIVA" : "DESATIVADA"}</strong>
                  </p>
                  <p className="rounded-md border border-cyan-200/30 bg-black/30 p-2">
                    Chamadas: <strong>{llmControl.telemetry.summary.total}</strong>
                  </p>
                  <p className="rounded-md border border-cyan-200/30 bg-black/30 p-2">
                    Falhas: <strong>{llmControl.telemetry.summary.failed}</strong>
                  </p>
                </div>

                <div className="mt-2 rounded-md border border-cyan-200/25 bg-black/30 p-3 text-xs">
                  <p>Base URL: {llmControl.server.baseUrl}</p>
                  <p>Ultimo sucesso: {formatDate(llmControl.telemetry.summary.lastSuccessAt)}</p>
                  <p>Ultima falha: {formatDate(llmControl.telemetry.summary.lastFailureAt)}</p>
                  {llmControl.server.error && <p className="text-rose-200">Erro atual: {llmControl.server.error}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {llmControl.server.models.map((model) => (
                      <span key={model.name} className="rounded-full border border-cyan-200/30 bg-cyan-900/25 px-2 py-0.5">
                        {model.name}
                      </span>
                    ))}
                    {llmControl.server.models.length === 0 && (
                      <span className="text-cyan-100/75">Nenhum modelo detectado pelo endpoint /api/tags.</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    <span className="mb-1 block text-cyan-100/85">Runtime habilitado</span>
                    <select
                      value={llmControl.runtime.enabled ? "true" : "false"}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? { ...prev, runtime: { ...prev.runtime, enabled: e.target.value === "true" } }
                            : prev,
                        )
                      }
                      className="w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    <span className="mb-1 block text-cyan-100/85">Base URL</span>
                    <input
                      value={llmControl.runtime.baseUrl}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? { ...prev, runtime: { ...prev.runtime, baseUrl: e.target.value } }
                            : prev,
                        )
                      }
                      className="w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-5">
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Modelo default
                    <input
                      value={llmControl.runtime.models.default}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: { ...prev.runtime, models: { ...prev.runtime.models, default: e.target.value } },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Missao
                    <input
                      value={llmControl.runtime.models.mission}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: { ...prev.runtime, models: { ...prev.runtime.models, mission: e.target.value } },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Simulacao
                    <input
                      value={llmControl.runtime.models.simulation}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: { ...prev.runtime, models: { ...prev.runtime.models, simulation: e.target.value } },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Disputa
                    <input
                      value={llmControl.runtime.models.dispute}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: { ...prev.runtime, models: { ...prev.runtime.models, dispute: e.target.value } },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    RPG
                    <input
                      value={llmControl.runtime.models.rpg}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: { ...prev.runtime, models: { ...prev.runtime.models, rpg: e.target.value } },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-5">
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Timeout default
                    <input
                      type="number"
                      value={llmControl.runtime.timeoutsMs.default}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                timeoutsMs: { ...prev.runtime.timeoutsMs, default: Number(e.target.value || 0) },
                              },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Missao
                    <input
                      type="number"
                      value={llmControl.runtime.timeoutsMs.mission}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                timeoutsMs: { ...prev.runtime.timeoutsMs, mission: Number(e.target.value || 0) },
                              },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Simulacao
                    <input
                      type="number"
                      value={llmControl.runtime.timeoutsMs.simulation}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                timeoutsMs: { ...prev.runtime.timeoutsMs, simulation: Number(e.target.value || 0) },
                              },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Disputa
                    <input
                      type="number"
                      value={llmControl.runtime.timeoutsMs.dispute}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                timeoutsMs: { ...prev.runtime.timeoutsMs, dispute: Number(e.target.value || 0) },
                              },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    RPG
                    <input
                      type="number"
                      value={llmControl.runtime.timeoutsMs.rpg}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                timeoutsMs: { ...prev.runtime.timeoutsMs, rpg: Number(e.target.value || 0) },
                              },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Tentativas de retry
                    <input
                      type="number"
                      value={llmControl.runtime.retries.attempts}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                retries: { ...prev.runtime.retries, attempts: Number(e.target.value || 0) },
                              },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Retry backoff (ms)
                    <input
                      type="number"
                      value={llmControl.runtime.retries.backoffMs}
                      onChange={(e) =>
                        setLlmControl((prev) =>
                          prev
                            ? {
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                retries: { ...prev.runtime.retries, backoffMs: Number(e.target.value || 0) },
                              },
                            }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Warmup models (separados por virgula)
                    <input
                      value={llmWarmupModelsInput}
                      onChange={(e) => setLlmWarmupModelsInput(e.target.value)}
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                    Warmup prompt
                    <input
                      value={llmWarmupPrompt}
                      onChange={(e) => setLlmWarmupPrompt(e.target.value)}
                      className="mt-1 w-full rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={() =>
                        void runLlmControlAction({
                          action: "warmup",
                          warmupModels: llmWarmupModelsInput
                            .split(",")
                            .map((item) => item.trim())
                            .filter((item) => item.length > 0),
                          warmupPrompt: llmWarmupPrompt.trim() || undefined,
                        })
                      }
                      disabled={llmControlActionLoading}
                    >
                      Warmup
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void runLlmControlAction({
                          action: "update",
                          config: llmControl.runtime,
                        })
                      }
                      disabled={llmControlActionLoading}
                    >
                      Salvar runtime
                    </Button>
                  </div>
                </div>

                <div className="mt-2 rounded-md border border-cyan-200/25 bg-black/25 p-3">
                  <p className="text-xs text-cyan-100/85">Teste manual do modelo</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-[220px_1fr_auto]">
                    <input
                      value={llmTestModel}
                      onChange={(e) => setLlmTestModel(e.target.value)}
                      placeholder="Modelo opcional"
                      className="rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1 text-xs"
                    />
                    <input
                      value={llmTestPrompt}
                      onChange={(e) => setLlmTestPrompt(e.target.value)}
                      placeholder="Prompt de teste"
                      className="rounded-md border border-cyan-200/25 bg-black/30 px-2 py-1 text-xs"
                    />
                    <Button
                      onClick={() =>
                        void runLlmControlAction({
                          action: "test",
                          model: llmTestModel.trim() || undefined,
                          prompt: llmTestPrompt.trim() || undefined,
                        })
                      }
                      disabled={llmControlActionLoading}
                    >
                      Testar
                    </Button>
                  </div>
                  {llmTestResult && (
                    <div className="mt-2 rounded-md border border-cyan-200/25 bg-black/25 p-2 text-xs">
                      <p>Modelo: {llmTestResult.model}</p>
                      <p>
                        Duracao(ns): {llmTestResult.durationNs ?? "-"} | Eval: {llmTestResult.evalCount ?? "-"}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-cyan-100/90">{llmTestResult.response}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 rounded-md border border-cyan-200/25 bg-black/25 p-3">
                  <p className="text-xs font-semibold text-cyan-100/90">Chamadas recentes do Ollama</p>
                  <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1 text-xs">
                    {llmControl.telemetry.calls.map((call) => (
                      <p key={call.id} className="rounded-md border border-cyan-100/20 bg-black/30 px-2 py-1">
                        [{call.success ? "OK" : "ERRO"}] {call.requestTag} | {call.model} | {call.durationMs}ms
                        {!call.success && call.code ? ` | ${call.code}` : ""} | {formatDate(call.at)}
                      </p>
                    ))}
                    {llmControl.telemetry.calls.length === 0 && (
                      <p className="text-cyan-100/75">Ainda nao existem chamadas registradas.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="rounded-xl border border-cyan-200/25 bg-cyan-950/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Monitor de pipeline LLM</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => post("/api/admin/simulations/run")}>
                  Rodar simulacao rapida
                </Button>
                <Button onClick={runFullSimulation} disabled={fullRunLoading}>
                  {fullRunLoading ? "Executando jornada..." : "Rodar jornada completa"}
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr]">
              <select
                value={fullRunScenario}
                onChange={(e) => setFullRunScenario(e.target.value as FullRunResult["scenario"])}
                className="rounded-md border border-cyan-200/25 bg-black/25 px-3 py-2 text-sm"
              >
                <option value="MIXED">Cenario misto</option>
                <option value="FULL_CYCLE">Ciclo completo</option>
                <option value="REVISION_CYCLE">Ciclo com revisao</option>
                <option value="DISPUTE_CYCLE">Ciclo com disputa</option>
                <option value="APPROVAL_QUEUE">Fila de aprovacao</option>
              </select>
              <input
                value={fullRunModel}
                onChange={(e) => setFullRunModel(e.target.value)}
                placeholder="Modelo (ex: phi3:mini)"
                className="rounded-md border border-cyan-200/25 bg-black/25 px-3 py-2 text-sm"
              />
            </div>

            {fullRunResult && (
              <div className="mt-3 rounded-md border border-cyan-200/25 bg-black/25 p-3 text-xs">
                <p>
                  Cenario: <strong>{fullRunResult.scenario}</strong> | Status:{" "}
                  <strong>{fullRunResult.status}</strong>
                </p>
                <p className="mt-1">
                  Patrono: {fullRunResult.patronEmail ?? "aguardando"} | Aventureiro:{" "}
                  {fullRunResult.adventurerEmail ?? "aguardando"}
                </p>
                <p className="mt-1">
                  Fonte: {fullRunResult.source ?? "aguardando"} | Modelo:{" "}
                  {fullRunResult.model ?? "aguardando"} | Motivo:{" "}
                  {fullRunResult.reason ?? "aguardando"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {fullRunResult.missionId && (
                    <Link
                      href={`/mission/${fullRunResult.missionId}`}
                      className="rounded-md border border-cyan-300/35 bg-cyan-700/20 px-2 py-1 text-xs"
                    >
                      Abrir missao
                    </Link>
                  )}
                  {fullRunResult.disputeId && (
                    <Button variant="ghost" onClick={() => setActiveTab("disputes")}>
                      Ir para disputas
                    </Button>
                  )}
                  {fullRunResult.status === "AWAITING_ADMIN_APPROVAL" && (
                    <Button variant="ghost" onClick={() => setActiveTab("missions")}>
                      Ir para aprovacoes
                    </Button>
                  )}
                </div>
                {fullRunResult.nextAction && (
                  <p className="mt-2 text-cyan-100/90">{fullRunResult.nextAction}</p>
                )}
              </div>
            )}

            <div className="mt-3 grid gap-2 text-sm md:grid-cols-3 xl:grid-cols-5">
              <article className="rounded-md border border-cyan-200/25 bg-black/25 p-3">
                <p className="text-xs text-cyan-100/80">Triagens registradas</p>
                <p className="text-xl font-semibold">{llmPipeline.summary.screenedTotal}</p>
                <p className="text-xs text-cyan-100/70">24h: {llmPipeline.summary.screened24h}</p>
              </article>
              <article className="rounded-md border border-cyan-200/25 bg-black/25 p-3">
                <p className="text-xs text-cyan-100/80">Pendentes de aprovacao</p>
                <p className="text-xl font-semibold">{llmPipeline.summary.pendingApproval}</p>
                <p className="text-xs text-cyan-100/70">Evento de triagem: {llmPipeline.summary.screenEventsLogged}</p>
              </article>
              <article className="rounded-md border border-cyan-200/25 bg-black/25 p-3">
                <p className="text-xs text-cyan-100/80">Decisoes humanas</p>
                <p className="text-xl font-semibold">{llmPipeline.summary.approvalsTotal}</p>
                <p className="text-xs text-cyan-100/70">24h: {llmPipeline.summary.approvals24h}</p>
              </article>
              <article className="rounded-md border border-cyan-200/25 bg-black/25 p-3">
                <p className="text-xs text-cyan-100/80">Simulacoes/Jornadas</p>
                <p className="text-xl font-semibold">{llmPipeline.summary.simulationsTotal}</p>
                <p className="text-xs text-cyan-100/70">24h: {llmPipeline.summary.simulations24h}</p>
              </article>
              <article className="rounded-md border border-cyan-200/25 bg-black/25 p-3">
                <p className="text-xs text-cyan-100/80">Triagem de disputas IA</p>
                <p className="text-xl font-semibold">{llmPipeline.summary.disputesTriagedTotal}</p>
                <p className="text-xs text-cyan-100/70">24h: {llmPipeline.summary.disputesTriaged24h}</p>
              </article>
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
              <p className="rounded-md border border-rose-300/30 bg-rose-950/25 p-2">
                Fallback aguardando: {llmPipeline.summary.simulationsAwaiting}
              </p>
              <p className="rounded-md border border-amber-300/30 bg-amber-950/20 p-2">
                Regra: tudo sem resposta de modelo fica como aguardando.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-cyan-200/25 bg-black/20 p-4">
            <h3 className="font-semibold">Eventos recentes do pipeline</h3>
            <div className="mt-3 max-h-[520px] space-y-2 overflow-auto text-xs">
              {llmPipeline.events.map((event) => (
                <article key={event.id} className="rounded-md border border-cyan-100/20 bg-black/25 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-cyan-300/35 bg-cyan-700/20 px-2 py-0.5">{event.action}</span>
                    <span className={`rounded-md border px-2 py-0.5 ${getPipelineTone(event.status)}`}>{event.status}</span>
                    <span className="rounded-md border border-amber-300/35 bg-amber-700/20 px-2 py-0.5">{event.model}</span>
                  </div>
                  <p className="mt-1 text-amber-100/85">
                    {event.targetType} {event.targetId || "-"} • {event.actor}
                  </p>
                  <p className="text-amber-100/70">{new Date(event.createdAt).toLocaleString("pt-BR")}</p>
                </article>
              ))}
              {llmPipeline.events.length === 0 && (
                <p className="text-sm text-amber-100/75">Sem eventos de pipeline por enquanto (aguardando).</p>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "store" && (
        <div className="space-y-5">
          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Founders</h2>
            <div className="mt-2 space-y-2 text-sm">
              {founders.map((pledge) => (
                <div key={pledge.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-100/10 bg-black/25 p-3">
                  <span>{pledge.userEmail} - {pledge.tier}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${getStatusTone(pledge.status)}`}>{pledge.status}</span>
                  <Button onClick={() => post(`/api/admin/founders/${pledge.id}/confirm`)}>Confirmar</Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Loja (pedidos manuais)</h2>
            <div className="mt-2 space-y-2 text-sm">
              {storeRequests.map((request) => (
                <article key={request.requestId} className="rounded-md border border-amber-100/10 bg-black/25 p-3">
                  <p className="font-medium">{request.itemName}</p>
                  <p className="text-xs text-amber-100/80">
                    {request.userEmail} • {request.priceBrl} • {request.priceEnchantiun} Enchantiun
                  </p>
                  <p className="text-xs text-amber-100/75">
                    Pedido: {new Date(request.createdAt).toLocaleString("pt-BR")}
                  </p>
                  {request.proofUrl && (
                    <a href={request.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-300 underline">
                      Ver comprovante
                    </a>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        post("/api/admin/store/confirm", {
                          requestId: request.requestId,
                          decision: "APPROVE",
                          comment: "Compra manual aprovada.",
                        })
                      }
                    >
                      Aprovar compra
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() =>
                        post("/api/admin/store/confirm", {
                          requestId: request.requestId,
                          decision: "REJECT",
                          comment: "Compra manual rejeitada.",
                        })
                      }
                    >
                      Rejeitar compra
                    </Button>
                  </div>
                </article>
              ))}
              {storeRequests.length === 0 && (
                <p className="text-sm text-amber-100/75">Sem pedidos manuais pendentes na loja.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "compliance" && (
        <div className="space-y-5">
          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Busca de auditoria</h2>
            <form className="mt-2 flex gap-2" method="GET">
              <input name="audit" defaultValue={audit.query} placeholder="Acao, targetType ou targetId" className="w-full rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm" />
              <Button type="submit">Buscar</Button>
            </form>
            <div className="mt-3 max-h-80 space-y-2 overflow-auto text-xs">
              {audit.logs.map((log) => (
                <div key={log.id} className="rounded-md border border-amber-100/10 p-2">
                  <p>{log.action} • {log.targetType} • {log.targetId || "-"}</p>
                  <p>{log.actor} • {new Date(log.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              ))}
              {audit.logs.length === 0 && <p>Nenhum log encontrado.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-amber-200/20 bg-black/20 p-4">
            <h2 className="font-semibold">Dashboard de erros</h2>
            <div className="mt-2 grid gap-2 text-xs md:grid-cols-4">
              <p className="rounded-md border border-amber-100/20 p-2">24h total: {errors.summary.total24h}</p>
              <p className="rounded-md border border-amber-100/20 p-2">Server: {errors.summary.server24h}</p>
              <p className="rounded-md border border-amber-100/20 p-2">Client: {errors.summary.client24h}</p>
              <p className="rounded-md border border-amber-100/20 p-2">Edge: {errors.summary.edge24h}</p>
            </div>
            <form className="mt-2 flex flex-wrap gap-2" method="GET">
              <input name="error" defaultValue={errors.query} placeholder="Buscar por mensagem, rota ou request id" className="min-w-[260px] flex-1 rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm" />
              <select name="errorSource" defaultValue={errors.source} className="rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="SERVER">SERVER</option>
                <option value="CLIENT">CLIENT</option>
                <option value="EDGE">EDGE</option>
              </select>
              <Button type="submit">Filtrar</Button>
            </form>
            <div className="mt-3 max-h-80 space-y-2 overflow-auto text-xs">
              {errors.events.map((event) => (
                <div key={event.id} className="rounded-md border border-amber-100/10 p-2">
                  <p>{event.source} • {event.statusCode} • {event.method || "-"} {event.route || "-"}</p>
                  <p>{event.message}</p>
                  <p>ReqID: {event.requestId || "-"} • User: {event.user}</p>
                  <p>{new Date(event.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              ))}
              {errors.events.length === 0 && <p>Nenhum erro registrado para o filtro atual.</p>}
            </div>
          </section>
        </div>
      )}

      {message && <p className="rounded-md border border-amber-200/20 bg-black/20 px-3 py-2 text-sm text-amber-100">{message}</p>}
    </div>
  );
}
