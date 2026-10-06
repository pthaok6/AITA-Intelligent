import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { jwtSecret } from './config';
import { prisma } from './infrastructure/database/prisma';
import { defaultJobQueue } from './infrastructure/queue/bullmq-job-queue';

const PORT = process.env.PORT || 5000;

jwtSecret();

const server = app.listen(PORT, () => {
  console.log(`🚀 AITA Backend Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});
server.on('error', error => { console.error(error.message); process.exit(1); });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await defaultJobQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
