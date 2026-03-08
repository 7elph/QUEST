import { MissionCategory } from "@prisma/client";

export const navLinkIcons: Record<string, string> = {
  "/home": "/assets/icones/Misc/Map.png",
  "/my-missions": "/assets/icones/Misc/Scroll.png",
  "/profile": "/assets/icones/Equipment/Bag.png",
  "/ranking": "/assets/icones/Misc/Heart.png",
  "/founders": "/assets/icones/Misc/Chest.png",
  "/enterprise": "/assets/icones/Misc/Book.png",
  "/create-mission": "/assets/icones/Material/Paper.png",
  "/admin": "/assets/icones/Misc/Gear.png",
};

export const missionCategoryIcons: Record<MissionCategory, string> = {
  ATENDIMENTO_SUPORTE: "/assets/icones/Misc/Envolop.png",
  VENDAS_PROSPECCAO: "/assets/icones/Misc/Map.png",
  OPERACOES_PLANILHAS: "/assets/icones/Misc/Gear.png",
  DESIGN_RAPIDO: "/assets/icones/Material/Fabric.png",
  CONTEUDO_COPY: "/assets/icones/Misc/Scroll.png",
  SOCIAL_MEDIA_LOCAL: "/assets/icones/Misc/Lantern.png",
  AUTOMACAO_NO_CODE: "/assets/icones/Material/String.png",
};

export const missionMetaIcons = {
  status: "/assets/icones/Misc/Heart.png",
  location: "/assets/icones/Misc/Map.png",
  patron: "/assets/icones/Equipment/Bag.png",
  deadline: "/assets/icones/Misc/Candle.png",
};

export const storeTypeIcons: Record<"ARTEFATO" | "RELIQUIA", string> = {
  ARTEFATO: "/assets/icones/Misc/Scroll.png",
  RELIQUIA: "/assets/icones/Misc/Chest.png",
};
