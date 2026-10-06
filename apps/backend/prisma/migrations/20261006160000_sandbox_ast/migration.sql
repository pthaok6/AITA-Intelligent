ALTER TABLE "submissions"
ADD COLUMN "artifactType" TEXT NOT NULL DEFAULT 'LEGACY_TEXT',
ADD COLUMN "originalFilename" TEXT,
ADD COLUMN "entrypoint" TEXT,
ADD COLUMN "sourceFiles" JSONB,
ADD COLUMN "astStatus" TEXT NOT NULL DEFAULT 'SKIPPED',
ADD COLUMN "astMessage" TEXT,
ADD COLUMN "astCompletedAt" TIMESTAMP(3),
ADD COLUMN "astVersion" TEXT,
ADD COLUMN "astK" INTEGER,
ADD COLUMN "astW" INTEGER;
ALTER TABLE "submissions" ALTER COLUMN "artifactType" SET DEFAULT 'ZIP';
ALTER TABLE "submissions" ALTER COLUMN "astStatus" SET DEFAULT 'PENDING';
ALTER TABLE "submission_test_results" ADD COLUMN "stderr" TEXT, ADD COLUMN "exitCode" INTEGER, ADD COLUMN "outputTruncated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ast_fingerprints" ADD COLUMN "sourcePath" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "ast_fingerprints_submissionId_sourcePath_tokenStart_key" ON "ast_fingerprints"("submissionId", "sourcePath", "tokenStart");
ALTER TABLE "plagiarism_reports" DROP CONSTRAINT "plagiarism_reports_submissionAId_fkey", DROP CONSTRAINT "plagiarism_reports_submissionBId_fkey";
ALTER TABLE "plagiarism_reports" ADD CONSTRAINT "plagiarism_reports_submissionAId_examId_fkey" FOREIGN KEY ("submissionAId", "examId") REFERENCES "submissions"("id", "examId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plagiarism_reports" ADD CONSTRAINT "plagiarism_reports_submissionBId_examId_fkey" FOREIGN KEY ("submissionBId", "examId") REFERENCES "submissions"("id", "examId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plagiarism_reports" ADD CONSTRAINT "plagiarism_reports_score_range" CHECK ("similarityScore" >= 0 AND "similarityScore" <= 100);
