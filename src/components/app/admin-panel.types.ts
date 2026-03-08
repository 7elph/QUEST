import { MissionStatus } from "@prisma/client";

export type TriageResult = {
  summary: string;
  recommendation: "COMPLETE_MISSION" | "KEEP_DISPUTE_OPEN" | "REQUEST_REVISION" | "REJECT_SUBMISSION";
  confidence: number;
  inconsistencies: Array<{ severity: "LOW" | "MEDIUM" | "HIGH"; title: string; details: string; evidence: string[] }>;
  adminChecklist: string[];
};

export type TriageGate = {
  finalRecommendation: "COMPLETE_MISSION" | "KEEP_DISPUTE_OPEN" | "REQUEST_REVISION" | "REJECT_SUBMISSION";
  wasOverridden: boolean;
  reasons: string[];
  minConfidenceForComplete: number;
  hasHighSeverity: boolean;
};

export type FullRunResult = {
  success: boolean;
  status: string;
  scenario: "FULL_CYCLE" | "REVISION_CYCLE" | "DISPUTE_CYCLE" | "APPROVAL_QUEUE" | "MIXED";
  missionId?: string;
  submissionId?: string;
  disputeId?: string | null;
  patronEmail?: string;
  adventurerEmail?: string;
  source?: string;
  model?: string;
  reason?: string;
  nextAction?: string;
  message?: string;
};

export type AdminPanelProps = {
  users: Array<{ id: string; email: string; role: string; status: string; adminScope: string; enchantiunBalance: number }>;
  missions: Array<{
    id: string;
    title: string;
    status: string;
    escrowStatus: string;
    categoryLabel: string;
    categoryIcon: string;
    rank: "E" | "D" | "C" | "B" | "A" | "S";
    summary: string;
    neighborhood: string;
    city: string;
    state: string;
    patronName: string;
    deadlineAt: string;
    enchantiun: number;
    dropName: string | null;
    dropIconPath: string | null;
  }>;
  disputes: Array<{ id: string; missionId: string; reason: string; status: string }>;
  founders: Array<{ id: string; tier: string; status: string; userEmail: string }>;
  storeRequests: Array<{
    requestId: string;
    userEmail: string;
    userId: string;
    itemId: string;
    itemName: string;
    priceEnchantiun: number;
    priceBrl: string;
    proofUrl: string;
    createdAt: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    title: string;
    patron: string;
    screeningDecision: string;
    screeningConfidence: number;
    screeningSummary: string;
    screeningModel: string;
    screeningCreatedAt: string;
  }>;
  inbox: {
    pendingEscrow: Array<{ id: string; title: string; escrowStatus: string }>;
    openDisputes: Array<{ id: string; reason: string; missionId: string }>;
    pendingFounders: Array<{ id: string; tier: string; userEmail: string }>;
  };
  audit: {
    query: string;
    logs: Array<{ id: string; action: string; targetType: string; targetId: string; actor: string; createdAt: string }>;
  };
  errors: {
    query: string;
    source: string;
    summary: {
      total24h: number;
      server24h: number;
      client24h: number;
      edge24h: number;
    };
    events: Array<{
      id: string;
      source: string;
      route: string;
      method: string;
      statusCode: number;
      requestId: string;
      message: string;
      user: string;
      createdAt: string;
    }>;
  };
  llmPipeline: {
    summary: {
      screenedTotal: number;
      screened24h: number;
      pendingApproval: number;
      approvalsTotal: number;
      approvals24h: number;
      simulationsTotal: number;
      simulations24h: number;
      simulationsAwaiting: number;
      disputesTriagedTotal: number;
      disputesTriaged24h: number;
      screenEventsLogged: number;
    };
    events: Array<{
      id: string;
      action: string;
      status: string;
      model: string;
      targetType: string;
      targetId: string;
      actor: string;
      createdAt: string;
    }>;
  };
};

export type LlmControlSnapshot = {
  runtime: {
    enabled: boolean;
    baseUrl: string;
    models: {
      default: string;
      mission: string;
      simulation: string;
      dispute: string;
      rpg: string;
    };
    timeoutsMs: {
      default: number;
      mission: number;
      simulation: number;
      dispute: number;
      rpg: number;
    };
    retries: {
      attempts: number;
      backoffMs: number;
    };
    warmup: {
      models: string[];
      prompt: string;
    };
  };
  overrides: Record<string, unknown>;
  server: {
    enabled: boolean;
    reachable: boolean;
    baseUrl: string;
    error: string | null;
    models: Array<{ name: string; size: number | null; modifiedAt: string | null }>;
  };
  telemetry: {
    summary: {
      total: number;
      success: number;
      failed: number;
      lastSuccessAt: string | null;
      lastFailureAt: string | null;
      byTag: Record<string, { total: number; success: number; failed: number }>;
    };
    calls: Array<{
      id: string;
      at: string;
      requestTag: string;
      model: string;
      success: boolean;
      attempts: number;
      durationMs: number;
      code?: string;
      status?: number;
      details?: string;
    }>;
  };
};

export type AdminTab = "overview" | "users" | "missions" | "disputes" | "llm" | "store" | "compliance";
export type MissionViewMode = "KANBAN" | "LIST" | "PREVIEW";

export const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: "overview", label: "Visao geral" },
  { id: "users", label: "Usuarios" },
  { id: "missions", label: "Missoes" },
  { id: "disputes", label: "Disputas" },
  { id: "llm", label: "Pipeline LLM" },
  { id: "store", label: "Loja & founders" },
  { id: "compliance", label: "Auditoria & erros" },
];

export const missionKanbanColumns: Array<{ status: MissionStatus; label: string }> = [
  { status: MissionStatus.DRAFT, label: "Rascunho" },
  { status: MissionStatus.OPEN, label: "Aberta" },
  { status: MissionStatus.ASSIGNED, label: "Em execucao" },
  { status: MissionStatus.IN_REVIEW, label: "Em analise" },
  { status: MissionStatus.REVISION_REQUESTED, label: "Revisao" },
  { status: MissionStatus.DISPUTED, label: "Disputa" },
  { status: MissionStatus.COMPLETED, label: "Concluida" },
  { status: MissionStatus.CANCELLED, label: "Cancelada" },
];
