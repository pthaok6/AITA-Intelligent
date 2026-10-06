const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
require('dotenv').config(); require('dotenv').config({ path: '.env.test' });
if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.includes('test') || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) throw new Error('Dedicated TEST_DATABASE_URL required.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = 'sandbox-integration-jwt-secret-at-least-32-characters';
const suffix = Date.now() + '-' + Math.random().toString(16).slice(2);
process.env.QUEUE_PREFIX = 'aita-sandbox-test-' + suffix;
const testStorage = path.resolve(__dirname, '../storage-test-' + suffix);
process.env.SUBMISSION_STORAGE_DIR = testStorage;
const { app } = require('../dist/app');
const { prisma } = require('../dist/infrastructure/database/prisma');
const { authService } = require('../dist/modules/auth/auth.service');
const { BullMqJobQueue, defaultJobQueue } = require('../dist/infrastructure/queue/bullmq-job-queue');
const { AutogradingWorker } = require('../dist/workers/autograding.worker');
const { AutogradingService } = require('../dist/modules/submissions/autograding.service');
const { RblService } = require('../dist/modules/rbl/rbl.service');
const { archivePath, loadBundle } = require('../dist/infrastructure/storage/submission-archive');
async function zip(code) { const book = new JSZip(); book.file('main.py', code); return book.generateAsync({ type: 'nodebuffer' }); }
async function waitFor(check, ms = 90000) { const end = Date.now() + ms; while (Date.now() < end) { const row = await check(); if (row) return row; await new Promise(resolve => setTimeout(resolve, 200)); } throw new Error('Timed out waiting for sandbox job.'); }

test('ZIP API -> BullMQ -> Docker -> PostgreSQL AST/report', { timeout: 240000 }, async t => {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const queue = new BullMqJobQueue(); const worker = new BullMqJobQueue();
  const userIds = []; let cls;
  const request = async (endpoint, token, body, method = 'GET') => {
    const response = await fetch(base + endpoint, { method, body, headers: { 'X-AITA-Request': '1', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) } });
    return { status: response.status, data: await response.json() };
  };
  try {
    const password = 'Sandbox-testing-123';
    const users = [];
    for (const [name, role] of [['lecturer', 'LECTURER'], ['student-a', 'STUDENT'], ['student-b', 'STUDENT'], ['outsider', 'LECTURER']]) {
      const session = await authService.register(name + '-' + suffix + '@gmail.com', password, name);
      userIds.push(session.user.id);
      const user = await prisma.user.update({ where: { id: session.user.id }, data: { role } });
      users.push({ ...user, token: (await authService.login(user.email, password)).token });
    }
    const [lecturer, studentA, studentB, outsider] = users;
    cls = await prisma.class.create({ data: { classCode: 'SANDBOX-' + suffix, name: 'Sandbox test', semester: 'TEST', lecturerId: lecturer.id } });
    for (const student of [studentA, studentB]) await prisma.classEnrollment.create({ data: { classId: cls.id, studentId: student.id } });
    const exam = await prisma.exam.create({ data: { classId: cls.id, title: 'Addition', descriptionMd: 'Add', allowedLanguage: 'PYTHON', timeLimitMs: 2000, memoryLimitMb: 128, startTime: new Date(Date.now() - 10000), endTime: new Date(Date.now() + 600000), testCases: { create: [{ inputData: '2 3\n', expectedOutput: '5\n', orderIndex: 1, scoreWeight: 50 }, { inputData: '-7 10\n', expectedOutput: '3\n', orderIndex: 2, scoreWeight: 50, isHidden: true }] } } });
    new AutogradingWorker(worker, new AutogradingService(undefined, undefined, undefined, queue)).init();
    const rbl = new RblService(); worker.registerHandler('plagiarism-queue', async ({ submissionId }) => rbl.analyze(submissionId));
    async function upload(code, token = studentA.token, filename = 'submission.zip') {
      const form = new FormData(); form.append('file', new Blob([await zip(code)]), filename);
      return request('/exams/' + exam.id + '/submissions', token, form, 'POST');
    }
    let first, second;
    await t.test('multipart ZIP is persisted, SHA-256 verified and real scores saved', async () => {
      const result = await upload('a, b = map(int, input().split())\nprint(a + b)\n');
      assert.equal(result.status, 201, JSON.stringify(result)); first = result.data.data;
      assert.equal(first.artifactType, 'ZIP'); assert.ok(!('sourceCodeUrl' in first));
      const row = await waitFor(async () => { const row = await prisma.submission.findUnique({ where: { id: first.id }, include: { testResults: true, fingerprints: true } }); return row.status === 'COMPLETED' && row.astStatus === 'COMPLETED' ? row : null; });
      assert.equal(row.totalScore, 100); assert.equal(row.testResults.length, 2); assert.ok(row.fingerprints.length > 0); assert.equal(row.astK, 5);
      assert.equal(row.testResults[0].exitCode, 0); assert.ok(row.testResults.every(r => r.memoryUsedKb > 0));
      const log = await fs.readFile(path.join(testStorage, 'logs', first.id + '.jsonl'), 'utf8'); assert.match(log, /"stage":"compile"/); assert.match(log, /"stage":"testcase"/);
    });
    await t.test('renamed student code produces canonical persisted similarity report', async () => {
      const result = await upload('first, second = map(int, input().split())\n# renamed\nprint(first + second)\n', studentB.token); assert.equal(result.status, 201); second = result.data.data;
      const report = await waitFor(() => prisma.plagiarismReport.findFirst({ where: { examId: exam.id } }));
      assert.equal(report.similarityScore, 100); assert.ok(report.submissionAId < report.submissionBId); assert.ok(report.matchedHashesCount > 0);
      const visible = await request('/exams/' + exam.id + '/plagiarism', lecturer.token); assert.equal(visible.status, 200); assert.equal(visible.data.data.length, 1);
      assert.equal((await request('/exams/' + exam.id + '/plagiarism', studentA.token)).status, 403);
      assert.equal((await request('/exams/' + exam.id + '/plagiarism', outsider.token)).status, 403);
    });
    await t.test('hidden stdout/stderr stay hidden for students and archive is access-controlled', async () => {
      const studentView = await request('/submissions/' + first.id, studentA.token); assert.equal(studentView.status, 200);
      const hidden = studentView.data.data.testResults.find(r => r.testCase.isHidden); assert.equal(hidden.actualOutput, null); assert.equal(hidden.stderr, null);
      const lecturerView = await request('/submissions/' + first.id, lecturer.token); assert.equal(lecturerView.data.data.testResults.find(r => r.testCase.isHidden).actualOutput, '3\n');
      assert.equal((await request('/submissions/' + first.id, studentB.token)).status, 403);
      const download = await fetch(base + '/submissions/' + first.id + '/archive', { headers: { Authorization: 'Bearer ' + studentA.token } }); assert.equal(download.status, 200); assert.ok((await download.arrayBuffer()).byteLength);
      assert.equal((await request('/submissions/' + first.id + '/archive', studentB.token)).status, 403);
      const fps = await request('/submissions/' + first.id + '/fingerprints', lecturer.token); assert.ok(fps.data.data.total > 0); assert.equal(typeof fps.data.data.items[0].hashValue, 'string');
    });
    await t.test('compiler errors are terminal and syntax error affects AST separately', async () => {
      const result = await upload('def broken(:\n'); assert.equal(result.status, 201);
      const row = await waitFor(async () => { const row = await prisma.submission.findUnique({ where: { id: result.data.data.id } }); return row.status === 'COMPILE_ERROR' && row.astStatus === 'ERROR' ? row : null; });
      assert.match(row.compileMessage, /SyntaxError/); assert.equal(row.totalScore, 0);
    });
    await t.test('wrong extension, unauthenticated and unauthorized upload are rejected', async () => {
      assert.equal((await upload('print(3)', studentA.token, 'code.txt')).status, 400);
      assert.equal((await upload('print(3)', '')).status, 401);
      assert.equal((await upload('print(3)', outsider.token)).status, 403);
    });
    await t.test('archive tampering fails SHA-256 verification before parsing', async () => {
      const stored = await prisma.submission.findUniqueOrThrow({ where: { id: first.id } });
      await fs.appendFile(archivePath(stored.sourceCodeUrl), 'tampered');
      await assert.rejects(loadBundle(stored.sourceCodeUrl, stored.fileHashSha256, 'PYTHON', stored.entrypoint), /SHA-256 mismatch/);
    });
  } finally {
    await worker.close(); await queue.close(); await defaultJobQueue.close();
    await new Promise(resolve => server.close(resolve));
    if (cls) await prisma.submission.deleteMany({ where: { exam: { classId: cls.id } } });
    if (cls) await prisma.class.delete({ where: { id: cls.id } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await prisma.$disconnect();
    // Verify the resolved path is the unique test folder within this backend before deletion.
    const backend = path.resolve(__dirname, '..');
    if (path.dirname(testStorage) !== backend || !path.basename(testStorage).startsWith('storage-test-')) throw new Error('Unsafe test cleanup path.');
    try { if (await fs.realpath(testStorage) !== testStorage) throw new Error('Unexpected test storage link.'); await fs.rm(testStorage, { recursive: true, force: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
});
