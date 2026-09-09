"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.examRepository = exports.ExamRepository = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
class ExamRepository {
    async create(data) {
        const { testCases, ...examData } = data;
        return prisma_1.prisma.exam.create({
            data: {
                ...examData,
                testCases: testCases ? { create: testCases } : undefined,
            },
            include: { testCases: true },
        });
    }
    async findById(id, includeHiddenTestCases = false) {
        return prisma_1.prisma.exam.findUnique({
            where: { id },
            include: {
                class: { select: { id: true, name: true, classCode: true, lecturerId: true } },
                testCases: {
                    where: includeHiddenTestCases ? undefined : { isHidden: false },
                    orderBy: { orderIndex: 'asc' },
                },
            },
        });
    }
    async findByClassId(classId) {
        return prisma_1.prisma.exam.findMany({
            where: { classId },
            include: { _count: { select: { submissions: true, testCases: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async addTestCase(examId, data) {
        return prisma_1.prisma.testCase.create({
            data: { ...data, examId },
        });
    }
}
exports.ExamRepository = ExamRepository;
exports.examRepository = new ExamRepository();
