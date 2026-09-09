import { submissionRepository, SubmissionRepository } from './submission.repository';
import { examRepository, ExamRepository } from '../exams/exam.repository';
import { defaultSandboxService } from '../../infrastructure/sandbox/mock-sandbox.service';
import { ISandboxService } from '../../infrastructure/sandbox/sandbox.interface';
import { SubmissionStatus, TestCaseStatus } from '../../domain/enums';

export class AutogradingService {
  constructor(
    private submissionRepo: SubmissionRepository = submissionRepository,
    private examRepo: ExamRepository = examRepository,
    private sandboxService: ISandboxService = defaultSandboxService
  ) {}

  async executeSubmission(submissionId: string): Promise<void> {
    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission) {
      console.error(`[AutogradingService] Submission not found: ${submissionId}`);
      return;
    }

    // 1. Cập nhật trạng thái RUNNING
    await this.submissionRepo.updateStatus(submissionId, SubmissionStatus.RUNNING, {
      startedAt: new Date(),
    });

    try {
      // 2. Lấy toàn bộ test cases (kể cả test case ẩn)
      const exam = await this.examRepo.findById(submission.examId, true);
      if (!exam || !exam.testCases || exam.testCases.length === 0) {
        await this.submissionRepo.updateStatus(submissionId, SubmissionStatus.COMPLETED, {
          completedAt: new Date(),
          totalScore: 0,
          compileMessage: 'Không có test case nào cho bài thi này.',
        });
        return;
      }

      let totalScoreEarned = 0;
      const testResultsToSave = [];

      // 3. Duyệt chạy từng test case qua ISandboxService
      for (const tc of exam.testCases) {
        const result = await this.sandboxService.execute(
          submission.sourceCodeUrl, // Trong MVP sourceCodeUrl chứa raw code
          exam.allowedLanguage,
          tc.inputData,
          tc.expectedOutput,
          exam.timeLimitMs
        );

        const scoreEarned = result.status === TestCaseStatus.ACCEPTED ? tc.scoreWeight : 0;
        totalScoreEarned += scoreEarned;

        testResultsToSave.push({
          submissionId: submission.id,
          testCaseId: tc.id,
          status: result.status,
          actualOutput: tc.isHidden ? 'Hidden testcase output' : result.actualOutput,
          executionTimeMs: result.executionTimeMs,
          memoryUsedKb: result.memoryUsedKb,
          scoreEarned,
        });
      }

      // 4. Lưu kết quả chi tiết từng testcase
      await this.submissionRepo.saveTestResults(testResultsToSave);

      // 5. Cập nhật bài nộp sang COMPLETED và chốt tổng điểm
      await this.submissionRepo.updateStatus(submissionId, SubmissionStatus.COMPLETED, {
        completedAt: new Date(),
        totalScore: Math.round(totalScoreEarned * 100) / 100,
      });

      console.log(`[AutogradingService] Chấm bài thành công cho ${submissionId}, tổng điểm: ${totalScoreEarned}`);
    } catch (error: any) {
      console.error(`[AutogradingService] Lỗi khi chấm bài ${submissionId}:`, error);
      await this.submissionRepo.updateStatus(submissionId, SubmissionStatus.FAILED, {
        completedAt: new Date(),
        compileMessage: error.message || 'Lỗi không xác định trong quá trình chấm',
      });
    }
  }
}

export const autogradingService = new AutogradingService();
