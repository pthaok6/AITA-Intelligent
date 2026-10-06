const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const assert = require('node:assert/strict');

const db = new PrismaClient();
const password = 'AitaTest@123';
const accounts = [
  { email: 'admin.test@fpt.edu.vn', fullName: 'Quản trị viên Test', role: 'ADMIN' },
  { email: 'lecturer.test@fpt.edu.vn', fullName: 'Giảng viên Test', role: 'LECTURER' },
  { email: 'student.test@fpt.edu.vn', fullName: 'Nguyễn Văn Test', role: 'STUDENT' },
];
const classCode = 'AITA-TEST-001';
const examTitle = 'Bài kiểm tra Test - Tổng hai số nguyên';

async function main() {
  const domains = (process.env.ALLOWED_EMAIL_DOMAINS || 'fpt.edu.vn,fe.edu.vn,gmail.com')
    .split(',').map(value => value.trim().toLowerCase().replace(/^@/, ''));
  assert(domains.includes('fpt.edu.vn'), 'Miền fpt.edu.vn phải nằm trong ALLOWED_EMAIL_DOMAINS.');
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.$transaction(async tx => {
    // Refuse collisions with accounts/classes that are not these test fixtures.
    for (const account of accounts) {
      const existing = await tx.user.findUnique({ where: { email: account.email } });
      assert(!existing || (existing.role === account.role && existing.fullName === account.fullName),
        `Email đã được sử dụng bởi tài khoản khác: ${account.email}`);
    }
    const existingClass = await tx.class.findUnique({
      where: { classCode }, include: { lecturer: true, _count: { select: { enrollments: true } } },
    });
    assert(!existingClass || existingClass.lecturer.email === accounts[1].email,
      'Mã lớp đã được sử dụng bởi giảng viên khác.');
    assert(!existingClass || existingClass._count.enrollments === 0,
      'Lớp test đã có sinh viên. Dừng để bảo toàn danh sách hiện có.');
    const users = [];
    for (const account of accounts) {
      users.push(await tx.user.upsert({
        where: { email: account.email },
        create: { ...account, passwordHash, isActive: true },
        update: { passwordHash, isActive: true },
        select: { id: true, email: true, role: true },
      }));
    }
    const cls = await tx.class.upsert({
      where: { classCode }, update: {},
      create: { classCode, name: 'Lớp Test Import Sinh Viên', lecturerId: users[1].id, semester: 'TEST-2026' },
    });
    const now = new Date();
    const examData = {
      classId: cls.id, title: examTitle,
      descriptionMd: '# Tổng hai số nguyên\n\nĐọc hai số nguyên a, b từ stdin và in tổng a + b.\n\n- Giới hạn: -10^9 ≤ a, b ≤ 10^9.\n- Ngôn ngữ: Python.\n\n## Ví dụ\nInput: `2 3`\n\nOutput: `5`\n',
      allowedLanguage: 'PYTHON', timeLimitMs: 2000, memoryLimitMb: 512,
      startTime: new Date(now.getTime() - 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    };
    const existingExams = await tx.exam.findMany({ where: { classId: cls.id } });
    assert(existingExams.length <= 1 && existingExams.every(exam => exam.title === examTitle),
      'Lớp test có bài kiểm tra khác. Dừng để bảo toàn dữ liệu.');
    const exam = existingExams.length
      ? await tx.exam.update({ where: { id: existingExams[0].id }, data: examData })
      : await tx.exam.create({ data: examData });
    const cases = [
      { inputData: '2 3\n', expectedOutput: '5\n', isHidden: false },
      { inputData: '0 0\n', expectedOutput: '0\n', isHidden: false },
      { inputData: '-7 10\n', expectedOutput: '3\n', isHidden: true },
      { inputData: '-12 -8\n', expectedOutput: '-20\n', isHidden: true },
      { inputData: '1000000000 1000000000\n', expectedOutput: '2000000000\n', isHidden: true },
    ];
    for (const [index, testCase] of cases.entries()) {
      const data = { ...testCase, scoreWeight: 20 };
      await tx.testCase.upsert({
        where: { examId_orderIndex: { examId: exam.id, orderIndex: index + 1 } },
        create: { ...data, examId: exam.id, orderIndex: index + 1 }, update: data,
      });
    }
    return { users, classId: cls.id, classCode, examId: exam.id, startTime: exam.startTime, endTime: exam.endTime };
  }, { timeout: 30000 });
  for (const account of accounts) {
    const user = await db.user.findUniqueOrThrow({ where: { email: account.email } });
    assert(user.isActive && user.role === account.role && await bcrypt.compare(password, user.passwordHash));
  }
  const cls = await db.class.findUniqueOrThrow({
    where: { id: result.classId }, include: { exams: { include: { testCases: true } }, _count: { select: { enrollments: true } } },
  });
  assert.equal(cls._count.enrollments, 0);
  assert.equal(cls.exams.length, 1);
  assert.equal(cls.exams[0].testCases.length, 5);
  assert(cls.exams[0].startTime <= new Date() && cls.exams[0].endTime > new Date());
  console.log(JSON.stringify({ ...result, enrollmentCount: 0, testCaseCount: 5, verified: true }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
