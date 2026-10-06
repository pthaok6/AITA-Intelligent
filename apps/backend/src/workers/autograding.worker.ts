import { defaultJobQueue } from '../infrastructure/queue/bullmq-job-queue';
import { IJobQueue } from '../infrastructure/queue/job-queue.interface';
import { autogradingService, AutogradingService } from '../modules/submissions/autograding.service';

export class AutogradingWorker {
  constructor(
    private queue: IJobQueue = defaultJobQueue,
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
