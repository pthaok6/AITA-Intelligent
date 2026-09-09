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
}

export const examRepository = new ExamRepository();
