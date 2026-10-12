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
    async hasSubmissions(examId) {
        return (await prisma_1.prisma.submission.count({ where: { examId } })) > 0;
    }
    async update(examId, data) {
        return prisma_1.prisma.exam.update({ where: { id: examId }, data, include: { testCases: { orderBy: { orderIndex: 'asc' } } } });
    }
    async deleteIfNoSubmissions(examId) {
        if (await this.hasSubmissions(examId))
            throw new Error('Không thể xóa đề thi đã có bài nộp.');
        await prisma_1.prisma.exam.delete({ where: { id: examId } });
    }
    async updateTestCase(examId, testCaseId, data) {
        return prisma_1.prisma.testCase.update({ where: { id: testCaseId, examId }, data });
    }
    async deleteTestCase(examId, testCaseId) {
        if (await prisma_1.prisma.testCase.count({ where: { examId } }) <= 1)
            throw new Error('Đề thi phải còn ít nhất một test case.');
        return prisma_1.prisma.testCase.delete({ where: { id: testCaseId, examId } });
    }
}
exports.ExamRepository = ExamRepository;
exports.examRepository = new ExamRepository();
