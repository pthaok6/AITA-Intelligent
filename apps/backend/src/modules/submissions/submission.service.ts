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

  computeGitBlobSha(content: Buffer): string {
    const header = Buffer.from(`blob ${content.length}\0`);
    return crypto.createHash('sha1').update(Buffer.concat([header, content])).digest('hex');
  }

  async verifyZipAgainstRepo(
    repoUrl: string,
    commitSha: string,
    sourceFiles: Array<{ path: string; data: Buffer }>,
    entrypoint?: string
  ): Promise<{
    status: 'VERIFIED' | 'PARTIAL' | 'MISMATCH' | 'UNVERIFIED';
    matchPercent: number | null;
    matchedFiles: number;
    totalFiles: number;
    details: Array<{ path: string; status: string; zipBlobSha: string; gitBlobSha?: string }>;
    message: string;
  }> {
    const cleanUrl = repoUrl.trim().replace(/\.git$/, '');
    const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/) || cleanUrl.match(/^([^/]+)\/([^/]+)$/);
    if (!match || !sourceFiles.length) {
      return {
        status: 'UNVERIFIED',
        matchPercent: null,
        matchedFiles: 0,
        totalFiles: sourceFiles.length,
        details: [],
        message: 'Không thể xác định repository hoặc không có file mã nguồn.',
      };
    }
    const [_, owner, repo] = match;

    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'AITA-Intelligent-Submission',
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`, { headers });
      if (!res.ok) {
        return {
          status: 'UNVERIFIED',
          matchPercent: null,
          matchedFiles: 0,
          totalFiles: sourceFiles.length,
          details: [],
          message: `Không thể tải cây thư mục từ GitHub (HTTP ${res.status}).`,
        };
      }
      const data: any = await res.json();
      const treeItems: Array<{ path: string; type: string; sha: string }> = data.tree || [];
      const gitBlobs = new Map<string, string>();
      for (const item of treeItems) {
        if (item.type === 'blob') {
          gitBlobs.set(item.path.replace(/\\/g, '/').toLowerCase(), item.sha);
        }
      }

      const details: Array<{ path: string; status: string; zipBlobSha: string; gitBlobSha?: string }> = [];
      let matchedCount = 0;

      for (const file of sourceFiles) {
        const normZipPath = file.path.replace(/\\/g, '/');
        const zipBlobSha = this.computeGitBlobSha(file.data);

        let foundGitSha: string | undefined = gitBlobs.get(normZipPath.toLowerCase());
        if (!foundGitSha) {
          const parts = normZipPath.split('/');
          if (parts.length > 1) {
            foundGitSha = gitBlobs.get(parts.slice(1).join('/').toLowerCase());
          }
        }
        if (!foundGitSha) {
          const baseName = normZipPath.split('/').pop()?.toLowerCase();
          if (baseName) {
            for (const [gPath, gSha] of gitBlobs.entries()) {
              if (gPath.endsWith('/' + baseName) || gPath === baseName) {
                foundGitSha = gSha;
                break;
              }
            }
          }
        }

        if (foundGitSha) {
          if (foundGitSha.toLowerCase() === zipBlobSha.toLowerCase()) {
            matchedCount++;
            details.push({ path: normZipPath, status: 'MATCHED', zipBlobSha, gitBlobSha: foundGitSha });
          } else {
            details.push({ path: normZipPath, status: 'MODIFIED', zipBlobSha, gitBlobSha: foundGitSha });
          }
        } else {
          details.push({ path: normZipPath, status: 'NOT_IN_REPO', zipBlobSha });
        }
      }

      const matchPercent = sourceFiles.length > 0
        ? Math.round((matchedCount / sourceFiles.length) * 1000) / 10
        : 0;

      let status: 'VERIFIED' | 'PARTIAL' | 'MISMATCH' = 'MISMATCH';
      if (matchPercent === 100) {
        status = 'VERIFIED';
      } else if (matchPercent > 0) {
        status = 'PARTIAL';
      } else {
        status = 'MISMATCH';
      }

      const message = status === 'VERIFIED'
        ? `Đã đối chiếu toàn vẹn: 100% mã nguồn trong file ZIP trùng khớp với commit ${commitSha.slice(0, 7)} trên GitHub.`
        : status === 'PARTIAL'
        ? `Đối chiếu một phần: ${matchedCount}/${sourceFiles.length} file trùng khớp (${matchPercent}%). Một số file có sự khác biệt so với commit GitHub.`
        : `Cảnh báo bất nhất: Không tìm thấy file mã nguồn của ZIP trong commit ${commitSha.slice(0, 7)} trên repository GitHub (0/${sourceFiles.length} file khớp).`;

      return {
        status,
        matchPercent,
        matchedFiles: matchedCount,
        totalFiles: sourceFiles.length,
        details,
        message,
      };
    } catch (err: any) {
      console.warn(`[GitHub verifyZipAgainstRepo error] ${err.message}`);
      return {
        status: 'UNVERIFIED',
        matchPercent: null,
        matchedFiles: 0,
        totalFiles: sourceFiles.length,
        details: [],
        message: `Lỗi kết nối GitHub khi đối chiếu mã nguồn: ${err.message}`,
      };
    }
  }

  async verifyGitHubCommit(repoUrl: string, commitSha: string): Promise<{ exists: boolean; commitDate?: Date; authorLogin?: string }> {
    const cleanUrl = repoUrl.trim().replace(/\.git$/, '');
    const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/) || cleanUrl.match(/^([^/]+)\/([^/]+)$/);
    if (!match) return { exists: false };
    const [_, owner, repo] = match;

    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'AITA-Intelligent-Submission',
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`, { headers });
      if (res.status === 404 || res.status === 422) return { exists: false };
      const data: any = await res.json().catch(() => null);
      if (data && data.message && typeof data.message === 'string' && data.message.includes('No commit found')) {
        return { exists: false };
      }
      if (!res.ok) {
        console.warn(`[GitHub verify commit] API returned ${res.status}`);
        return { exists: true };
      }
      const dateStr = data.commit?.committer?.date || data.commit?.author?.date;
      return {
        exists: true,
        commitDate: dateStr ? new Date(dateStr) : undefined,
        authorLogin: data.author?.login,
      };
    } catch (err: any) {
      console.warn(`[GitHub verify commit failed] ${err.message}`);
      return { exists: true };
    }
  }

  async submitArchive(examId: string, studentId: string, bytes: Buffer, filename: string, entrypoint?: string, repoUrl?: string, commitSha?: string) {
    if (entrypoint !== undefined && typeof entrypoint !== 'string') throw new HttpError(400, 'Entrypoint phải là chuỗi.');
    let { exam, teamId, isLate } = await this.authorizeSubmission(examId, studentId);
    let teamRepoUrl: string | undefined;
    let validatedCommitSha: string | undefined;

    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true } });
      if (!team?.repoUrl) {
        throw new HttpError(400, 'Nhóm chưa đăng ký repository GitHub. Vui lòng đăng ký repository trước khi nộp bài.');
      }
      // If repoUrl was supplied in submission request, check against registered canonical repository
      if (repoUrl && normalizeRepoUrl(repoUrl) !== normalizeRepoUrl(team.repoUrl)) {
        throw new HttpError(400, 'Link repository không khớp với repository đã đăng ký của nhóm.');
      }
      teamRepoUrl = team.repoUrl;

      // Validate commitSha if provided
      if (commitSha && typeof commitSha === 'string' && commitSha.trim()) {
        const cleanSha = commitSha.trim();
        if (!/^[a-fA-F0-9]{7,40}$/.test(cleanSha)) {
          throw new HttpError(400, 'Mã commit SHA không hợp lệ (yêu cầu 7 đến 40 ký tự hex).');
        }

        const commitCheck = await this.verifyGitHubCommit(teamRepoUrl, cleanSha);
        if (!commitCheck.exists) {
          throw new HttpError(400, `Commit SHA "${cleanSha}" không tồn tại trên repository GitHub "${teamRepoUrl}".`);
        }

        // Check if commit was authored after exam deadline (BR-02 late policy)
        if (commitCheck.commitDate && commitCheck.commitDate > exam.endTime) {
          isLate = true;
        }

        validatedCommitSha = cleanSha;
      }
    }

    const bundle = selectBundle(await readZip(bytes), exam.allowedLanguage, entrypoint);
    const stored = await persistArchive(bytes);

    // BR-07: Duplicate submission detection by SHA-256
    const duplicate = await this.submissionRepo.findByFileHash(examId, stored.hash, teamId, studentId);
    if (duplicate) {
      throw new HttpError(400, 'Bài nộp này có nội dung giống hệt bài nộp trước đó (BR-07: Trùng mã băm SHA-256). Vui lòng không nộp lại tệp tin trùng lặp.');
    }

    // Cross-reference code between ZIP and registered GitHub repo when commitSha is provided
    let repoMatchResult: {
      status: 'VERIFIED' | 'PARTIAL' | 'MISMATCH' | 'UNVERIFIED';
      matchPercent: number | null;
      details: Array<{ path: string; status: string; zipBlobSha: string; gitBlobSha?: string }>;
      message: string;
    } | undefined;

    if (teamId && teamRepoUrl && validatedCommitSha) {
      repoMatchResult = await this.verifyZipAgainstRepo(
        teamRepoUrl,
        validatedCommitSha,
        bundle.files,
        bundle.entrypoint
      );

      if (repoMatchResult && repoMatchResult.status === 'MISMATCH') {
        throw new HttpError(400, 'Bài nộp bị từ chối: Toàn bộ mã nguồn trong tệp ZIP không trùng khớp với Git Tree tại commit đã chọn trên repository GitHub của nhóm (Phát hiện sai lệch mã nguồn). Vui lòng đồng bộ mã nguồn trước khi nộp.');
      }
    }

    const submissionStatus = isLate ? SubmissionStatus.LATE : SubmissionStatus.QUEUED;

    const submission = await this.submissionRepo.create({
      examId, studentId, teamId, sourceCodeUrl: stored.key, fileHashSha256: stored.hash,
      artifactType: 'ZIP', originalFilename: filename.slice(0, 200), entrypoint: bundle.entrypoint,
      sourceFiles: bundle.files.map(file => ({ path: file.path, size: file.data.length })),
      teamRepoUrl,
      commitSha: validatedCommitSha,
      repoMatchStatus: repoMatchResult?.status,
      repoMatchPercent: repoMatchResult?.matchPercent,
      repoMatchDetails: repoMatchResult?.details,
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
