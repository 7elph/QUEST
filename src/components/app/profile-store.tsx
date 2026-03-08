"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { storeTypeIcons } from "@/lib/quest-icons";

type StoreItemView = {
  id: string;
  name: string;
  type: "ARTEFATO" | "RELIQUIA";
  rarity: "COMUM" | "RARO" | "EPICO";
  priceEnchantiun: number;
  priceBrl: string;
  effect: string;
  iconPath: string;
  stackable: boolean;
};

export function ProfileStore({
  items,
  ownedCounts,
  enchantiunBalance,
  canPurchase,
}: {
  items: StoreItemView[];
  ownedCounts: Record<string, number>;
  enchantiunBalance: number;
  canPurchase: boolean;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState(enchantiunBalance);
  const [ownedCountByItem, setOwnedCountByItem] = useState<Record<string, number>>(ownedCounts);
  const [proofByItem, setProofByItem] = useState<Record<string, string>>({});
  const [loadingItem, setLoadingItem] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const rarityStyles: Record<StoreItemView["rarity"], string> = {
    COMUM: "border-slate-300/35 bg-slate-500/12 text-slate-100",
    RARO: "border-amber-300/35 bg-amber-500/12 text-amber-100",
    EPICO: "border-cyan-300/35 bg-cyan-500/12 text-cyan-100",
  };

  const buy = async (itemId: string, method: "ENCHANTIUN" | "MANUAL") => {
    setLoadingItem(`${itemId}:${method}`);
    setMessage("");
    const response = await fetch("/api/store/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        method,
        proofUrl: proofByItem[itemId] || undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "Falha na compra.");
      setLoadingItem(null);
      return;
    }

    if (data.status === "CONFIRMED") {
      setOwnedCountByItem((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }));
      if (typeof data.enchantiunBalance === "number") {
        setBalance(data.enchantiunBalance);
      }
      setMessage("Compra confirmada e efeito ativado no perfil.");
    } else {
      setMessage("Pedido manual enviado para aprovacao do admin.");
    }
    setLoadingItem(null);
    router.refresh();
  };

  return (
    <section className="quest-panel quest-panel-texture rounded-2xl border border-amber-200/20 bg-black/25 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200/75">Loja da guilda (alpha)</p>
          <h2 className="mt-1 text-2xl font-semibold text-amber-100">Artefatos e reliquias</h2>
          <p className="mt-1 text-sm text-amber-100/80">Itens visuais e colecionaveis.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
          <Image src="/assets/Crystal.png" alt="Enchantiun" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
          <span className="font-semibold">{balance}</span>
          <span className="text-cyan-100/80">Enchantiun</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => {
          const ownedCount = ownedCountByItem[item.id] ?? 0;
          const lockedByOwnership = !item.stackable && ownedCount > 0;
          return (
            <article key={item.id} className="quest-panel quest-panel-solid rounded-xl border border-amber-100/15 bg-black/30 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <div className="rounded-lg border border-amber-200/35 bg-black/35 p-2 shadow-[0_0_0_1px_rgba(245,199,112,0.2)_inset,0_0_18px_rgba(245,199,112,0.18)]">
                    <Image src={item.iconPath} alt={item.name} width={28} height={28} className="h-7 w-7 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-amber-100">{item.name}</h3>
                    <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-amber-200/80">
                      <Image
                        src={storeTypeIcons[item.type]}
                        alt=""
                        aria-hidden
                        width={12}
                        height={12}
                        className="h-3 w-3 object-contain"
                      />
                      {item.type}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${rarityStyles[item.rarity]}`}>
                  {item.rarity}
                </span>
              </div>
              <p className="mt-2 text-sm text-amber-100/80">{item.effect}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-md border border-amber-200/30 bg-black/25 px-2 py-1 text-amber-100/90">{item.priceBrl}</span>
                <span className="inline-flex items-center justify-center gap-1 rounded-md border border-cyan-300/35 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                  <Image src="/assets/Crystal.png" alt="Enchantiun" width={14} height={14} className="h-[14px] w-[14px] object-contain" />
                  {item.priceEnchantiun}
                </span>
              </div>
              {ownedCount > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-200/85">
                  <Image src="/assets/icones/Equipment/Bag.png" alt="" aria-hidden width={12} height={12} className="h-3 w-3 object-contain" />
                  No inventario: x{ownedCount}
                </p>
              )}

              {!canPurchase ? (
                <p className="mt-3 text-xs text-amber-100/70">Apenas aventureiros podem comprar artefatos.</p>
              ) : lockedByOwnership ? (
                <span className="mt-3 inline-flex rounded-full border border-emerald-300/45 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-100">
                  Ativo no perfil
                </span>
              ) : (
                <div className="mt-3 space-y-2">
                  <Button
                    onClick={() => buy(item.id, "ENCHANTIUN")}
                    disabled={loadingItem !== null}
                    className="w-full bg-cyan-600 text-white hover:bg-cyan-500"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Image src="/assets/Crystal.png" alt="" aria-hidden width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                      Comprar com Enchantiun
                    </span>
                  </Button>
                  <input
                    value={proofByItem[item.id] ?? ""}
                    onChange={(e) => setProofByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Link comprovante PIX (opcional)"
                    className="w-full rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-xs text-amber-50"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => buy(item.id, "MANUAL")}
                    disabled={loadingItem !== null}
                    className="w-full"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Image src="/assets/icones/Misc/Envolop.png" alt="" aria-hidden width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                      Solicitar compra manual
                    </span>
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {message && <p className="mt-3 text-sm text-amber-100">{message}</p>}
    </section>
  );
}
