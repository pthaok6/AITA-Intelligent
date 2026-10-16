import crypto from 'crypto';
import { submissionRepository, SubmissionRepository } from './submission.repository';
import { examRepository, ExamRepository } from '../exams/exam.repository';
import { defaultJobQueue } from '../../infrastructure/queue/bullmq-job-queue';
import { prisma } from '../../infrastructure/database/prisma';
import { HttpError } from '../../shared/http';
import { IJobQueue } from '../../infrastructure/queue/job-queue.interface';
import { readZip, selectBundle, persistArchive } from '../../infrastructure/storage/submission-archive';

export class SubmissionService {
  constructor(private submissionRepo: SubmissionRepository = submissionRepository, private examRepo: ExamRepository = examRepository, private queue: IJobQueue = defaultJobQueue) {}
  async authorizeSubmission(examId: string, studentId: string): Promise<{ exam: any; teamId?: string }> {
    const exam = await this.examRepo.findById(examId);
    if (!exam) throw new HttpError(404, 'Không tìm thấy bài thi.');
    const enrollment = await prisma.classEnrollment.findUnique({ where: { classId_studentId: { classId: exam.classId, studentId } } });
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!enrollment || enrollment.status !== 'ACTIVE' || student?.role !== 'STUDENT') throw new HttpError(403, 'Chỉ sinh viên đang học trong lớp được nộp bài.');
    if (new Date() < exam.startTime || new Date() >= exam.endTime) throw new HttpError(400, 'Bài thi chưa bắt đầu hoặc đã kết thúc.');

    let teamId: string | undefined = undefined;
    if (exam.examType === 'GROUP') {
      const team = await prisma.team.findFirst({
        where: { examId, members: { some: { studentId } } },
        include: { members: { where: { studentId } } },
      });
      if (!team) {
        throw new HttpError(403, 'Bài thi này là bài tập nhóm. Bạn cần tham gia một nhóm trước khi nộp bài.');
      }
      const membership = team.members[0];
      if (!membership || membership.role !== 'LEADER') {
        throw new HttpError(403, 'Chỉ Trưởng nhóm (Team Leader) mới có quyền nộp bài cho nhóm (BR-11).');
      }
      teamId = team.id;
    }

    return { exam, teamId };
  }
  private async enqueue(submission: any) {
    try { await this.queue.addJob('grading-queue', { submissionId: submission.id }); }
    catch (error: any) { console.error('[Submission enqueue pending]', submission.id, error.message); return { ...submission, queuePending: true }; }
    return submission;
  }
  async submitArchive(examId: string, studentId: string, bytes: Buffer, filename: string, entrypoint?: string, repoUrl?: string) {
    if (entrypoint !== undefined && typeof entrypoint !== 'string') throw new HttpError(400, 'Entrypoint phải là chuỗi.');
    const { exam, teamId } = await this.authorizeSubmission(examId, studentId);
    let teamRepoUrl: string | undefined;
    if (teamId) {
      if (typeof repoUrl !== 'string' || !repoUrl.trim()) throw new HttpError(400, 'Bài nộp nhóm cần có link repository GitHub.');
      let parsedUrl: URL;
      try { parsedUrl = new URL(repoUrl.trim()); }
      catch { throw new HttpError(400, 'Link repository GitHub không hợp lệ.'); }
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (parsedUrl.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(parsedUrl.hostname.toLowerCase()) || pathParts.length < 2) {
        throw new HttpError(400, 'Link repository phải có dạng https://github.com/owner/repository.');
      }
      teamRepoUrl = parsedUrl.toString().replace(/\/$/, '');
    }
    const bundle = selectBundle(await readZip(bytes), exam.allowedLanguage, entrypoint);
    const stored = await persistArchive(bytes);
    const submission = await this.submissionRepo.create({
      examId, studentId, teamId, sourceCodeUrl: stored.key, fileHashSha256: stored.hash,
      artifactType: 'ZIP', originalFilename: filename.slice(0, 200), entrypoint: bundle.entrypoint,
      sourceFiles: bundle.files.map(file => ({ path: file.path, size: file.data.length })),
      teamRepoUrl,
    });
    return this.enqueue(submission);
  }
  // Compatibility for explicit mock tests only. The HTTP API accepts ZIP exclusively.
  async submitCode(examId: string, studentId: string, sourceCode: string) {
    const { teamId } = await this.authorizeSubmission(examId, studentId);
    const submission = await this.submissionRepo.create({ examId, studentId, teamId, sourceCodeUrl: sourceCode, fileHashSha256: crypto.createHash('sha256').update(sourceCode).digest('hex'), artifactType: 'LEGACY_TEXT', astStatus: 'SKIPPED' });
    return this.enqueue(submission);
  }
  async getSubmission(id: string) {
    const result = await this.submissionRepo.findById(id);
    if (!result) throw new HttpError(404, 'Không tìm thấy bài nộp.');
    return result;
  }
  async getLatestSubmissionId(examId: string, studentId: string) {
    return (await this.submissionRepo.findLatestForStudent(examId, studentId))?.id;
  }
  async getSubmissionsByExam(examId: string, studentId?: string) { return this.submissionRepo.findByExamId(examId, studentId); }
}
export const submissionService = new SubmissionService();
