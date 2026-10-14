-- AlterTable exams: add examType column
ALTER TABLE "exams" ADD COLUMN "examType" TEXT NOT NULL DEFAULT 'INDIVIDUAL';

-- AlterTable submissions: add teamId column
ALTER TABLE "submissions" ADD COLUMN "teamId" TEXT;

-- CreateTable teams
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable team_members
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "githubUsername" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable git_contributions
CREATE TABLE "git_contributions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "commitsCount" INTEGER NOT NULL DEFAULT 0,
    "locAdded" INTEGER NOT NULL DEFAULT 0,
    "locDeleted" INTEGER NOT NULL DEFAULT 0,
    "contributionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "personalScore" DOUBLE PRECISION,
    "isWarning" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "git_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_examId_name_key" ON "teams"("examId", "name");
CREATE INDEX "teams_examId_idx" ON "teams"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_studentId_key" ON "team_members"("teamId", "studentId");
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");
CREATE INDEX "team_members_studentId_idx" ON "team_members"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "git_contributions_teamId_memberId_key" ON "git_contributions"("teamId", "memberId");
CREATE INDEX "git_contributions_teamId_idx" ON "git_contributions"("teamId");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_contributions" ADD CONSTRAINT "git_contributions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "git_contributions" ADD CONSTRAINT "git_contributions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
