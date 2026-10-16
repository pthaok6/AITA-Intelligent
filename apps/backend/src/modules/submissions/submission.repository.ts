import { prisma } from '../../infrastructure/database/prisma';
import { SubmissionStatus } from '../../domain/enums';
import { Prisma } from '@prisma/client';

export class SubmissionRepository {
  async create(data: {
    examId: string;
    studentId: string;
    teamId?: string;
    sourceCodeUrl: string;
    fileHashSha256: string;
    artifactType?: string;
    astStatus?: string;
    originalFilename?: string;
    entrypoint?: string;
    sourceFiles?: Array<{ path: string; size: number }>;
    teamRepoUrl?: string;
    status?: string;
    isLate?: boolean;
  }) {
    const { sourceFiles, teamRepoUrl, ...submissionData } = data;
    for (let retry = 0; ; retry++) {
      try {
        return await prisma.$transaction(async tx => {
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

          return tx.submission.create({
            data: {
              ...submissionData,
              attemptNumber: (latest?.attemptNumber ?? 0) + 1,
              status: (submissionData as any).status || SubmissionStatus.QUEUED,
              isLate: (submissionData as any).isLate || false,
              ...(sourceFiles ? { sourceFiles: { create: sourceFiles } } : {}),
            },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error: any) {
        if (retry >= 2 || !['P2002', 'P2034'].includes(error?.code)) throw error;
      }
    }
  }

  async findByFileHash(examId: string, fileHashSha256: string, teamId?: string, studentId?: string) {
    const whereClause: any = { examId, fileHashSha256 };
    if (teamId) {
      whereClause.teamId = teamId;
    } else if (studentId) {
      whereClause.studentId = studentId;
    }
    return prisma.submission.findFirst({
      where: whereClause,
      select: { id: true, attemptNumber: true, status: true, submittedAt: true },
    });
  }

  async findLatestForTeam(examId: string, teamId: string) {
    return prisma.submission.findFirst({
      where: { examId, teamId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.submission.findUnique({
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
  }

  async findByExamId(examId: string, studentId?: string) {
    const attempts = await prisma.submission.findMany({
      where: { examId, ...(studentId ? { studentId } : {}) },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        aiReviews: { orderBy: { reviewRound: 'desc' }, take: 1 },
        _count: { select: { testResults: true } },
      },
      orderBy: { attemptNumber: 'desc' },
    });
    const latestByStudent = new Map<string, typeof attempts[number]>();
    for (const attempt of attempts) {
      if (!latestByStudent.has(attempt.studentId)) latestByStudent.set(attempt.studentId, attempt);
    }
    return [...latestByStudent.values()];
  }

  async findLatestForStudent(examId: string, studentId: string) {
    return prisma.submission.findFirst({
      where: { examId, studentId },
      select: { id: true },
      orderBy: { attemptNumber: 'desc' },
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
      stderr?: string;
      exitCode?: number;
      outputTruncated?: boolean;
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
