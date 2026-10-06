const { test } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
require('dotenv').config({ path: '.env.test' });
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a dedicated test database.');
const testUrl = new URL(process.env.TEST_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
if (testUrl.toString() === appUrl.toString() || !testUrl.pathname.includes('test')) throw new Error('Integration tests require a separate database whose name includes test.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = 'integration-test-secret-with-at-least-32-characters';
process.env.QUEUE_PREFIX = 'aita-test-' + Date.now();
process.env.FRONTEND_ORIGINS = 'http://localhost:5173';
process.env.GOOGLE_CLIENT_ID = '';
const ExcelJS = require('exceljs');
const jwt = require('jsonwebtoken');
const { Queue } = require('bullmq');
const { app } = require('../dist/app');
const { prisma } = require('../dist/infrastructure/database/prisma');
const { authService, hashToken } = require('../dist/modules/auth/auth.service');
const { rosterImportService } = require('../dist/modules/classes/roster-import.service');
const { BullMqJobQueue, defaultJobQueue } = require('../dist/infrastructure/queue/bullmq-job-queue');
const { SubmissionService } = require('../dist/modules/submissions/submission.service');
const { AutogradingWorker } = require('../dist/workers/autograding.worker');
const { AutogradingService } = require('../dist/modules/submissions/autograding.service');
const { MockSandboxService } = require('../dist/infrastructure/sandbox/mock-sandbox.service');
const { recoverQueuedSubmissions } = require('../dist/workers/recover-queued');
const { once } = require('node:events');
const suffix = Date.now() + '-' + Math.random().toString(16).slice(2);
const email = (name) => name + '-' + suffix + '@fpt.edu.vn';
const password = 'Testing-password-123';
const userEmails = [];
async function workbook(rows, headers = ['Email', 'Họ tên']) {
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Students');
  sheet.addRow(headers); rows.forEach(row => sheet.addRow(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}
async function waitFor(check, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = await check(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw new Error('Timed out waiting for condition.');
}
test('Milestone 2 integration on PostgreSQL and Redis', async t => {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const queues = [];
  async function request(endpoint, options = {}) {
    const response = await fetch(base + endpoint, { ...options, headers: { 'X-AITA-Request': '1', ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
    return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
  }
  const createdClasses = [];
  let student, lecturer, outsider, cls, session;
  try {
    await t.test('public registration rejects privilege escalation', async () => {
      const result = await request('/auth/register', { method: 'POST', body: JSON.stringify({ email: email('escalate'), password, fullName: 'A', role: 'ADMIN' }) });
      assert.equal(result.status, 403); assert.equal(await prisma.user.count({ where: { email: email('escalate') } }), 0);
    });
    await t.test('register establishes 15-minute JWT and HttpOnly cookies', async () => {
      userEmails.push(email('student'));
      const result = await request('/auth/register', { method: 'POST', body: JSON.stringify({ email: email('student'), password, fullName: 'Student' }) });
      assert.equal(result.status, 201);
      const decoded = jwt.verify(result.body.data.token, process.env.JWT_SECRET, { audience: 'aita-web', issuer: 'aita' });
      assert.equal(decoded.exp - decoded.iat, 900);
      assert.ok(result.cookies.every(cookie => cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict')));
      student = await prisma.user.findUniqueOrThrow({ where: { email: email('student') } });
    });
    await t.test('login rejects incorrect password', async () => {
      const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: student.email, password: 'incorrect' }) });
      assert.equal(result.status, 401);
    });
    await t.test('cookie authentication and me endpoint work', async () => {
      const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: student.email, password }) });
      assert.equal(result.status, 200);
      const cookie = result.cookies.map(value => value.split(';')[0]).join('; ');
      const me = await request('/auth/me', { headers: { Cookie: cookie } });
      assert.equal(me.status, 200); assert.equal(me.body.data.id, student.id);
      const accessOnly = result.cookies.find(value => value.startsWith('aita_access=')).split(';')[0];
      const refreshed = await request('/auth/refresh', { method: 'POST', headers: { Cookie: cookie } });
      assert.equal(refreshed.status, 200);
      const replay = await request('/auth/refresh', { method: 'POST', headers: { Cookie: cookie } });
      assert.equal(replay.status, 401);
      const newCookie = refreshed.cookies.map(value => value.split(';')[0]).join('; ');
      assert.equal((await request('/auth/logout', { method: 'POST', headers: { Cookie: newCookie } })).status, 200);
      assert.equal((await request('/auth/me', { headers: { Cookie: accessOnly } })).status, 401);
    });
    await t.test('refresh tokens stored as hashes, rotated and replay rejected', async () => {
      session = await authService.login(student.email, password);
      const row = await prisma.authSession.findUniqueOrThrow({ where: { refreshTokenHash: hashToken(session.refreshToken) } });
      assert.notEqual(row.refreshTokenHash, session.refreshToken);
      const changed = await authService.refresh(session.refreshToken);
      assert.notEqual(changed.refreshToken, session.refreshToken);
      await assert.rejects(authService.refresh(session.refreshToken), { status: 401 });
      session = changed;
    });
    await t.test('concurrent refresh allows exactly one rotation', async () => {
      const result = await Promise.allSettled([authService.refresh(session.refreshToken), authService.refresh(session.refreshToken)]);
      assert.equal(result.filter(item => item.status === 'fulfilled').length, 1);
    });
    await t.test('expired access JWT is rejected', async () => {
      const current = await authService.login(student.email, password);
      const decoded = jwt.decode(current.token);
      const expired = jwt.sign({ sid: decoded.sid, userId: student.id, role: student.role }, process.env.JWT_SECRET, { issuer: 'aita', audience: 'aita-web', expiresIn: -1 });
      await assert.rejects(authService.authenticate(expired), { status: 401 });
    });
    await t.test('role changes and disabled accounts invalidate access', async () => {
      const current = await authService.login(student.email, password);
      await prisma.user.update({ where: { id: student.id }, data: { role: 'LECTURER' } });
      await assert.rejects(authService.authenticate(current.token), { status: 401 });
      await prisma.user.update({ where: { id: student.id }, data: { role: 'STUDENT', isActive: false } });
      await assert.rejects(authService.refresh(current.refreshToken), { status: 401 });
      await prisma.user.update({ where: { id: student.id }, data: { isActive: true } });
    });
    await t.test('cross-origin and missing CSRF header are rejected', async () => {
      const badOrigin = await request('/auth/login', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: JSON.stringify({ email: student.email, password }) });
      assert.equal(badOrigin.status, 403);
      const noHeader = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: student.email, password }) });
      assert.equal(noHeader.status, 403);
    });
    await t.test('Google is explicitly disabled without client ID', async () => {
      assert.equal((await request('/auth/google/config')).body.data.clientId, null);
      assert.equal((await request('/auth/google', { method: 'POST', body: JSON.stringify({ credential: 'invalid' }) })).status, 503);
    });
    await t.test('Google rejects forged ID token even with configured client ID', async () => {
      process.env.GOOGLE_CLIENT_ID = 'integration.apps.googleusercontent.com';
      try {
        const config = await request('/auth/google/config');
        assert.ok(config.body.data.nonce);
        const result = await request('/auth/google', { method: 'POST', headers: { Cookie: config.cookies.map(cookie => cookie.split(';')[0]).join('; ') }, body: JSON.stringify({ credential: 'forged.invalid.token' }) });
        assert.equal(result.status, 401);
      } finally { process.env.GOOGLE_CLIENT_ID = ''; }
    });
    userEmails.push(email('lecturer'), email('outsider'));
    await authService.register(email('lecturer'), password, 'Lecturer');
    await authService.register(email('outsider'), password, 'Other Lecturer');
    lecturer = await prisma.user.update({ where: { email: email('lecturer') }, data: { role: 'LECTURER' } });
    outsider = await prisma.user.update({ where: { email: email('outsider') }, data: { role: 'LECTURER' } });
    const actor = { userId: lecturer.id, role: 'LECTURER' };
    cls = await prisma.class.create({ data: { classCode: 'TEST-' + suffix, name: 'Test', semester: 'FA26', lecturerId: lecturer.id } }); createdClasses.push(cls.id);
    const lecturerSession = await authService.login(lecturer.email, password);
    const headers = { Authorization: 'Bearer ' + lecturerSession.token };
    const rosterEmails = [email('import1'), email('import2')]; userEmails.push(...rosterEmails);
    const file = await workbook([[rosterEmails[0], 'First'], [rosterEmails[1], 'Second']]);
    let preview;
    await t.test('preview is read-only and returns signed mapping receipt', async () => {
      const data = new FormData(); data.append('file', new Blob([file]), 'students.xlsx');
      const result = await request('/classes/' + cls.id + '/students/import/preview', { method: 'POST', headers, body: data });
      assert.equal(result.status, 200); assert.equal(result.body.data.rows.length, 2);
      assert.ok(result.body.data.previewToken);
      assert.equal(await prisma.user.count({ where: { email: { in: rosterEmails } } }), 0);
      preview = result.body.data;
    });
    await t.test('student and another lecturer cannot import into class', async () => {
      for (const identity of [student, outsider]) {
        const login = await authService.login(identity.email, password);
        const data = new FormData(); data.append('file', new Blob([file]), 'students.xlsx');
        assert.equal((await request('/classes/' + cls.id + '/students/import/preview', { method: 'POST', headers: { Authorization: 'Bearer ' + login.token }, body: data })).status, 403);
      }
    });
    await t.test('commit rejects missing preview or changed file', async () => {
      await assert.rejects(rosterImportService.commit(cls.id, actor, file, preview.mapping, null), { status: 409 });
      const altered = await workbook([[email('changed'), 'Changed']]);
      await assert.rejects(rosterImportService.commit(cls.id, actor, altered, preview.mapping, preview.previewToken), { status: 409 });
    });
    await t.test('commit imports both users/enrollments and rerun skips duplicates', async () => {
      const data = new FormData(); data.append('file', new Blob([file]), 'students.xlsx'); data.append('mapping', JSON.stringify(preview.mapping)); data.append('previewToken', preview.previewToken);
      const result = await request('/classes/' + cls.id + '/students/import', { method: 'POST', headers, body: data });
      assert.equal(result.status, 200); assert.equal(result.body.data.added, 2); assert.equal(result.body.data.createdUsers, 2);
      const repeated = await rosterImportService.commit(cls.id, actor, file, preview.mapping, preview.previewToken);
      assert.equal(repeated.added, 0); assert.equal(repeated.skipped, 2);
    });
    await t.test('role conflict after first row rolls back users and enrollments', async () => {
      const newEmail = email('rollback-role'); userEmails.push(newEmail);
      const bytes = await workbook([[newEmail, 'New'], [lecturer.email, 'Conflicting lecturer']]);
      const data = await rosterImportService.preview(cls.id, actor, bytes);
      await assert.rejects(rosterImportService.commit(cls.id, actor, bytes, data.mapping, data.previewToken), { status: 422 });
      assert.equal(await prisma.user.count({ where: { email: newEmail } }), 0);
    });
    await t.test('database error after a successful first insert rolls back entire batch', async () => {
      const first = email('rollback-db'); const fail = email('trigger-fail'); userEmails.push(first, fail);
      await prisma.$executeRawUnsafe("CREATE FUNCTION aita_test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.email LIKE 'trigger-fail-%' THEN RAISE EXCEPTION 'test database failure'; END IF; RETURN NEW; END $$");
      await prisma.$executeRawUnsafe('CREATE TRIGGER aita_test_failure BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION aita_test_fail_insert()');
      try {
        const bytes = await workbook([[first, 'First'], [fail, 'Failure']]);
        const data = await rosterImportService.preview(cls.id, actor, bytes);
        await assert.rejects(rosterImportService.commit(cls.id, actor, bytes, data.mapping, data.previewToken));
        assert.equal(await prisma.user.count({ where: { email: { in: [first, fail] } } }), 0);
      } finally {
        await prisma.$executeRawUnsafe('DROP TRIGGER aita_test_failure ON users');
        await prisma.$executeRawUnsafe('DROP FUNCTION aita_test_fail_insert()');
      }
    });
    await t.test('invalid row produces errors and no partial import', async () => {
      const bytes = await workbook([[email('valid-but-no-write'), 'A'], ['invalid', 'B']]);
      const data = await rosterImportService.preview(cls.id, actor, bytes);
      assert.equal(data.previewToken, null); assert.equal(data.errors[0].row, 3);
      await assert.rejects(rosterImportService.commit(cls.id, actor, bytes, data.mapping, data.previewToken), { status: 422 });
    });
    await t.test('multipart upload rejects wrong file extension', async () => {
      const data = new FormData(); data.append('file', new Blob([file]), 'students.csv');
      assert.equal((await request('/classes/' + cls.id + '/students/import/preview', { method: 'POST', headers, body: data })).status, 400);
    });
    const exam = await prisma.exam.create({ data: { classId: cls.id, title: 'Queue test', descriptionMd: 'Test', allowedLanguage: 'JAVA', startTime: new Date(Date.now() - 60000), endTime: new Date(Date.now() + 600000), testCases: { create: [{ inputData: '1 2', expectedOutput: '3', orderIndex: 1, scoreWeight: 10 }] } } });
    await prisma.classEnrollment.create({ data: { classId: cls.id, studentId: student.id } });
    let submission;
    const producer = new BullMqJobQueue(); queues.push(producer);
    const consumer = new BullMqJobQueue(); queues.push(consumer);
    await t.test('submission is persisted and queued without a running worker', async () => {
      submission = await new SubmissionService(undefined, undefined, producer).submitCode(exam.id, student.id, 'print(3)');
      assert.equal(submission.status, 'QUEUED');
      const queue = new Queue('grading-queue', { connection: { host: '127.0.0.1', port: 6379 }, prefix: process.env.QUEUE_PREFIX }); queues.push(queue);
      assert.equal(await (await queue.getJob(submission.id)).getState(), 'waiting');
    });
    await t.test('worker consumes existing Redis job and persists grading results', async () => {
      new AutogradingWorker(consumer, new AutogradingService(undefined, undefined, new MockSandboxService(), producer)).init();
      const completed = await waitFor(async () => { const row = await prisma.submission.findUnique({ where: { id: submission.id }, include: { testResults: true } }); return row.status === 'COMPLETED' ? row : null; });
      assert.equal(completed.testResults.length, 1); assert.equal(completed.totalScore, 10);
    });
    await t.test('completed job duplicate cannot duplicate testcase results', async () => {
      await producer.addJob('grading-queue', { submissionId: submission.id });
      const { autogradingService } = require('../dist/modules/submissions/autograding.service');
      await autogradingService.executeSubmission(submission.id);
      assert.equal(await prisma.submissionTestResult.count({ where: { submissionId: submission.id } }), 1);
    });
    await t.test('retry processes a transient worker error', async () => {
      let attempts = 0;
      consumer.registerHandler('retry-test', async () => { attempts++; if (attempts === 1) throw new Error('Transient test error'); });
      await producer.addJob('retry-test', { submissionId: 'retry-' + suffix });
      await waitFor(() => attempts >= 2);
      assert.equal(attempts, 2);
    });
    await t.test('jobs survive producer disconnect and worker restart', async () => {
      const temporaryProducer = new BullMqJobQueue();
      await temporaryProducer.addJob('restart-test', { submissionId: 'persist-' + suffix });
      await temporaryProducer.close();
      let consumed = 0;
      const firstWorker = new BullMqJobQueue();
      firstWorker.registerHandler('restart-test', async () => { consumed++; });
      await waitFor(() => consumed === 1);
      await firstWorker.close();
      await producer.addJob('restart-test', { submissionId: 'after-restart-' + suffix });
      const restarted = new BullMqJobQueue(); queues.push(restarted);
      restarted.registerHandler('restart-test', async () => { consumed++; });
      await waitFor(() => consumed === 2);
      assert.equal(consumed, 2);
    });
    await t.test('database receipt survives enqueue failure and recovery picks it up', async () => {
      const unavailable = { addJob: async () => { throw new Error('Test Redis outage'); }, registerHandler() {} };
      const pending = await new SubmissionService(undefined, undefined, unavailable).submitCode(exam.id, student.id, 'print(3) # second');
      assert.equal(pending.queuePending, true);
      assert.equal((await prisma.submission.findUnique({ where: { id: pending.id } })).status, 'QUEUED');
      await recoverQueuedSubmissions(producer);
      await waitFor(async () => (await prisma.submission.findUnique({ where: { id: pending.id } })).status === 'COMPLETED');
    });
    await t.test('non-enrolled student cannot submit', async () => {
      const otherClass = await prisma.class.create({ data: { classCode: 'OTHER-' + suffix, name: 'Other', semester: 'FA26', lecturerId: lecturer.id } }); createdClasses.push(otherClass.id);
      const otherExam = await prisma.exam.create({ data: { classId: otherClass.id, title: 'Other', descriptionMd: 'Other', allowedLanguage: 'JAVA', startTime: new Date(Date.now() - 1000), endTime: new Date(Date.now() + 60000) } });
      await assert.rejects(new SubmissionService(undefined, undefined, producer).submitCode(otherExam.id, student.id, 'test'), { status: 403 });
    });
  } finally {
    await Promise.all(queues.map(queue => queue.close()));
    await defaultJobQueue.close();
    await new Promise(resolve => server.close(resolve));
    await prisma.submission.deleteMany({ where: { exam: { classId: { in: createdClasses } } } });
    await prisma.class.deleteMany({ where: { id: { in: createdClasses } } });
    await prisma.user.deleteMany({ where: { email: { in: userEmails } } });
    await prisma.$disconnect();
  }
});
