export type AvatarAction = "idle" | "walk" | "attack" | "hurt";

export type AvatarSheet = {
  src: string;
  frames: number;
  fps: number;
};

export type ProfileAvatarOption = {
  id: string;
  label: string;
  previewSrc: string;
  sheets: Record<AvatarAction, AvatarSheet>;
};

const soldierWithShadowsRoot =
  "/assets/personagens/SpriteSheets(96x96)/Human_Soldier_Sword_Shield/With_Shadows/Human_Soldier_Sword_Shield";
const soldierNoShadowsRoot =
  "/assets/personagens/SpriteSheets(96x96)/Human_Soldier_Sword_Shield/No_Shadows/Human_Soldier_Sword_Shield";
const slimeWithShadowsRoot =
  "/assets/personagens/SpriteSheets(96x96)/Monster_Slime/With_Shadows/Monster_Slime";
const slimeNoShadowsRoot =
  "/assets/personagens/SpriteSheets(96x96)/Monster_Slime/No_Shadows/Monster_Slime";

function buildSheets(root: string): Record<AvatarAction, AvatarSheet> {
  return {
    idle: { src: `${root}_Idle-Sheet.png`, frames: 6, fps: 6 },
    walk: { src: `${root}_Walk-Sheet.png`, frames: 8, fps: 10 },
    attack: { src: `${root}_Attack1-Sheet.png`, frames: 8, fps: 12 },
    hurt: { src: `${root}_Hurt-Sheet.png`, frames: 4, fps: 8 },
  };
}

export const profileAvatarOptions: ProfileAvatarOption[] = [
  {
    id: "soldier",
    label: "Soldado (sombra)",
    previewSrc: "/assets/personagens/portraits/soldier.png",
    sheets: buildSheets(soldierWithShadowsRoot),
  },
  {
    id: "soldier_clean",
    label: "Soldado (limpo)",
    previewSrc: "/assets/personagens/portraits/soldier_clean.png",
    sheets: buildSheets(soldierNoShadowsRoot),
  },
  {
    id: "slime",
    label: "Slime (sombra)",
    previewSrc: "/assets/personagens/portraits/slime.png",
    sheets: buildSheets(slimeWithShadowsRoot),
  },
  {
    id: "slime_clean",
    label: "Slime (limpo)",
    previewSrc: "/assets/personagens/portraits/slime_clean.png",
    sheets: buildSheets(slimeNoShadowsRoot),
  },
];

const avatarById = new Map(profileAvatarOptions.map((item) => [item.id, item] as const));
const avatarByPreviewSrc = new Map(profileAvatarOptions.map((item) => [item.previewSrc, item] as const));

export const defaultProfileAvatarId = "soldier";

export function getProfileAvatarById(id: string) {
  return avatarById.get(id) ?? null;
}

export function getProfileAvatarBySrc(src: string | null | undefined) {
  if (!src) return null;
  return avatarByPreviewSrc.get(src) ?? null;
}

