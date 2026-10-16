import { prisma } from '../../infrastructure/database/prisma';
import { HttpError } from '../../shared/http';

export interface CreateAppealInput {
  submissionId: string;
  title?: string;
  reason: string;
  expectedScore?: number;
}

export interface ResolveAppealInput {
  status: 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED';
  decisionReason?: string;
  newScore?: number;
}

export interface AppealFilters {
  status?: string;
  classId?: string;
  examId?: string;
}

export class AppealService {
  async createAppeal(userId: string, input: CreateAppealInput) {
    if (!input.submissionId) throw new HttpError(400, 'Thiếu mã bài nộp (submissionId).');
    if (!input.reason || input.reason.trim().length < 5) {
      throw new HttpError(400, 'Lý do khiếu nại phải có ít nhất 5 ký tự.');
    }

    const submission = await prisma.submission.findUnique({
      where: { id: input.submissionId },
      include: {
        exam: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!submission) throw new HttpError(404, 'Không tìm thấy bài nộp.');
    const teamMembership = submission.teamId
      ? await prisma.teamMember.findUnique({
          where: { teamId_studentId: { teamId: submission.teamId, studentId: userId } },
          select: { id: true },
        })
      : null;
    if (submission.studentId !== userId && !teamMembership) {
      throw new HttpError(403, 'Bạn chỉ có thể khiếu nại bài nộp của chính mình.');
    }

    // Check if score is released or exam has ended or submission is completed
    const scoreReleased = new Date() >= submission.exam.endTime || ['COMPLETED', 'COMPILE_ERROR'].includes(submission.status);
    if (!scoreReleased) {
      throw new HttpError(400, 'Bài thi chưa kết thúc hoặc kết quả chưa được công bố để khiếu nại.');
    }

    // Check for existing active appeal
    const existingActive = await prisma.appeal.findFirst({
      where: {
        submissionId: input.submissionId,
        studentId: userId,
        status: { in: ['SUBMITTED', 'IN_REVIEW'] },
      },
    });

    if (existingActive) {
      throw new HttpError(400, 'Bạn đã có một đơn khiếu nại đang chờ xử lý cho bài nộp này.');
    }

    const expectedScore = typeof input.expectedScore === 'number' && !isNaN(input.expectedScore)
      ? Math.max(0, Math.min(100, input.expectedScore))
      : null;

    return prisma.appeal.create({
      data: {
        submissionId: input.submissionId,
        studentId: userId,
        examId: submission.examId,
        title: input.title?.trim() || `Khiếu nại điểm - ${submission.exam.title}`,
        reason: input.reason.trim(),
        expectedScore,
        previousScore: submission.totalScore,
        status: 'SUBMITTED',
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            allowedLanguage: true,
            class: {
              select: {
                id: true,
                classCode: true,
                name: true,
              },
            },
          },
        },
        submission: {
          select: {
            id: true,
            attemptNumber: true,
            totalScore: true,
            status: true,
            submittedAt: true,
          },
        },
      },
    });
  }

