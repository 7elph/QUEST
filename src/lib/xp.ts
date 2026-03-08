import { RankName } from "@prisma/client";

export function getRankByXP(xp: number): RankName {
  if (xp >= 2000) return RankName.S;
  if (xp >= 1300) return RankName.A;
  if (xp >= 700) return RankName.B;
  if (xp >= 300) return RankName.C;
  if (xp >= 100) return RankName.D;
  return RankName.E;
}
