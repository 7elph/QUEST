import { MissionStatus } from "@prisma/client";

export function parseMissionStatus(status: string): MissionStatus | null {
  const values = Object.values(MissionStatus) as string[];
  return values.includes(status) ? (status as MissionStatus) : null;
}

export function getStatusTone(status: string) {
  if (status === "ACTIVE" || status === "OPEN") return "border-emerald-300/35 bg-emerald-700/20 text-emerald-100";
  if (status === "SUSPENDED" || status === "PENDING") return "border-amber-300/35 bg-amber-700/20 text-amber-100";
  if (status === "BANNED" || status === "CANCELLED") return "border-rose-300/35 bg-rose-700/20 text-rose-100";
  return "border-slate-300/30 bg-slate-700/20 text-slate-100";
}

export function getPipelineTone(status: string) {
  if (["APPROVE", "ACCEPT", "COMPLETE_MISSION", "LLM", "SAFE", "ALLOW"].some((item) => status.includes(item))) {
    return "border-emerald-300/35 bg-emerald-700/20 text-emerald-100";
  }
  if (["REJECT", "BLOCK", "HIGH", "AWAITING"].some((item) => status.includes(item))) {
    return "border-rose-300/35 bg-rose-700/20 text-rose-100";
  }
  return "border-amber-300/35 bg-amber-700/20 text-amber-100";
}

export function getMissionStatusLabel(status: string) {
  if (status === "OPEN") return "Aberta";
  if (status === "ASSIGNED") return "Em execucao";
  if (status === "IN_REVIEW") return "Em analise";
  if (status === "REVISION_REQUESTED") return "Ajuste solicitado";
  if (status === "COMPLETED") return "Concluida";
  if (status === "DISPUTED") return "Disputa";
  if (status === "CANCELLED") return "Cancelada";
  if (status === "DRAFT") return "Rascunho";
  return status;
}

export function getEscrowLabel(status: string) {
  if (status === "NONE") return "Sem cofre";
  if (status === "PENDING") return "Pendente";
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "RELEASED") return "Liberado";
  if (status === "REFUNDED") return "Reembolsado";
  return status;
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}
