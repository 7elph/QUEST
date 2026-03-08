-- CreateEnum
CREATE TYPE "ScreeningDecision" AS ENUM ('PASS', 'REVIEW', 'BLOCK', 'ERROR');

-- CreateTable
CREATE TABLE "MissionProgress" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "adventurerId" TEXT NOT NULL,
    "checklistState" BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[],
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdventurerAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resultProfile" TEXT NOT NULL,
    "dominantSkills" TEXT[],
    "skillScores" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdventurerAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionScreening" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "decision" "ScreeningDecision" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "flags" TEXT[],
    "raw" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionScreening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionProgress_missionId_adventurerId_key" ON "MissionProgress"("missionId", "adventurerId");

-- CreateIndex
CREATE INDEX "MissionProgress_missionId_updatedAt_idx" ON "MissionProgress"("missionId", "updatedAt");

-- CreateIndex
CREATE INDEX "MissionProgress_adventurerId_updatedAt_idx" ON "MissionProgress"("adventurerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdventurerAssessment_userId_key" ON "AdventurerAssessment"("userId");

-- CreateIndex
CREATE INDEX "AdventurerAssessment_completedAt_idx" ON "AdventurerAssessment"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MissionScreening_missionId_key" ON "MissionScreening"("missionId");

-- CreateIndex
CREATE INDEX "MissionScreening_decision_createdAt_idx" ON "MissionScreening"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "MissionScreening_reviewedBy_reviewedAt_idx" ON "MissionScreening"("reviewedBy", "reviewedAt");

-- AddForeignKey
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_adventurerId_fkey" FOREIGN KEY ("adventurerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventurerAssessment" ADD CONSTRAINT "AdventurerAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionScreening" ADD CONSTRAINT "MissionScreening_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionScreening" ADD CONSTRAINT "MissionScreening_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

