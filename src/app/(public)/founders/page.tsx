export const dynamic = "force-dynamic";

import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { FounderPledgeForm } from "@/components/app/founder-pledge-form";
import { getServerAuthSession } from "@/lib/auth";
import { ProfileStore } from "@/components/app/profile-store";
import { storeCatalog } from "@/lib/store";
import { prisma } from "@/lib/prisma";

const founderTiers = [
  {
    id: "iniciado",
    title: "Iniciado",
    price: "R$ 9,90",
    badgeLabel: "Badge de entrada",
    badgeIconPath: "/assets/icones/Misc/Silver Coin.png",
    rewards: [
      {
        label: "Badge visual",
        detail: "Selo Iniciado no inventario",
        iconPath: "/assets/icones/Misc/Heart.png",
        detailClass: "text-slate-200/80",
      },
      {
        label: "Nick reservado",
        detail: "Cor prateada",
        iconPath: "/assets/icones/Misc/Silver Key.png",
        detailClass: "font-semibold text-slate-200",
      },
      {
        label: "Grupo Alpha",
        detail: "Canal fechado",
        iconPath: "/assets/icones/Misc/Lantern.png",
        detailClass: "font-mono tracking-[0.08em] text-violet-200",
      },
    ],
    iconPath: "/assets/icones/Misc/Silver Coin.png",
    accent: "border-slate-300/35 bg-slate-500/10",
  },
  {
    id: "fundador",
    title: "Fundador",
    price: "R$ 19,90",
    badgeLabel: "Badge fundador",
    badgeIconPath: "/assets/icones/Misc/Golden Coin.png",
    rewards: [
      {
        label: "Hall Founder",
        detail: "Nome no mural",
        iconPath: "/assets/icones/Misc/Book.png",
        detailClass: "text-amber-100/85",
      },
      {
        label: "Nick reservado",
        detail: "Cor dourada",
        iconPath: "/assets/icones/Misc/Golden Key.png",
        detailClass: "font-semibold text-amber-300",
      },
      {
        label: "Early access",
        detail: "Entrada antecipada",
        iconPath: "/assets/icones/Misc/Map.png",
        detailClass: "text-cyan-200",
      },
    ],
    iconPath: "/assets/icones/Misc/Golden Coin.png",
    accent: "border-amber-300/35 bg-amber-500/12",
  },
  {
    id: "patrono-inicial",
    title: "Patrono Inicial",
    price: "R$ 49,90",
    badgeLabel: "Badge premium",
    badgeIconPath: "/assets/icones/Misc/Chest.png",
    rewards: [
      {
        label: "Voto de roadmap",
        detail: "Peso maior de voto",
        iconPath: "/assets/icones/Misc/Scroll.png",
        detailClass: "text-cyan-200",
      },
      {
        label: "Nick reservado",
        detail: "Cor cristal",
        iconPath: "/assets/icones/Misc/Silver Key.png",
        detailClass: "font-semibold text-cyan-300",
      },
      {
        label: "Selo premium",
        detail: "Destaque visual",
        iconPath: "/assets/icones/Misc/Chest.png",
        detailClass: "text-amber-100",
      },
    ],
    iconPath: "/assets/icones/Misc/Chest.png",
    accent: "border-cyan-300/35 bg-cyan-500/12",
  },
];

export default async function FoundersPage() {
  const session = await getServerAuthSession();
  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          profile: { select: { badges: true } },
          xpLogs: { select: { xpChange: true } },
        },
      })
    : null;

  const badges = user?.profile?.badges ?? [];
  const ownedCounts = storeCatalog.reduce<Record<string, number>>((acc, item) => {
    const count = badges.filter((badge) => badge === item.badge).length;
    if (count > 0) {
      acc[item.id] = count;
    }
    return acc;
  }, {});
  const enchantiunBalance = user?.xpLogs.reduce((sum, item) => sum + item.xpChange, 0) ?? 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-amber-200/30">
        <div className="absolute inset-0 bg-[url('/assets/fundo_quadro.png')] bg-cover bg-center opacity-35" />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(17,12,10,0.88),rgba(11,10,13,0.74),rgba(8,10,14,0.78))]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-6 md:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Marketplace Alpha</p>
            <h1 className="mt-2 text-3xl font-bold text-amber-100 md:text-4xl">Loja da Guilda</h1>
            <p className="mt-2 text-sm text-amber-50/85">Itens cosmeticos e consumiveis. Sem pay-to-win.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-500/12 px-4 py-2 text-cyan-100">
            <Image src="/assets/Crystal.png" alt="Enchantiun" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
            <span className="text-sm font-semibold">{enchantiunBalance}</span>
            <span className="text-xs uppercase tracking-[0.12em] text-cyan-100/80">Enchantiun</span>
          </div>
        </div>
      </section>

      <ProfileStore
        items={storeCatalog.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          rarity: item.rarity,
          priceEnchantiun: item.priceEnchantiun,
          priceBrl: item.priceBrl,
          effect: item.effect,
          iconPath: item.iconPath,
          stackable: item.stackable,
        }))}
        ownedCounts={ownedCounts}
        enchantiunBalance={enchantiunBalance}
        canPurchase={session?.user?.role === "ADVENTURER"}
      />

      <h2 className="text-xl font-semibold text-amber-200">Apoio Founder (opcional)</h2>
      <p className="text-amber-50/80">Apoio via PIX com confirmacao manual do admin.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {founderTiers.map((tier) => (
          <Card key={tier.id} className={`p-5 ${tier.accent}`}>
            <div className="flex items-center gap-3">
              <div className="rounded-md border border-amber-200/35 bg-black/30 p-2">
                <Image src={tier.iconPath} alt={tier.title} width={26} height={26} className="h-[26px] w-[26px] object-contain" />
              </div>
              <div>
                <h2 className="font-semibold text-amber-100">{tier.title}</h2>
                <p className="text-sm font-semibold text-cyan-200">{tier.price}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-amber-200/25 bg-black/25 p-2">
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-amber-200/85">
                <Image src={tier.badgeIconPath} alt="" aria-hidden width={16} height={16} className="h-4 w-4 object-contain" />
                {tier.badgeLabel}
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {tier.rewards.map((reward) => (
                <li key={`${tier.id}-${reward.label}`} className="flex items-center gap-2 rounded-md border border-amber-100/15 bg-black/20 p-2">
                  <Image src={reward.iconPath} alt="" aria-hidden width={20} height={20} className="h-5 w-5 object-contain" />
                  <div className="leading-tight">
                    <p className="text-sm text-amber-100">{reward.label}</p>
                    <p className={`text-xs ${reward.detailClass}`}>{reward.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <p className="text-sm text-amber-100/80">No Alpha: envie comprovante/ID para confirmacao manual.</p>
      {session?.user ? (
        <FounderPledgeForm />
      ) : (
        <p className="text-sm text-amber-100/80">
          Para apoiar e enviar comprovante, <Link href="/login" className="text-amber-300">faça login</Link>.
        </p>
      )}
    </div>
  );
}
