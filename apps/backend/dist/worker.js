"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma_1 = require("./infrastructure/database/prisma");
const bullmq_job_queue_1 = require("./infrastructure/queue/bullmq-job-queue");
const autograding_worker_1 = require("./workers/autograding.worker");
const recover_queued_1 = require("./workers/recover-queued");
const rbl_service_1 = require("./modules/rbl/rbl.service");
autograding_worker_1.autogradingWorker.init();
bullmq_job_queue_1.defaultJobQueue.registerHandler('plagiarism-queue', async ({ submissionId }) => rbl_service_1.rblService.analyze(submissionId));
let recovering = false;
async function recover() {
    if (recovering)
        return;
    recovering = true;
    try {
        await (0, recover_queued_1.recoverQueuedSubmissions)();
    }
    catch (error) {
        console.error('[Queue recovery]', error.message);
    }
    finally {
        recovering = false;
    }
}
void recover();
const timer = setInterval(() => { void recover(); }, 10000);
let stopping = false;
async function stop() {
    if (stopping)
        return;
    stopping = true;
    clearInterval(timer);
    await bullmq_job_queue_1.defaultJobQueue.close();
    await prisma_1.prisma.$disconnect();
    process.exit(0);
}
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
