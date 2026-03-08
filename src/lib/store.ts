export type StoreItemType = "ARTEFATO" | "RELIQUIA";

export type StoreItem = {
  id: string;
  name: string;
  type: StoreItemType;
  rarity: "COMUM" | "RARO" | "EPICO";
  priceEnchantiun: number;
  priceBrl: string;
  effect: string;
  badge: string;
  iconPath: string;
  stackable: boolean;
};

export const storeCatalog: StoreItem[] = [
  {
    id: "pergaminho-foco",
    name: "Pergaminho de Foco",
    type: "ARTEFATO",
    rarity: "COMUM",
    priceEnchantiun: 18,
    priceBrl: "R$ 4,90",
    effect: "Consumivel cosmetico para inventario. Sem bonus competitivo.",
    badge: "CONSUMIVEL_PERGAMINHO_FOCO",
    iconPath: "/assets/icones/Misc/Scroll.png",
    stackable: true,
  },
  {
    id: "candela-vigia",
    name: "Candela de Vigia",
    type: "RELIQUIA",
    rarity: "COMUM",
    priceEnchantiun: 24,
    priceBrl: "R$ 7,90",
    effect: "Consumivel tematico para colecao. Sem vantagem de performance.",
    badge: "CONSUMIVEL_CANDELA_VIGIA",
    iconPath: "/assets/icones/Misc/Candle.png",
    stackable: true,
  },
  {
    id: "selo-local",
    name: "Selo Local",
    type: "ARTEFATO",
    rarity: "COMUM",
    priceEnchantiun: 22,
    priceBrl: "R$ 6,90",
    effect: "Consumivel de colecao para historico de entregas. Nao altera score.",
    badge: "CONSUMIVEL_SELO_LOCAL",
    iconPath: "/assets/icones/Misc/Envolop.png",
    stackable: true,
  },
  {
    id: "sigilo-escriba",
    name: "Sigilo do Escriba",
    type: "ARTEFATO",
    rarity: "RARO",
    priceEnchantiun: 60,
    priceBrl: "R$ 19,90",
    effect: "Selo visual no inventario e perfil. Sem bonus de jogo.",
    badge: "ARTEFATO_SIGILO_ESCRIBA",
    iconPath: "/assets/icones/Misc/Book.png",
    stackable: false,
  },
  {
    id: "lente-batedor",
    name: "Lente do Batedor",
    type: "ARTEFATO",
    rarity: "RARO",
    priceEnchantiun: 90,
    priceBrl: "R$ 29,90",
    effect: "Item de identidade visual no perfil. Sem ganho de pontuacao.",
    badge: "ARTEFATO_LENTE_BATEDOR",
    iconPath: "/assets/icones/Misc/Map.png",
    stackable: false,
  },
  {
    id: "reliquia-piracicaba",
    name: "Reliquia de Piracicaba",
    type: "RELIQUIA",
    rarity: "EPICO",
    priceEnchantiun: 150,
    priceBrl: "R$ 49,90",
    effect: "Reliquia de colecao com destaque visual no inventario.",
    badge: "RELIQUIA_PIRACICABA",
    iconPath: "/assets/icones/Misc/Chest.png",
    stackable: false,
  },
];

export function getStoreItemById(itemId: string) {
  return storeCatalog.find((item) => item.id === itemId) ?? null;
}

export function userOwnsStoreItem(badges: string[], item: StoreItem) {
  if (item.stackable) {
    return false;
  }
  return badges.includes(item.badge);
}
