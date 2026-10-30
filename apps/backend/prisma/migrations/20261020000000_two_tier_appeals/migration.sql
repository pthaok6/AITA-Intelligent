-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "originalScore" DOUBLE PRECISION,
ADD COLUMN     "parentAppealId" TEXT,
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "targetRole" TEXT NOT NULL DEFAULT 'LECTURER';

-- CreateIndex
CREATE INDEX "appeals_round_idx" ON "appeals"("round");

-- CreateIndex
CREATE INDEX "appeals_targetRole_idx" ON "appeals"("targetRole");

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_parentAppealId_fkey" FOREIGN KEY ("parentAppealId") REFERENCES "appeals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
