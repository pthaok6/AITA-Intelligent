"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverQueuedSubmissions = recoverQueuedSubmissions;
const prisma_1 = require("../infrastructure/database/prisma");
const bullmq_job_queue_1 = require("../infrastructure/queue/bullmq-job-queue");
async function recoverQueuedSubmissions(queue = bullmq_job_queue_1.defaultJobQueue) {
    const submissions = await prisma_1.prisma.submission.findMany({ where: { status: 'QUEUED' }, select: { id: true }, orderBy: { submittedAt: 'asc' }, take: 100 });
    for (const submission of submissions)
        await queue.addJob('grading-queue', { submissionId: submission.id });
    const pendingAst = await prisma_1.prisma.submission.findMany({ where: { artifactType: 'ZIP', astStatus: 'PENDING', status: { in: ['COMPLETED', 'COMPILE_ERROR'] } }, select: { id: true }, take: 100, orderBy: { submittedAt: 'asc' } });
    for (const submission of pendingAst)
        await queue.addJob('plagiarism-queue', { submissionId: submission.id });
}
