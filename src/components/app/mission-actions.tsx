"use client";

import { useState } from "react";
import { ReviewDecision } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MissionActions({ missionId, canAccept, canSubmit, canReview }: { missionId: string; canAccept: boolean; canSubmit: boolean; canReview: boolean }) {
  const router = useRouter();
  const [proofLink, setProofLink] = useState("");
  const [proofFileUrl, setProofFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const call = async (url: string, body?: unknown, onSuccessPath?: string) => {
    setLoading(true);
    setMessage("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage("Acao executada com sucesso.");
      if (onSuccessPath) {
        router.push(onSuccessPath);
      }
      router.refresh();
    } else {
      setMessage(data.error ?? "Falha na acao.");
    }
    setLoading(false);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setMessage("");
    const form = new FormData();
    form.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: form,
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setProofFileUrl(data.url ?? "");
      setMessage("Arquivo enviado com sucesso.");
    } else {
      setMessage(data.error ?? "Falha no upload.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {canAccept && <Button disabled={loading} onClick={() => call(`/api/missions/${missionId}/accept`, undefined, "/profile#missoes")}>Aceitar Missao</Button>}

      {canSubmit && (
        <div className="space-y-2 rounded-md border border-amber-100/20 p-3">
          <h3 className="text-sm font-semibold">Enviar prova</h3>
          <Input placeholder="Link da prova" value={proofLink} onChange={(e) => setProofLink(e.target.value)} />
          <label className="block text-xs text-amber-100/80">Upload de arquivo (PNG/JPG/PDF/TXT ate 5MB)</label>
          <input type="file" onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)} className="w-full text-sm" />
          {proofFileUrl && <p className="text-xs text-amber-300">Arquivo: {proofFileUrl}</p>}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="h-20 w-full rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm" placeholder="Notas" />
          <Button disabled={loading} onClick={() => call(`/api/missions/${missionId}/submit`, { proofLinks: proofLink ? [proofLink] : [], proofFiles: proofFileUrl ? [proofFileUrl] : [], notes })}>Enviar</Button>
        </div>
      )}

      {canReview && (
        <div className="space-y-2 rounded-md border border-amber-100/20 p-3">
          <h3 className="text-sm font-semibold">Revisar entrega</h3>
          <Input placeholder="Comentario" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={loading} onClick={() => call(`/api/missions/${missionId}/review`, { decision: ReviewDecision.ACCEPT, comment: reviewComment })}>Aprovar</Button>
            <Button disabled={loading} variant="ghost" onClick={() => call(`/api/missions/${missionId}/review`, { decision: ReviewDecision.REVISION, comment: reviewComment })}>Pedir revisao</Button>
            <Button disabled={loading} variant="danger" onClick={() => call(`/api/missions/${missionId}/review`, { decision: ReviewDecision.REJECT, comment: reviewComment })}>Rejeitar</Button>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-md border border-amber-100/20 p-3">
        <h3 className="text-sm font-semibold">Abrir disputa</h3>
        <Input placeholder="Motivo" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
        <Button disabled={loading} variant="ghost" onClick={() => call(`/api/missions/${missionId}/dispute`, { reason: disputeReason })}>Abrir Disputa</Button>
      </div>

      {message && <p className="text-sm text-amber-100">{message}</p>}
    </div>
  );
}
