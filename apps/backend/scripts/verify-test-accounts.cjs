const path = require('node:path');
const assert = require('node:assert/strict');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
require('ts-node').register({ project: path.resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { authService } = require('../src/modules/auth/auth.service');
const { prisma } = require('../src/infrastructure/database/prisma');

async function main() {
  for (const [email, role] of [
    ['admin.test@fpt.edu.vn', 'ADMIN'],
    ['lecturer.test@fpt.edu.vn', 'LECTURER'],
    ['student.test@fpt.edu.vn', 'STUDENT'],
  ]) {
    const session = await authService.login(email, 'AitaTest@123');
    try {
      const actor = await authService.authenticate(session.token);
      assert.equal(actor.role, role);
      assert.equal(actor.email, email);
      console.log(`${role}: login/authenticate OK (${email})`);
    } finally {
      await authService.logout(session.refreshToken, session.token);
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
