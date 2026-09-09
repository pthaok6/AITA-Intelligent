"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionRepository = exports.SubmissionRepository = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
const enums_1 = require("../../domain/enums");
class SubmissionRepository {
    async create(data) {
        return prisma_1.prisma.submission.create({
            data: {
                ...data,
                status: enums_1.SubmissionStatus.QUEUED,
            },
        });
    }
    async findById(id) {
        return prisma_1.prisma.submission.findUnique({
            where: { id },
            include: {
                exam: { select: { id: true, title: true, allowedLanguage: true, classId: true } },
                student: { select: { id: true, fullName: true, email: true } },
                testResults: {
                    include: { testCase: { select: { id: true, orderIndex: true, scoreWeight: true, isHidden: true } } },
                    orderBy: { testCase: { orderIndex: 'asc' } },
                },
            },
        });
    }
    async findByExamId(examId) {
        return prisma_1.prisma.submission.findMany({
            where: { examId },
            include: {
                student: { select: { id: true, fullName: true, email: true } },
                _count: { select: { testResults: true } },
            },
            orderBy: { submittedAt: 'desc' },
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
