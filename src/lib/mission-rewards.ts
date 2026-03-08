import { RankName } from "@prisma/client";
import { storeCatalog } from "./store";

type RankDropConfig = {
  chancePct: number;
  allowedItemIds: string[];
};

const enchantiunByRank: Record<RankName, number> = {
  E: 40,
  D: 50,
  C: 65,
  B: 80,
  A: 100,
  S: 130,
};

const dropConfigByRank: Partial<Record<RankName, RankDropConfig>> = {
  C: {
    chancePct: 28,
    allowedItemIds: ["pergaminho-foco", "candela-vigia", "selo-local"],
  },
  B: {
    chancePct: 35,
    allowedItemIds: ["pergaminho-foco", "candela-vigia", "selo-local"],
  },
  A: {
    chancePct: 42,
    allowedItemIds: ["pergaminho-foco", "candela-vigia", "selo-local"],
  },
  S: {
    chancePct: 50,
    allowedItemIds: ["pergaminho-foco", "candela-vigia", "selo-local"],
  },
};

function hashToPositiveInt(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getMissionEnchantiunReward(minRank: RankName) {
  return enchantiunByRank[minRank];
}

export function getMissionRewardPreview(missionId: string, minRank: RankName) {
  const enchantiun = getMissionEnchantiunReward(minRank);
  const dropConfig = dropConfigByRank[minRank];

  if (!dropConfig) {
    return { enchantiun, drop: null };
  }

  const seed = hashToPositiveInt(`${missionId}:${minRank}:drop`);
  const roll = seed % 100;
  if (roll >= dropConfig.chancePct) {
    return { enchantiun, drop: null };
  }

  const pool = storeCatalog.filter(
    (item) => item.stackable && dropConfig.allowedItemIds.includes(item.id),
  );

  if (pool.length === 0) {
    return { enchantiun, drop: null };
  }

  const item = pool[seed % pool.length];
  return { enchantiun, drop: item };
}
