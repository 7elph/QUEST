-- CreateEnum
CREATE TYPE "AdminScope" AS ENUM ('SUPER_ADMIN', 'MODERATOR', 'FINANCE', 'OPS');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'MISSION', 'REVIEW', 'DISPUTE', 'ESCROW', 'FOUNDER');

-- CreateEnum
CREATE TYPE "DigestType" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "MissionTemplateVisibility" AS ENUM ('SYSTEM', 'PATRON');

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "minRank" "RankName" NOT NULL DEFAULT 'E',
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminScope" "AdminScope";

-- CreateTable
CREATE TABLE "MissionTemplate" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "visibility" "MissionTemplateVisibility" NOT NULL DEFAULT 'PATRON',
    "name" TEXT NOT NULL,
    "category" "MissionCategory" NOT NULL,
    "scopeTemplate" TEXT NOT NULL,
    "victoryConditionsTemplate" TEXT[],
    "deliverableFormat" "DeliverableFormat" NOT NULL,
    "budgetRange" "BudgetRange" NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "sponsoredDefault" BOOLEAN NOT NULL DEFAULT false,
    "narrativeTemplate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionDraft" (
    "id" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "payload" JSONB,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionRevision" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "proofLinks" TEXT[],
    "proofFiles" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDigest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DigestType" NOT NULL,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionDraft_patronId_key" ON "MissionDraft"("patronId");

-- CreateIndex
CREATE INDEX "SubmissionRevision_submissionId_createdAt_idx" ON "SubmissionRevision"("submissionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionRevision_submissionId_version_key" ON "SubmissionRevision"("submissionId", "version");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDigest_userId_sentAt_idx" ON "NotificationDigest"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "Mission_status_minRank_idx" ON "Mission"("status", "minRank");

-- CreateIndex
CREATE INDEX "Mission_deadlineAt_idx" ON "Mission"("deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_missionId_adventurerId_key" ON "Submission"("missionId", "adventurerId");

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MissionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionTemplate" ADD CONSTRAINT "MissionTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionDraft" ADD CONSTRAINT "MissionDraft_patronId_fkey" FOREIGN KEY ("patronId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionRevision" ADD CONSTRAINT "SubmissionRevision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDigest" ADD CONSTRAINT "NotificationDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

