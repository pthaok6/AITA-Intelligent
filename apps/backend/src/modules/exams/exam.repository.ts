import { prisma } from '../../infrastructure/database/prisma';

export class ExamRepository {
  async create(data: {
    classId: string;
    title: string;
    descriptionMd: string;
    allowedLanguage: string;
    timeLimitMs?: number;
    memoryLimitMb?: number;
    startTime: Date;
    endTime: Date;
    testCases?: Array<{ inputData: string; expectedOutput: string; isHidden?: boolean; scoreWeight?: number; orderIndex: number }>;
  }) {
    const { testCases, ...examData } = data;
    return prisma.exam.create({
      data: {
        ...examData,
        testCases: testCases ? { create: testCases } : undefined,
      },
      include: { testCases: true },
    });
  }

  async findById(id: string, includeHiddenTestCases: boolean = false) {
    return prisma.exam.findUnique({
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

  async findByClassId(classId: string) {
    return prisma.exam.findMany({
      where: { classId },
      include: { _count: { select: { submissions: true, testCases: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addTestCase(examId: string, data: { inputData: string; expectedOutput: string; isHidden?: boolean; scoreWeight?: number; orderIndex: number }) {
    return prisma.testCase.create({
      data: { ...data, examId },
    });
  }

  async hasSubmissions(examId: string) {
    return (await prisma.submission.count({ where: { examId } })) > 0;
  }

  async update(examId: string, data: { title: string; descriptionMd: string; allowedLanguage: string; timeLimitMs: number; memoryLimitMb: number; startTime: Date; endTime: Date }) {
    return prisma.exam.update({ where: { id: examId }, data, include: { testCases: { orderBy: { orderIndex: 'asc' } } } });
  }

  async deleteIfNoSubmissions(examId: string) {
    if (await this.hasSubmissions(examId)) throw new Error('Không thể xóa đề thi đã có bài nộp.');
    await prisma.exam.delete({ where: { id: examId } });
  }

  async updateTestCase(examId: string, testCaseId: string, data: { inputData: string; expectedOutput: string; isHidden: boolean; scoreWeight: number; orderIndex: number }) {
    return prisma.testCase.update({ where: { id: testCaseId, examId }, data });
  }

  async deleteTestCase(examId: string, testCaseId: string) {
    if (await prisma.testCase.count({ where: { examId } }) <= 1) throw new Error('Đề thi phải còn ít nhất một test case.');
    return prisma.testCase.delete({ where: { id: testCaseId, examId } });
  }
}

export const examRepository = new ExamRepository();
