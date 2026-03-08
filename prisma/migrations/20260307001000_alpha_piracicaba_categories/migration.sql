-- Refactor categories for Alpha and add local/RPG mission fields.
ALTER TYPE "MissionCategory" RENAME TO "MissionCategory_old";

CREATE TYPE "MissionCategory" AS ENUM (
  'ATENDIMENTO_SUPORTE',
  'VENDAS_PROSPECCAO',
  'OPERACOES_PLANILHAS',
  'DESIGN_RAPIDO',
  'CONTEUDO_COPY',
  'SOCIAL_MEDIA_LOCAL',
  'AUTOMACAO_NO_CODE'
);

ALTER TABLE "Mission"
ALTER COLUMN "category" TYPE "MissionCategory"
USING (
  CASE "category"::text
    WHEN 'ATENDIMENTO' THEN 'ATENDIMENTO_SUPORTE'::"MissionCategory"
    WHEN 'PROSPECCAO' THEN 'VENDAS_PROSPECCAO'::"MissionCategory"
    WHEN 'OPERACOES' THEN 'OPERACOES_PLANILHAS'::"MissionCategory"
    WHEN 'DESIGN' THEN 'DESIGN_RAPIDO'::"MissionCategory"
    WHEN 'AUTOMACAO' THEN 'AUTOMACAO_NO_CODE'::"MissionCategory"
    WHEN 'TEXTO' THEN 'CONTEUDO_COPY'::"MissionCategory"
    ELSE 'SOCIAL_MEDIA_LOCAL'::"MissionCategory"
  END
);

ALTER TABLE "MissionTemplate"
ALTER COLUMN "category" TYPE "MissionCategory"
USING (
  CASE "category"::text
    WHEN 'ATENDIMENTO' THEN 'ATENDIMENTO_SUPORTE'::"MissionCategory"
    WHEN 'PROSPECCAO' THEN 'VENDAS_PROSPECCAO'::"MissionCategory"
    WHEN 'OPERACOES' THEN 'OPERACOES_PLANILHAS'::"MissionCategory"
    WHEN 'DESIGN' THEN 'DESIGN_RAPIDO'::"MissionCategory"
    WHEN 'AUTOMACAO' THEN 'AUTOMACAO_NO_CODE'::"MissionCategory"
    WHEN 'TEXTO' THEN 'CONTEUDO_COPY'::"MissionCategory"
    ELSE 'SOCIAL_MEDIA_LOCAL'::"MissionCategory"
  END
);

ALTER TABLE "Mission"
ADD COLUMN "city" TEXT NOT NULL DEFAULT 'Piracicaba',
ADD COLUMN "state" TEXT NOT NULL DEFAULT 'SP',
ADD COLUMN "neighborhood" TEXT NOT NULL DEFAULT 'Centro',
ADD COLUMN "missionType" TEXT NOT NULL DEFAULT 'Operacao Digital',
ADD COLUMN "desiredFormat" TEXT,
ADD COLUMN "maxRevisions" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "rpgTitle" TEXT,
ADD COLUMN "rpgNarrative" TEXT,
ADD COLUMN "rpgRewardFlavor" TEXT;

UPDATE "Mission"
SET
  "rpgTitle" = COALESCE("rpgTitle", 'Missao da Guilda: ' || "title"),
  "rpgNarrative" = COALESCE("rpgNarrative", "narrative");

CREATE INDEX "Mission_city_state_neighborhood_idx" ON "Mission"("city", "state", "neighborhood");

DROP TYPE "MissionCategory_old";
