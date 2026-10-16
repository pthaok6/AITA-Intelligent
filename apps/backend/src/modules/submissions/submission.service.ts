import crypto from 'crypto';
import { submissionRepository, SubmissionRepository } from './submission.repository';
import { examRepository, ExamRepository } from '../exams/exam.repository';
import { defaultJobQueue } from '../../infrastructure/queue/bullmq-job-queue';
import { prisma } from '../../infrastructure/database/prisma';
import { HttpError } from '../../shared/http';
import { IJobQueue } from '../../infrastructure/queue/job-queue.interface';
import { readZip, selectBundle, persistArchive } from '../../infrastructure/storage/submission-archive';

import { normalizeRepoUrl } from '../teams/team.service';
import { SubmissionStatus } from '../../domain/enums';

export class SubmissionService {
  constructor(private submissionRepo: SubmissionRepository = submissionRepository, private examRepo: ExamRepository = examRepository, private queue: IJobQueue = defaultJobQueue) {}
  async authorizeSubmission(examId: string, studentId: string): Promise<{ exam: any; teamId?: string; isLate: boolean }> {
    const exam = await this.examRepo.findById(examId);
    if (!exam) throw new HttpError(404, 'Không tìm thấy bài thi.');
    const enrollment = await prisma.classEnrollment.findUnique({ where: { classId_studentId: { classId: exam.classId, studentId } } });
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!enrollment || enrollment.status !== 'ACTIVE' || student?.role !== 'STUDENT') throw new HttpError(403, 'Chỉ sinh viên đang học trong lớp được nộp bài.');
    
    const now = new Date();
    if (now < exam.startTime) throw new HttpError(400, 'Bài thi chưa bắt đầu.');
    const isLate = now >= exam.endTime;

    let teamId: string | undefined = undefined;
    if (exam.examType === 'GROUP') {
      const team = await prisma.team.findFirst({
        where: { examId, members: { some: { studentId } } },
        include: { members: true },
      });
      if (!team) {
        throw new HttpError(403, 'Bài thi này là bài tập nhóm. Bạn cần tham gia một nhóm trước khi nộp bài.');
      }
      const membership = team.members.find(m => m.studentId === studentId);
      if (!membership || membership.role !== 'LEADER') {
        throw new HttpError(403, 'Chỉ Trưởng nhóm (Team Leader) mới có quyền nộp bài cho nhóm (BR-11).');
      }
      if (!team.repoUrl) {
        throw new HttpError(400, 'Nhóm chưa đăng ký repository GitHub. Vui lòng đăng ký repository tại trang Nhóm của tôi trước khi nộp bài.');
      }
      teamId = team.id;
    }

    return { exam, teamId, isLate };
  }
  private async enqueue(submission: any) {
    try { await this.queue.addJob('grading-queue', { submissionId: submission.id }); }
    catch (error: any) { console.error('[Submission enqueue pending]', submission.id, error.message); return { ...submission, queuePending: true }; }
    return submission;
  }
  async submitArchive(examId: string, studentId: string, bytes: Buffer, filename: string, entrypoint?: string, repoUrl?: string) {
    if (entrypoint !== undefined && typeof entrypoint !== 'string') throw new HttpError(400, 'Entrypoint phải là chuỗi.');
    const { exam, teamId, isLate } = await this.authorizeSubmission(examId, studentId);
    let teamRepoUrl: string | undefined;
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team?.repoUrl) {
        throw new HttpError(400, 'Nhóm chưa đăng ký repository GitHub. Vui lòng đăng ký repository trước khi nộp bài.');
      }
      // If repoUrl was supplied in submission request, check against registered canonical repository
      if (repoUrl && normalizeRepoUrl(repoUrl) !== normalizeRepoUrl(team.repoUrl)) {
        throw new HttpError(400, 'Link repository không khớp với repository đã đăng ký của nhóm.');
      }
      teamRepoUrl = team.repoUrl;
    }

    const bundle = selectBundle(await readZip(bytes), exam.allowedLanguage, entrypoint);
    const stored = await persistArchive(bytes);

    // BR-07: Duplicate submission detection by SHA-256
    const duplicate = await this.submissionRepo.findByFileHash(examId, stored.hash, teamId, studentId);
    if (duplicate) {
      throw new HttpError(400, 'Bài nộp này có nội dung giống hệt bài nộp trước đó (BR-07: Trùng mã băm SHA-256). Vui lòng không nộp lại tệp tin trùng lặp.');
    }

    const submissionStatus = isLate ? SubmissionStatus.LATE : SubmissionStatus.QUEUED;

    const submission = await this.submissionRepo.create({
      examId, studentId, teamId, sourceCodeUrl: stored.key, fileHashSha256: stored.hash,
      artifactType: 'ZIP', originalFilename: filename.slice(0, 200), entrypoint: bundle.entrypoint,
      sourceFiles: bundle.files.map(file => ({ path: file.path, size: file.data.length })),
      teamRepoUrl,
      status: submissionStatus,
      isLate,
    });

    // BR-02: Late submissions require lecturer approval before autograding
    if (isLate) {
      return submission;
    }
    return this.enqueue(submission);
  }
  // Compatibility for explicit mock tests only. The HTTP API accepts ZIP exclusively.
  async submitCode(examId: string, studentId: string, sourceCode: string) {
    const { teamId, isLate } = await this.authorizeSubmission(examId, studentId);
    const submission = await this.submissionRepo.create({
      examId, studentId, teamId, sourceCodeUrl: sourceCode,
      fileHashSha256: crypto.createHash('sha256').update(sourceCode).digest('hex'),
      artifactType: 'LEGACY_TEXT', astStatus: 'SKIPPED',
      status: isLate ? SubmissionStatus.LATE : SubmissionStatus.QUEUED,
      isLate,
    });
    if (isLate) return submission;
    return this.enqueue(submission);
  }
  async approveLateSubmission(submissionId: string, lecturerId: string) {
    const sub = await this.submissionRepo.findById(submissionId);
    if (!sub) throw new HttpError(404, 'Không tìm thấy bài nộp.');
    if (sub.status !== SubmissionStatus.LATE) throw new HttpError(400, 'Bài nộp không ở trạng thái nộp muộn.');

    const updated = await this.submissionRepo.updateStatus(submissionId, SubmissionStatus.QUEUED);
    await prisma.auditLog.create({
      data: {
        action: 'LATE_APPROVAL',
        entityType: 'SUBMISSION',
        entityId: submissionId,
        actorId: lecturerId,
        newValue: 'APPROVED',
        reason: 'Giảng viên duyệt chấm bài nộp muộn (BR-02)',
      },
    });
    return this.enqueue(updated);
  }
  async getSubmission(id: string) {
    const result = await this.submissionRepo.findById(id);
    if (!result) throw new HttpError(404, 'Không tìm thấy bài nộp.');
    return result;
  }
  async getLatestSubmissionId(examId: string, studentId: string) {
    const exam = await this.examRepo.findById(examId);
    if (exam?.examType === 'GROUP') {
      const team = await prisma.team.findFirst({
        where: { examId, members: { some: { studentId } } },
        select: { id: true },
      });
      if (team) {
        return (await this.submissionRepo.findLatestForTeam(examId, team.id))?.id;
      }
    }
    return (await this.submissionRepo.findLatestForStudent(examId, studentId))?.id;
  }
  async getSubmissionsByExam(examId: string, studentId?: string) { return this.submissionRepo.findByExamId(examId, studentId); }
}
export const submissionService = new SubmissionService();
