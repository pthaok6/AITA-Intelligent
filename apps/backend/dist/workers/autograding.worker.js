"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autogradingWorker = exports.AutogradingWorker = void 0;
const in_memory_job_queue_1 = require("../infrastructure/queue/in-memory-job-queue");
const autograding_service_1 = require("../modules/submissions/autograding.service");
class AutogradingWorker {
    queue;
    gradingService;
    constructor(queue = in_memory_job_queue_1.defaultJobQueue, gradingService = autograding_service_1.autogradingService) {
        this.queue = queue;
        this.gradingService = gradingService;
    }
    init() {
        this.queue.registerHandler('grading-queue', async (payload) => {
            console.log(`[AutogradingWorker] Nhận job chấm bài cho submission: ${payload.submissionId}`);
            await this.gradingService.executeSubmission(payload.submissionId);
        });
        console.log('[AutogradingWorker] Đã khởi tạo và sẵn sàng nhận jobs từ grading-queue');
    }
}
exports.AutogradingWorker = AutogradingWorker;
exports.autogradingWorker = new AutogradingWorker();
