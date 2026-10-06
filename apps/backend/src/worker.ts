import dotenv from 'dotenv';
dotenv.config();
import { prisma } from './infrastructure/database/prisma';
import { defaultJobQueue } from './infrastructure/queue/bullmq-job-queue';
import { autogradingWorker } from './workers/autograding.worker';
import { recoverQueuedSubmissions } from './workers/recover-queued';

autogradingWorker.init();
let recovering = false;
async function recover() {
  if (recovering) return;
  recovering = true;
  try { await recoverQueuedSubmissions(); }
  catch (error: any) { console.error('[Queue recovery]', error.message); }
  finally { recovering = false; }
}
void recover();
const timer = setInterval(() => { void recover(); }, 10000);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await defaultJobQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
