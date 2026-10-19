"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionRepository = exports.SubmissionRepository = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
const enums_1 = require("../../domain/enums");
const client_1 = require("@prisma/client");
class SubmissionRepository {
    async create(data) {
        const { sourceFiles, teamRepoUrl, repoMatchStatus, repoMatchPercent, repoMatchDetails, ...submissionData } = data;
        for (let retry = 0;; retry++) {
            try {
                return await prisma_1.prisma.$transaction(async (tx) => {
                    const latest = data.teamId
                        ? await tx.submission.findFirst({
                            where: { examId: data.examId, teamId: data.teamId },
                            orderBy: { attemptNumber: 'desc' },
                            select: { attemptNumber: true },
                        })
                        : await tx.submission.findFirst({
                            where: { examId: data.examId, studentId: data.studentId },
                            orderBy: { attemptNumber: 'desc' },
                            select: { attemptNumber: true },
                        });
                    const created = await tx.submission.create({
                        data: {
                            ...submissionData,
                            attemptNumber: (latest?.attemptNumber ?? 0) + 1,
                            status: submissionData.status || enums_1.SubmissionStatus.QUEUED,
                            isLate: submissionData.isLate || false,
                            ...(sourceFiles ? { sourceFiles: { create: sourceFiles } } : {}),
                        },
                    });
                    if (repoMatchStatus || repoMatchPercent !== undefined) {
                        await tx.$executeRawUnsafe('UPDATE "submissions" SET "repoMatchStatus" = $1, "repoMatchPercent" = $2, "repoMatchDetails" = $3::jsonb WHERE id = $4', repoMatchStatus || null, repoMatchPercent ?? null, repoMatchDetails ? JSON.stringify(repoMatchDetails) : null, created.id);
                    }
                    return {
                        ...created,
                        repoMatchStatus,
                        repoMatchPercent,
                        repoMatchDetails,
                    };
                }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
            }
            catch (error) {
                if (retry >= 2 || !['P2002', 'P2034'].includes(error?.code))
                    throw error;
            }
        }
    }
    async findLatestForTeam(examId, teamId) {
        return prisma_1.prisma.submission.findFirst({
            where: { examId, teamId },
            orderBy: { submittedAt: 'desc' },
        });
    }
    async findById(id) {
        const sub = await prisma_1.prisma.submission.findUnique({
            where: { id },
            include: {
                _count: { select: { fingerprints: true } },
                exam: { select: { id: true, title: true, allowedLanguage: true, classId: true, endTime: true, examType: true, descriptionMd: true } },
                student: { select: { id: true, fullName: true, email: true } },
                team: { select: { id: true, name: true, repoUrl: true } },
                sourceFiles: { select: { path: true, size: true }, orderBy: { path: 'asc' } },
                aiReviews: { orderBy: { reviewRound: 'desc' } },
                testResults: {
                    include: { testCase: { select: { id: true, orderIndex: true, scoreWeight: true, isHidden: true } } },
                    orderBy: { testCase: { orderIndex: 'asc' } },
                },
            },
        });
        if (!sub)
            return null;
        try {
            const rawMatches = await prisma_1.prisma.$queryRawUnsafe('SELECT "repoMatchStatus", "repoMatchPercent", "repoMatchDetails" FROM "submissions" WHERE id = $1', id);
            const extra = rawMatches?.[0] || {};
            return {
                ...sub,
                repoMatchStatus: extra.repoMatchStatus,
                repoMatchPercent: extra.repoMatchPercent,
                repoMatchDetails: extra.repoMatchDetails,
            };
        }
        catch {
            return sub;
        }
    }
    async findByExamId(examId, studentId) {
        const attempts = await prisma_1.prisma.submission.findMany({
            where: { examId, ...(studentId ? { studentId } : {}) },
            include: {
                student: { select: { id: true, fullName: true, email: true } },
                aiReviews: { orderBy: { reviewRound: 'desc' }, take: 1 },
                _count: { select: { testResults: true } },
            },
            orderBy: { attemptNumber: 'desc' },
        });
        const latestByStudent = new Map();
        for (const attempt of attempts) {
            if (!latestByStudent.has(attempt.studentId))
                latestByStudent.set(attempt.studentId, attempt);
        }
        return [...latestByStudent.values()];
    }
    async findLatestForStudent(examId, studentId) {
        return prisma_1.prisma.submission.findFirst({
            where: { examId, studentId },
            select: { id: true },
            orderBy: { attemptNumber: 'desc' },
        });
    }
    async updateStatus(id, status, options) {
        return prisma_1.prisma.submission.update({
            where: { id },
            data: {
                status,
                startedAt: options?.startedAt,
                completedAt: options?.completedAt,
                totalScore: options?.totalScore,
                compileMessage: options?.compileMessage,
            },
        });
    }
    async saveTestResults(results) {
        const createdResults = [];
        for (const res of results) {
            const r = await prisma_1.prisma.submissionTestResult.upsert({
                where: {
                    submissionId_testCaseId: {
                        submissionId: res.submissionId,
                        testCaseId: res.testCaseId,
                    },
                },
                create: res,
                update: res,
            });
            createdResults.push(r);
        }
        return createdResults;
    }
}
exports.SubmissionRepository = SubmissionRepository;
exports.submissionRepository = new SubmissionRepository();
