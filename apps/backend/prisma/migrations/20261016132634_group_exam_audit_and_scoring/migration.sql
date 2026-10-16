-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "lowerBound" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "upperBound" DOUBLE PRECISION NOT NULL DEFAULT 1.2;

-- AlterTable
ALTER TABLE "git_contributions" ADD COLUMN     "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'SUCCESS';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "isLate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
