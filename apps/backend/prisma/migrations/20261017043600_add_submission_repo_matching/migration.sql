-- AlterTable
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "repoMatchStatus" TEXT;
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "repoMatchPercent" DOUBLE PRECISION;
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "repoMatchDetails" JSONB;
