ALTER TABLE "submissions"
ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1;

WITH numbered AS (
    SELECT "id", ROW_NUMBER() OVER (
        PARTITION BY "examId", "studentId"
        ORDER BY "submittedAt" ASC, "id" ASC
    )::INTEGER AS attempt_number
    FROM "submissions"
)
UPDATE "submissions" AS submission
SET "attemptNumber" = numbered.attempt_number
FROM numbered
WHERE submission."id" = numbered."id";

CREATE UNIQUE INDEX "submissions_examId_studentId_attemptNumber_key"
ON "submissions"("examId", "studentId", "attemptNumber");
