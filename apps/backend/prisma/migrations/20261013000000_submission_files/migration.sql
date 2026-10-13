CREATE TABLE "submission_files" (
    "submissionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("submissionId", "path"),
    CONSTRAINT "submission_files_path_nonempty" CHECK (length("path") > 0),
    CONSTRAINT "submission_files_size_nonnegative" CHECK ("size" >= 0),
    CONSTRAINT "submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "submission_files" ("submissionId", "path", "size")
SELECT s."id", file->>'path', (file->>'size')::INTEGER
FROM "submissions" AS s
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(s."sourceFiles") = 'array' THEN s."sourceFiles"
        ELSE '[]'::jsonb
    END
) AS manifest(file)
WHERE jsonb_typeof(file) = 'object'
  AND jsonb_typeof(file->'path') = 'string'
  AND length(file->>'path') > 0
  AND (file->>'size') ~ '^[0-9]+$'
  AND CASE
        WHEN (file->>'size') ~ '^[0-9]+$' THEN (file->>'size')::NUMERIC <= 2147483647
        ELSE FALSE
      END;

ALTER TABLE "submissions" DROP COLUMN "sourceFiles";
