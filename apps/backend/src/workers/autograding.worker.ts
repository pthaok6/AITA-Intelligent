import { defaultJobQueue, InMemoryJobQueue } from '../infrastructure/queue/in-memory-job-queue';
import { autogradingService, AutogradingService } from '../modules/submissions/autograding.service';

export class AutogradingWorker {
  constructor(
    private queue: InMemoryJobQueue = defaultJobQueue,
    private gradingService: AutogradingService = autogradingService
  ) {}

  init(): void {
    this.queue.registerHandler('grading-queue', async (payload: { submissionId: string }) => {
      console.log(`[AutogradingWorker] Nhận job chấm bài cho submission: ${payload.submissionId}`);
      await this.gradingService.executeSubmission(payload.submissionId);
    });
    console.log('[AutogradingWorker] Đã khởi tạo và sẵn sàng nhận jobs từ grading-queue');
  }
}

export const autogradingWorker = new AutogradingWorker();
