import { prisma } from '../../infrastructure/database/prisma';
import { SubmissionStatus } from '../../domain/enums';

export class SubmissionRepository {
  async create(data: {
    examId: string;
    studentId: string;
    sourceCodeUrl: string;
    fileHashSha256: string;
  }) {
    return prisma.submission.create({
      data: {
        ...data,
        status: SubmissionStatus.QUEUED,
      },
    });
  }

  async findById(id: string) {
    return prisma.submission.findUnique({
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

  async findByExamId(examId: string) {
    return prisma.submission.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        _count: { select: { testResults: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: string,
    options?: {
      startedAt?: Date;
      completedAt?: Date;
      totalScore?: number;
      compileMessage?: string;
    }
  ) {
    return prisma.submission.update({
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

  async saveTestResults(
    results: Array<{
      submissionId: string;
      testCaseId: string;
      status: string;
      actualOutput?: string;
      executionTimeMs: number;
      memoryUsedKb: number;
      scoreEarned: number;
    }>
  ) {
    const createdResults = [];
    for (const res of results) {
      const r = await prisma.submissionTestResult.upsert({
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

export const submissionRepository = new SubmissionRepository();
