const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function fix() {
  const result = await db.submission.updateMany({
    where: { sourceCodeUrl: { startsWith: 'demo/' } },
    data: { astStatus: 'COMPLETED', astMessage: 'Demo data - no real archive.', astCompletedAt: new Date() },
  });
  console.log('Fixed', result.count, 'demo submissions -> astStatus: COMPLETED');
}

fix().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
