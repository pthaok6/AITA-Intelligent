import crypto from 'crypto';
import { submissionRepository, SubmissionRepository } from './submission.repository';
import { examRepository, ExamRepository } from '../exams/exam.repository';
import { defaultJobQueue } from '../../infrastructure/queue/bullmq-job-queue';
import { prisma } from '../../infrastructure/database/prisma';
import { HttpError } from '../../shared/http';
import { IJobQueue } from '../../infrastructure/queue/job-queue.interface';

export class SubmissionService {
  constructor(
    private submissionRepo: SubmissionRepository = submissionRepository,
    private examRepo: ExamRepository = examRepository,
    private queue: IJobQueue = defaultJobQueue
  ) {}

  async submitCode(examId: string, studentId: string, sourceCode: string) {
    const exam = await this.examRepo.findById(examId);
    if (!exam) {
      throw new Error('Không tìm thấy bài thi');
    }
    const enrollment = await prisma.classEnrollment.findUnique({ where: { classId_studentId: { classId: exam.classId, studentId } } });
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!enrollment || enrollment.status !== 'ACTIVE' || student?.role !== 'STUDENT') throw new HttpError(403, 'Chỉ sinh viên thuộc lớp mới được nộp bài.');

    const now = new Date();
    if (now < exam.startTime) {
      throw new Error('Bài thi chưa bắt đầu');
    }
    if (now > exam.endTime) {
      throw new Error('Bài thi đã kết thúc, không thể nộp bài');
    }

    // Tính mã băm SHA-256 toàn vẹn cho mã nguồn
    const fileHashSha256 = crypto.createHash('sha256').update(sourceCode).digest('hex');

    // Lưu phiên nộp bài với trạng thái ban đầu là QUEUED
    const submission = await this.submissionRepo.create({
      examId,
      studentId,
      sourceCodeUrl: sourceCode, // Trong MVP lưu trực tiếp code để chạy tức thì
      fileHashSha256,
    });

    // Đẩy job vào IJobQueue
    try { await this.queue.addJob('grading-queue', { submissionId: submission.id }); }
    catch (error: any) {
      // PostgreSQL is the durable receipt; recovery re-enqueues this QUEUED row.
      console.error('[Submission enqueue pending]', submission.id, error.message);
      return { ...submission, queuePending: true };
    }

    return submission;
  }

  async getSubmission(submissionId: string) {
    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission) {
      throw new Error('Không tìm thấy thông tin bài nộp');
    }
    return submission;
  }

  async getSubmissionsByExam(examId: string) {
    return this.submissionRepo.findByExamId(examId);
  }
}

export const submissionService = new SubmissionService();