  async getMyAppeals(userId: string) {
    return prisma.appeal.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            allowedLanguage: true,
            class: {
              select: {
                id: true,
                classCode: true,
                name: true,
              },
            },
          },
        },
        submission: {
          select: {
            id: true,
            attemptNumber: true,
            totalScore: true,
            status: true,
            submittedAt: true,
            originalFilename: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  async getSubmissionAppeals(submissionId: string, userId: string) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { studentId: true, teamId: true },
    });
    if (!submission) throw new HttpError(404, 'Submission not found.');
    const teamMembership = submission.teamId
      ? await prisma.teamMember.findUnique({
          where: { teamId_studentId: { teamId: submission.teamId, studentId: userId } },
          select: { id: true },
        })
      : null;
    if (submission.studentId !== userId && !teamMembership) {
      throw new HttpError(403, 'You are not a member of this submission team.');
    }
    return prisma.appeal.findMany({
      where: {
        submissionId,
        studentId: userId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLecturerAppeals(lecturerId: string, role: string, filters: AppealFilters = {}) {
    let classIds: string[] = [];

    if (role !== 'ADMIN') {
      const classes = await prisma.class.findMany({
        where: { lecturerId },
        select: { id: true },
      });
      classIds = classes.map(c => c.id);
      if (classIds.length === 0) return [];
    }

    const where: any = {};

    if (role !== 'ADMIN') {
      where.exam = {
        classId: filters.classId && classIds.includes(filters.classId)
          ? filters.classId
          : { in: classIds },
      };
    } else if (filters.classId) {
      where.exam = { classId: filters.classId };
    }

    if (filters.examId) {
      where.examId = filters.examId;
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    return prisma.appeal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        exam: {
          select: {
            id: true,
            title: true,
            allowedLanguage: true,
            class: {
              select: {
                id: true,
                classCode: true,
                name: true,
              },
            },
          },
        },
        submission: {
          select: {
            id: true,
            attemptNumber: true,
            totalScore: true,
            status: true,
            submittedAt: true,
            fileHashSha256: true,
            originalFilename: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  async getAppealById(appealId: string, userId: string, role: string) {
    const appeal = await prisma.appeal.findUnique({
      where: { id: appealId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        exam: {
          select: {
            id: true,
            title: true,
            allowedLanguage: true,
            class: {
              select: {
                id: true,
                classCode: true,
                name: true,
                lecturerId: true,
              },
            },
          },
        },
        submission: {
          select: {
            id: true,
            attemptNumber: true,
            totalScore: true,
            status: true,
            submittedAt: true,
            fileHashSha256: true,
            originalFilename: true,
            compileMessage: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!appeal) throw new HttpError(404, 'Không tìm thấy khiếu nại.');

    if (role === 'STUDENT' && appeal.studentId !== userId) {
      throw new HttpError(403, 'Bạn không có quyền xem đơn khiếu nại này.');
    }

    if (role === 'LECTURER' && appeal.exam.class.lecturerId !== userId) {
      throw new HttpError(403, 'Khiếu nại không thuộc lớp do bạn phụ trách.');
    }

    return appeal;
  }

  async resolveAppeal(appealId: string, lecturerId: string, role: string, input: ResolveAppealInput) {
    if (!['IN_REVIEW', 'ACCEPTED', 'REJECTED'].includes(input.status)) {
      throw new HttpError(400, 'Trạng thái xử lý không hợp lệ.');
    }

    const appeal = await prisma.appeal.findUnique({
      where: { id: appealId },
      include: {
        exam: {
          include: {
            class: true,
          },
        },
        submission: true,
      },
    });

    if (!appeal) throw new HttpError(404, 'Không tìm thấy khiếu nại.');

    if (role !== 'ADMIN' && appeal.exam.class.lecturerId !== lecturerId) {
      throw new HttpError(403, 'Bạn không có quyền xử lý khiếu nại của lớp này.');
    }

    if (input.status === 'IN_REVIEW') {
      return prisma.appeal.update({
        where: { id: appealId },
        data: {
          status: 'IN_REVIEW',
          decisionReason: input.decisionReason?.trim() || appeal.decisionReason,
          resolvedById: lecturerId,
        },
      });
    }

    if (input.status === 'ACCEPTED') {
      if (typeof input.newScore !== 'number' || isNaN(input.newScore) || input.newScore < 0) {
        throw new HttpError(400, 'Vui lòng nhập điểm mới hợp lệ (số không âm).');
      }
      if (!input.decisionReason || input.decisionReason.trim().length === 0) {
        throw new HttpError(400, 'Vui lòng cung cấp lý do chấp thuận hoặc nhận xét cho sinh viên.');
      }

      const newScore = Number(input.newScore.toFixed(2));

      return prisma.$transaction(async (tx) => {
        const updatedAppeal = await tx.appeal.update({
          where: { id: appealId },
          data: {
            status: 'ACCEPTED',
            newScore,
            decisionReason: input.decisionReason?.trim(),
            resolvedById: lecturerId,
            resolvedAt: new Date(),
          },
        });

        // Automatically update submission's totalScore
        await tx.submission.update({
          where: { id: appeal.submissionId },
          data: {
            totalScore: newScore,
          },
        });

        return updatedAppeal;
      });
    }

    if (input.status === 'REJECTED') {
      if (!input.decisionReason || input.decisionReason.trim().length === 0) {
        throw new HttpError(400, 'Vui lòng cung cấp lý do từ chối khiếu nại.');
      }

      return prisma.appeal.update({
        where: { id: appealId },
        data: {
          status: 'REJECTED',
          decisionReason: input.decisionReason.trim(),
          resolvedById: lecturerId,
          resolvedAt: new Date(),
        },
      });
    }

    throw new HttpError(400, 'Hành động không hợp lệ.');
  }
}

export const appealService = new AppealService();
