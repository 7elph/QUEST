"use client";

import { useState } from "react";
import Image from "next/image";
import { FounderTier } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FounderPledgeForm() {
  const [tier, setTier] = useState<FounderTier>(FounderTier.INICIADO);
  const [proofUrl, setProofUrl] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    const response = await fetch("/api/founders/pledges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, proofUrl }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Falha no pledge.");
      return;
    }

    setMessage("Pledge enviado. Aguardando confirmacao do admin.");
  };

  return (
    <div className="quest-panel quest-panel-texture space-y-3 rounded-xl border border-amber-200/20 bg-black/20 p-4">
      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-amber-200/80">
        <Image src="/assets/icones/Misc/Golden Key.png" alt="" aria-hidden width={14} height={14} className="h-3.5 w-3.5 object-contain" />
        Confirmacao Founder
      </p>
      <select className="w-full rounded-md border border-amber-100/20 bg-slate-900/80 p-2" value={tier} onChange={(e) => setTier(e.target.value as FounderTier)}>
        {Object.values(FounderTier).map((item) => <option key={item}>{item}</option>)}
      </select>
      <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="Comprovante PIX (url/id)" />
      <Button onClick={submit}>
        <span className="inline-flex items-center gap-1.5">
          <Image src="/assets/icones/Misc/Envolop.png" alt="" aria-hidden width={14} height={14} className="h-3.5 w-3.5 object-contain" />
          Enviar apoio
        </span>
      </Button>
      {message && <p className="text-sm text-amber-100">{message}</p>}
    </div>
  );
}
