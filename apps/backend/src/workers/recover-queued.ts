import { prisma } from '../infrastructure/database/prisma';
import { defaultJobQueue, BullMqJobQueue } from '../infrastructure/queue/bullmq-job-queue';

export async function recoverQueuedSubmissions(queue: BullMqJobQueue = defaultJobQueue) {
  const submissions = await prisma.submission.findMany({ where: { status: 'QUEUED' }, select: { id: true }, orderBy: { submittedAt: 'asc' }, take: 100 });
  for (const submission of submissions) await queue.addJob('grading-queue', { submissionId: submission.id });
}
