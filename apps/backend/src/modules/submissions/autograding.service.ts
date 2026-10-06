import { submissionRepository, SubmissionRepository } from './submission.repository';
import { examRepository, ExamRepository } from '../exams/exam.repository';
import { ISandboxService } from '../../infrastructure/sandbox/sandbox.interface';
import { dockerSandbox, DockerSandboxService } from '../../infrastructure/sandbox/docker-sandbox.service';
import { loadBundle, writeSandboxLog } from '../../infrastructure/storage/submission-archive';
import { defaultJobQueue } from '../../infrastructure/queue/bullmq-job-queue';
import { IJobQueue } from '../../infrastructure/queue/job-queue.interface';

export class AutogradingService {
  constructor(private submissionRepo: SubmissionRepository = submissionRepository, private examRepo: ExamRepository = examRepository,
    private sandbox: DockerSandboxService | ISandboxService = dockerSandbox, private queue: IJobQueue = defaultJobQueue) {}
  async executeSubmission(submissionId: string) {
    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission || ['COMPLETED', 'COMPILE_ERROR'].includes(submission.status)) return;
    await this.submissionRepo.updateStatus(submissionId, 'RUNNING', { startedAt: new Date(), totalScore: 0 });
    try {
      const exam = await this.examRepo.findById(submission.examId, true);
      if (!exam) throw new Error('Exam not found.');
      let prepared;
      if (this.sandbox instanceof DockerSandboxService) {
        if (submission.artifactType !== 'ZIP') throw new Error('Bài nộp cũ dùng mã nguồn dạng text. Vui lòng nộp lại bằng ZIP.');
        const bundle = await loadBundle(submission.sourceCodeUrl, submission.fileHashSha256, exam.allowedLanguage, submission.entrypoint);
        prepared = await this.sandbox.compile(bundle);
        await writeSandboxLog(submissionId, { stage: 'compile', ...prepared.compile });
        const compilation = prepared.compile;
        if (compilation.exitCode || compilation.timedOut || compilation.oom || compilation.outputTruncated) {
          await this.submissionRepo.updateStatus(submissionId, 'COMPILE_ERROR', { completedAt: new Date(), totalScore: 0, compileMessage: (compilation.stderr + '\n' + compilation.stdout + (compilation.timedOut ? '\nCompiler exceeded 60s.' : '') + (compilation.oom ? '\nCompiler exceeded 512 MiB.' : '')).slice(0, 12000) });
          await this.enqueueAst(submissionId); return;
        }
      }
      const results = [];
      let totalScore = 0;
      for (const tc of exam.testCases || []) {
        const result: any = this.sandbox instanceof DockerSandboxService
          ? await this.sandbox.executePrepared(prepared!, tc.inputData, tc.expectedOutput, exam.timeLimitMs, exam.memoryLimitMb)
          : await this.sandbox.execute(submission.sourceCodeUrl, exam.allowedLanguage, tc.inputData, tc.expectedOutput, exam.timeLimitMs);
        const scoreEarned = result.status === 'ACCEPTED' ? tc.scoreWeight : 0;
        totalScore += scoreEarned;
        results.push({ submissionId, testCaseId: tc.id, status: result.status, actualOutput: result.actualOutput, stderr: result.stderr, exitCode: result.exitCode, outputTruncated: result.outputTruncated || false, executionTimeMs: result.executionTimeMs, memoryUsedKb: result.memoryUsedKb, scoreEarned });
        await writeSandboxLog(submissionId, { stage: 'testcase', testCaseId: tc.id, isHidden: tc.isHidden, ...result });
      }
      await this.submissionRepo.saveTestResults(results);
      await this.submissionRepo.updateStatus(submissionId, 'COMPLETED', { completedAt: new Date(), totalScore: Math.round(totalScore * 100) / 100, compileMessage: prepared ? (prepared.compile.stderr + prepared.compile.stdout).slice(0, 12000) : '' });
      if (submission.artifactType === 'ZIP') await this.enqueueAst(submissionId);
    } catch (error: any) {
      await this.submissionRepo.updateStatus(submissionId, 'FAILED', { completedAt: new Date(), compileMessage: error.message.slice(0, 4000) });
      await writeSandboxLog(submissionId, { stage: 'error', message: error.message });
      throw error;
    }
  }
  private async enqueueAst(submissionId: string) {
    try { await this.queue.addJob('plagiarism-queue', { submissionId }); }
    catch (error: any) { console.error('[AST enqueue pending]', submissionId, error.message); }
  }
}
export const autogradingService = new AutogradingService();
