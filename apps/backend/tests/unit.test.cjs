const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
process.env.JWT_SECRET = 'test-secret-for-unit-tests-at-least-32-characters';
process.env.ALLOWED_EMAIL_DOMAINS = 'fpt.edu.vn,fe.edu.vn';
const { institutionalEmail, validateGoogleIdentity, authorizeGoogleLink } = require('../dist/modules/auth/auth.service');
const bcrypt = require('bcryptjs');
const { readRoster } = require('../dist/modules/classes/roster-import.service');
const { prisma } = require('../dist/infrastructure/database/prisma');
after(() => prisma.$disconnect());
async function excel(headers, rows) {
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Students');
  sheet.addRow(headers); rows.forEach(row => sheet.addRow(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}
test('email normalization accepts configured domains', () => assert.equal(institutionalEmail(' Student@FPT.EDU.VN '), 'student@fpt.edu.vn'));
test('rejects domain suffix spoofing', () => assert.throws(() => institutionalEmail('a@fpt.edu.vn.evil.com'), { status: 403 }));
test('rejects malformed email', () => assert.throws(() => institutionalEmail('invalid'), { status: 400 }));
const google = { sub: 'subject-1', email: 'a@fpt.edu.vn', email_verified: true, hd: 'fpt.edu.vn', name: 'A', nonce: 'challenge' };
test('accepts verified Google Workspace identity and matching nonce', () => assert.equal(validateGoogleIdentity(google, 'challenge').subject, 'subject-1'));
test('rejects Google identity without hosted domain', () => assert.throws(() => validateGoogleIdentity({ ...google, hd: undefined }, 'challenge'), { status: 403 }));
test('rejects unverified Google email', () => assert.throws(() => validateGoogleIdentity({ ...google, email_verified: false }, 'challenge'), { status: 401 }));
test('rejects mismatched Google nonce', () => assert.throws(() => validateGoogleIdentity(google, 'other'), { status: 401 }));
test('verified personal Gmail works without Workspace hd when explicitly allowed', () => {
  const previous = process.env.ALLOWED_EMAIL_DOMAINS;
  process.env.ALLOWED_EMAIL_DOMAINS = 'fpt.edu.vn,fe.edu.vn,gmail.com';
  try {
    const identity = validateGoogleIdentity({ ...google, email: 'Student@gmail.com', hd: undefined }, 'challenge');
    assert.equal(identity.email, 'student@gmail.com');
    assert.throws(() => validateGoogleIdentity({ ...google, email: 'a@gmail.com', hd: undefined, email_verified: false }, 'challenge'), { status: 401 });
    assert.throws(() => validateGoogleIdentity({ ...google, email: 'a@gmail.com', hd: undefined }, 'other'), { status: 401 });
    assert.throws(() => institutionalEmail('a@gmail.com.evil.com'), { status: 403 });
  } finally { process.env.ALLOWED_EMAIL_DOMAINS = previous; }
});
test('Gmail is still rejected when omitted from the allowed domains', () => {
  assert.throws(() => validateGoogleIdentity({ ...google, email: 'a@gmail.com', hd: undefined }, 'challenge'), { status: 403 });
});
test('personal Gmail can be imported into an Excel roster', async () => {
  const previous = process.env.ALLOWED_EMAIL_DOMAINS;
  process.env.ALLOWED_EMAIL_DOMAINS = 'fpt.edu.vn,fe.edu.vn,gmail.com';
  try {
    const data = await readRoster(await excel(['Email', 'Họ tên'], [['student@gmail.com', 'Sinh viên K19']]));
    assert.equal(data.errors.length, 0); assert.equal(data.rows[0].email, 'student@gmail.com');
  } finally { process.env.ALLOWED_EMAIL_DOMAINS = previous; }
});
test('Google cannot auto-link a password account without password proof', async () => {
  const hash = await bcrypt.hash('correct-password', 10);
  await assert.rejects(authorizeGoogleLink(hash, undefined), { status: 409 });
  await assert.rejects(authorizeGoogleLink(hash, 'wrong-password'), { status: 409 });
  await authorizeGoogleLink(hash, 'correct-password');
});
test('imported SSO-only accounts need no shared default password', async () => { await authorizeGoogleLink(null, undefined); });
test('parses canonical headers and valid students', async () => {
  const data = await readRoster(await excel(['Email', 'Họ tên'], [['a@fpt.edu.vn', 'Sinh viên A']]));
  assert.deepEqual(data.mapping, { email: 1, fullName: 2 }); assert.equal(data.rows.length, 1); assert.equal(data.errors.length, 0);
});
test('custom column mapping supports reordered headers', async () => {
  const data = await readRoster(await excel(['Tên', 'Địa chỉ'], [['A', 'a@fe.edu.vn']]), { email: 2, fullName: 1 });
  assert.equal(data.rows[0].email, 'a@fe.edu.vn');
});
test('duplicate normalized emails produce row errors', async () => {
  const data = await readRoster(await excel(['Email', 'Họ tên'], [['a@fpt.edu.vn', 'A'], ['A@FPT.EDU.VN', 'B']]));
  assert.equal(data.errors[0].row, 3); assert.equal(data.rows.length, 1);
});
test('requires explicit mapping when headers are unknown', async () => {
  const data = await readRoster(await excel(['X', 'Y'], [['a@fpt.edu.vn', 'A']]));
  assert.equal(data.mapping, null); assert.equal(data.errors[0].row, 1);
});
test('rejects formula cells', async () => {
  const data = await readRoster(await excel(['Email', 'Họ tên'], [['a@fpt.edu.vn', { formula: '"A"', result: 'A' }]]));
  assert.equal(data.errors[0].row, 2);
});
test('rejects corrupt Excel archive', async () => await assert.rejects(readRoster(Buffer.from('not an xlsx')), { status: 400 }));
test('rejects files at the 10 MB boundary', async () => await assert.rejects(readRoster(Buffer.alloc(10 * 1024 * 1024)), { status: 413 }));
