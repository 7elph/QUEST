-- CreateEnum
CREATE TYPE "ErrorSource" AS ENUM ('SERVER', 'CLIENT', 'EDGE');

-- CreateTable
CREATE TABLE "ErrorEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "route" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "source" "ErrorSource" NOT NULL DEFAULT 'SERVER',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorEvent_createdAt_source_idx" ON "ErrorEvent"("createdAt", "source");

-- CreateIndex
CREATE INDEX "ErrorEvent_requestId_createdAt_idx" ON "ErrorEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorEvent_route_createdAt_idx" ON "ErrorEvent"("route", "createdAt");

-- AddForeignKey
ALTER TABLE "ErrorEvent" ADD CONSTRAINT "ErrorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

