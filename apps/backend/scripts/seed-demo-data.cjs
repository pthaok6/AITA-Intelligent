const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();
const PASSWORD = 'AitaTest@123';

// ─── Helpers ────────────────────────────────────────────────────────────────
function pastDate(hoursAgo) {
  return new Date(Date.now() - hoursAgo * 3600_000);
}
function futureDate(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3600_000);
}
function randomScore(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Data ────────────────────────────────────────────────────────────────────
const LECTURERS = [
  { email: 'lecturer.nguyen@fpt.edu.vn', fullName: 'GV. Nguyen Thi Bich Lien', role: 'LECTURER' },
  { email: 'lecturer.tran@fpt.edu.vn',   fullName: 'GV. Tran Van Hung',         role: 'LECTURER' },
];

const STUDENTS = [
  { email: 'sv.an@fpt.edu.vn',     fullName: 'Nguyen Van An' },
  { email: 'sv.binh@fpt.edu.vn',   fullName: 'Le Thi Binh' },
  { email: 'sv.cuong@fpt.edu.vn',  fullName: 'Tran Minh Cuong' },
  { email: 'sv.dao@fpt.edu.vn',    fullName: 'Pham Ngoc Dao' },
  { email: 'sv.em@fpt.edu.vn',     fullName: 'Hoang Van Em' },
  { email: 'sv.fong@fpt.edu.vn',   fullName: 'Vu Thanh Phong' },
  { email: 'sv.giang@fpt.edu.vn',  fullName: 'Dang Thi Giang' },
  { email: 'sv.hung@fpt.edu.vn',   fullName: 'Bui Quang Hung' },
  { email: 'sv.yen@fpt.edu.vn',    fullName: 'Phan Thi Yen' },
  { email: 'sv.khai@fpt.edu.vn',   fullName: 'Ly Van Khai' },
  { email: 'sv.lan@fpt.edu.vn',    fullName: 'Ngo Thi Lan' },
  { email: 'sv.minh@fpt.edu.vn',   fullName: 'Dinh Van Minh' },
  { email: 'sv.nam@fpt.edu.vn',    fullName: 'To Hoai Nam' },
  { email: 'sv.oanh@fpt.edu.vn',   fullName: 'Trinh Thi Oanh' },
  { email: 'sv.phuc@fpt.edu.vn',   fullName: 'Cao Van Phuc' },
  { email: 'sv.quynh@fpt.edu.vn',  fullName: 'Mai Thi Quynh' },
  { email: 'sv.rong@fpt.edu.vn',   fullName: 'Ha Van Rong' },
  { email: 'sv.son@fpt.edu.vn',    fullName: 'Chu Duc Son' },
  { email: 'sv.thu@fpt.edu.vn',    fullName: 'Le Thi Thu' },
  { email: 'sv.uyen@fpt.edu.vn',   fullName: 'Nguyen Thi Uyen' },
];

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Bat dau tao du lieu demo...\n');
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // 1. Users
  console.log('Tao tai khoan...');
  const lecturerUsers = [];
  for (const lec of LECTURERS) {
    const u = await db.user.upsert({
      where: { email: lec.email },
      create: { ...lec, passwordHash, isActive: true, isApproved: true },
      update: { passwordHash, isActive: true, isApproved: true, fullName: lec.fullName },
    });
    lecturerUsers.push(u);
  }

  const studentUsers = [];
  for (const stu of STUDENTS) {
    const u = await db.user.upsert({
      where: { email: stu.email },
      create: { ...stu, role: 'STUDENT', passwordHash, isActive: true, isApproved: true },
      update: { passwordHash, isActive: true, isApproved: true, fullName: stu.fullName },
    });
    studentUsers.push(u);
  }
  console.log('  OK: ' + lecturerUsers.length + ' giang vien, ' + studentUsers.length + ' sinh vien\n');

  // 2. Classes
  console.log('Tao lop hoc...');
  const classesConfig = [
    {
      classCode: 'PRF192-SE1901',
      name: 'Lap trinh co ban Python (PRF192) - SE1901',
      lecturerId: lecturerUsers[0].id,
      semester: 'FA26',
      studentIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    {
      classCode: 'PRO192-SE1902',
      name: 'Lap trinh huong doi tuong (PRO192) - SE1902',
      lecturerId: lecturerUsers[1].id,
      semester: 'FA26',
      studentIndices: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    },
    {
      classCode: 'DSA201-SE1903',
      name: 'Cau truc du lieu va Giai thuat (DSA201) - SE1903',
      lecturerId: lecturerUsers[0].id,
      semester: 'FA26',
      studentIndices: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    },
  ];

  const classes = [];
  for (const cd of classesConfig) {
    const cls = await db.class.upsert({
      where: { classCode: cd.classCode },
      create: { classCode: cd.classCode, name: cd.name, lecturerId: cd.lecturerId, semester: cd.semester },
      update: { name: cd.name, lecturerId: cd.lecturerId },
    });
    for (const idx of cd.studentIndices) {
      await db.classEnrollment.upsert({
        where: { classId_studentId: { classId: cls.id, studentId: studentUsers[idx].id } },
        create: { classId: cls.id, studentId: studentUsers[idx].id },
        update: {},
      });
    }
    classes.push({ ...cls, studentIndices: cd.studentIndices });
    console.log('  OK: ' + cd.classCode + ' - ' + cd.studentIndices.length + ' sinh vien');
  }
  console.log();

  // 3. Exams
  console.log('Tao bai thi...');
  const allExams = [];

  // PRF192 - Class 1: exams
  const prf = classes[0];
  const prf_students = prf.studentIndices.map(i => studentUsers[i]);

  const prf_exam1 = await upsertExam({
    classId: prf.id,
    title: '[PRF192] Lab 01 - Nhap xuat co ban',
    descriptionMd: '# Lab 01\n\nDoc 2 so nguyen a, b tu stdin, in ra a + b.\n\n**Input:** `3 5`\n**Output:** `8`',
    allowedLanguage: 'PYTHON', examType: 'INDIVIDUAL',
    timeLimitMs: 1000, memoryLimitMb: 256,
    startTime: pastDate(72), endTime: pastDate(24),
  });
  await upsertTestCases(prf_exam1.id, [
    { input: '3 5\n',   output: '8\n',    hidden: false, weight: 20 },
    { input: '0 0\n',   output: '0\n',    hidden: false, weight: 20 },
    { input: '-7 10\n', output: '3\n',    hidden: true,  weight: 20 },
    { input: '-100 -200\n', output: '-300\n', hidden: true, weight: 20 },
    { input: '1000000000 999999999\n', output: '1999999999\n', hidden: true, weight: 20 },
  ]);
  await createSubmissionsForClosedExam(prf_exam1, prf_students);
  allExams.push(prf_exam1);
  console.log('  OK: ' + prf_exam1.title);

  const prf_exam2 = await upsertExam({
    classId: prf.id,
    title: '[PRF192] Lab 02 - Vong lap va Dieu kien',
    descriptionMd: '# Lab 02\n\nTinh tong 1 + 2 + ... + n.\n\n**Input:** `5`\n**Output:** `15`',
    allowedLanguage: 'PYTHON', examType: 'INDIVIDUAL',
    timeLimitMs: 2000, memoryLimitMb: 256,
    startTime: pastDate(2), endTime: futureDate(48),
  });
  await upsertTestCases(prf_exam2.id, [
    { input: '5\n',       output: '15\n',         hidden: false, weight: 20 },
    { input: '1\n',       output: '1\n',           hidden: false, weight: 20 },
    { input: '100\n',     output: '5050\n',        hidden: true,  weight: 20 },
    { input: '1000\n',    output: '500500\n',      hidden: true,  weight: 20 },
    { input: '1000000\n', output: '500000500000\n',hidden: true,  weight: 20 },
  ]);
  await createSubmissionsForOpenExam(prf_exam2, prf_students);
  allExams.push(prf_exam2);
  console.log('  OK: ' + prf_exam2.title);

  const prf_exam3 = await upsertExam({
    classId: prf.id,
    title: '[PRF192] Giua ky - Kiem tra tong hop',
    descriptionMd: '# Kiem tra Giua ky\n\nSap dien ra. Chuan bi ky nao!',
    allowedLanguage: 'PYTHON', examType: 'INDIVIDUAL',
    timeLimitMs: 2000, memoryLimitMb: 512,
    startTime: futureDate(24), endTime: futureDate(25.5),
  });
  await upsertTestCases(prf_exam3.id, [
    { input: '10\n',  output: '55\n',   hidden: false, weight: 25 },
    { input: '20\n',  output: '210\n',  hidden: true,  weight: 25 },
    { input: '50\n',  output: '1275\n', hidden: true,  weight: 25 },
    { input: '100\n', output: '5050\n', hidden: true,  weight: 25 },
  ]);
  allExams.push(prf_exam3);
  console.log('  OK: ' + prf_exam3.title + ' (sap dien ra)');

  // PRO192 - Class 2: exams
  const pro = classes[1];
  const pro_students = pro.studentIndices.map(i => studentUsers[i]);

  const pro_exam1 = await upsertExam({
    classId: pro.id,
    title: '[PRO192] Lab 01 - Lop va Doi tuong co ban',
    descriptionMd: '# Lab 01\n\nDoc n cap so nguyen, in ra max(a, b) moi cap.\n\n**Input:**\n```\n3\n1 5\n10 2\n-3 -1\n```\n**Output:**\n```\n5\n10\n-1\n```',
    allowedLanguage: 'PYTHON', examType: 'INDIVIDUAL',
    timeLimitMs: 2000, memoryLimitMb: 256,
    startTime: pastDate(48), endTime: pastDate(6),
  });
  await upsertTestCases(pro_exam1.id, [
    { input: '3\n1 5\n10 2\n-3 -1\n',    output: '5\n10\n-1\n',  hidden: false, weight: 25 },
    { input: '1\n0 0\n',                  output: '0\n',           hidden: false, weight: 25 },
    { input: '2\n-5 -10\n100 99\n',       output: '-5\n100\n',     hidden: true,  weight: 25 },
    { input: '4\n1 1\n2 2\n3 3\n4 4\n',  output: '1\n2\n3\n4\n',  hidden: true,  weight: 25 },
  ]);
  await createSubmissionsForClosedExam(pro_exam1, pro_students);
  allExams.push(pro_exam1);
  console.log('  OK: ' + pro_exam1.title);

  const pro_exam2 = await upsertExam({
    classId: pro.id,
    title: '[PRO192] BTL Nhom - Quan ly danh sach sinh vien',
    descriptionMd: '# BTL Nhom\n\nXay dung module Python quan ly sinh vien: them, tinh trung binh, sap xep theo diem.',
    allowedLanguage: 'PYTHON', examType: 'GROUP',
    timeLimitMs: 3000, memoryLimitMb: 512, maxTeamSize: 3,
    startTime: pastDate(6), endTime: futureDate(14 * 24),
  });
  await upsertTestCases(pro_exam2.id, [
    { input: '3\nAn 8.5\nBinh 7.0\nCuong 9.2\nAVG\n', output: '8.23\n', hidden: false, weight: 30 },
    { input: '3\nAn 8.5\nBinh 7.0\nCuong 9.2\nSORT\n', output: 'Cuong 9.2\nAn 8.5\nBinh 7.0\n', hidden: false, weight: 30 },
    { input: '1\nDao 10.0\nAVG\n',   output: '10.00\n',           hidden: true,  weight: 20 },
    { input: '2\nEm 5.5\nFong 5.5\nSORT\n', output: 'Em 5.5\nFong 5.5\n', hidden: true, weight: 20 },
  ]);
  await createGroupSubmissions(pro_exam2, pro_students);
  allExams.push(pro_exam2);
  console.log('  OK: ' + pro_exam2.title + ' (Nhom)');

  // DSA201 - Class 3: exams
  const dsa = classes[2];
  const dsa_students = dsa.studentIndices.map(i => studentUsers[i]);

  const dsa_exam1 = await upsertExam({
    classId: dsa.id,
    title: '[DSA201] Lab 01 - Sap xep va Tim kiem',
    descriptionMd: '# Lab 01\n\nTim so lon thu k trong mang n phan tu.\n\n**Input:** `5 2\\n3 1 4 1 5`\n**Output:** `4`',
    allowedLanguage: 'PYTHON', examType: 'INDIVIDUAL',
    timeLimitMs: 2000, memoryLimitMb: 256,
    startTime: pastDate(36), endTime: pastDate(12),
  });
  await upsertTestCases(dsa_exam1.id, [
    { input: '5 2\n3 1 4 1 5\n', output: '4\n',  hidden: false, weight: 25 },
    { input: '1 1\n42\n',        output: '42\n', hidden: false, weight: 25 },
    { input: '7 3\n9 8 7 6 5 4 3\n', output: '7\n', hidden: true, weight: 25 },
    { input: '4 4\n10 20 30 40\n',   output: '10\n', hidden: true, weight: 25 },
  ]);
  await createSubmissionsForClosedExam(dsa_exam1, dsa_students);
  allExams.push(dsa_exam1);
  console.log('  OK: ' + dsa_exam1.title);

  const dsa_exam2 = await upsertExam({
    classId: dsa.id,
    title: '[DSA201] Lab 02 - Stack va Queue',
    descriptionMd: '# Lab 02\n\nKiem tra chuoi co dau ngoac hop le khong.\n\n**Input:** `()[]{}`\n**Output:** `YES`',
    allowedLanguage: 'PYTHON', examType: 'INDIVIDUAL',
    timeLimitMs: 1000, memoryLimitMb: 256,
    startTime: pastDate(1), endTime: futureDate(23),
  });
  await upsertTestCases(dsa_exam2.id, [
    { input: '()[]{}\n', output: 'YES\n', hidden: false, weight: 25 },
    { input: '([)]\n',   output: 'NO\n',  hidden: false, weight: 25 },
    { input: '{[]}\n',   output: 'YES\n', hidden: true,  weight: 25 },
    { input: '(((\n',    output: 'NO\n',  hidden: true,  weight: 25 },
  ]);
  await createSubmissionsForOpenExam(dsa_exam2, dsa_students);
  allExams.push(dsa_exam2);
  console.log('  OK: ' + dsa_exam2.title);

  console.log('\nHoan thanh tao du lieu demo!');
  console.log('Tom tat:');
  console.log('  - Giang vien: ' + lecturerUsers.length);
  console.log('  - Sinh vien:  ' + studentUsers.length);
  console.log('  - Lop hoc:    ' + classes.length);
  console.log('  - Bai thi:    ' + allExams.length);
  console.log('\nMat khau: AitaTest@123');
  console.log('Giang vien: lecturer.nguyen@fpt.edu.vn | lecturer.tran@fpt.edu.vn');
  console.log('Sinh vien:  sv.an@fpt.edu.vn ... sv.uyen@fpt.edu.vn');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function upsertExam(data) {
  const existing = await db.exam.findFirst({ where: { classId: data.classId, title: data.title } });
  if (existing) return db.exam.update({ where: { id: existing.id }, data });
  return db.exam.create({ data });
}

async function upsertTestCases(examId, cases) {
  for (const [i, tc] of cases.entries()) {
    await db.testCase.upsert({
      where: { examId_orderIndex: { examId, orderIndex: i + 1 } },
      create: { examId, orderIndex: i + 1, inputData: tc.input, expectedOutput: tc.output, isHidden: tc.hidden, scoreWeight: tc.weight },
      update: { inputData: tc.input, expectedOutput: tc.output, isHidden: tc.hidden, scoreWeight: tc.weight },
    });
  }
}

async function createSubmissionsForClosedExam(exam, students) {
  const testCases = await db.testCase.findMany({ where: { examId: exam.id }, orderBy: { orderIndex: 'asc' } });
  const scenarios = [
    { score: 100, status: 'COMPLETED',    verdict: 'ACCEPTED',            attempts: 1 },
    { score: 100, status: 'COMPLETED',    verdict: 'ACCEPTED',            attempts: 2 },
    { score: 80,  status: 'COMPLETED',    verdict: 'WRONG_ANSWER',        attempts: 1 },
    { score: 60,  status: 'COMPLETED',    verdict: 'WRONG_ANSWER',        attempts: 1 },
    { score: 100, status: 'COMPLETED',    verdict: 'ACCEPTED',            attempts: 1 },
    { score: 40,  status: 'COMPLETED',    verdict: 'WRONG_ANSWER',        attempts: 3 },
    { score: 0,   status: 'COMPILE_ERROR',verdict: 'WRONG_ANSWER',        attempts: 1 },
    { score: 80,  status: 'COMPLETED',    verdict: 'ACCEPTED',            attempts: 1 },
    { score: 100, status: 'COMPLETED',    verdict: 'ACCEPTED',            attempts: 2 },
    { score: 20,  status: 'COMPLETED',    verdict: 'TIME_LIMIT_EXCEEDED', attempts: 1 },
  ];

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const sc = scenarios[i % scenarios.length];

    for (let attempt = 1; attempt <= sc.attempts; attempt++) {
      const isFinal = attempt === sc.attempts;
      const subScore = isFinal ? sc.score : Math.max(0, sc.score - 20);
      const subStatus = isFinal ? sc.status : 'COMPLETED';

      const existing = await db.submission.findUnique({
        where: { examId_studentId_attemptNumber: { examId: exam.id, studentId: student.id, attemptNumber: attempt } },
      });
      if (existing) continue;

      const hash = ('demo_hash_' + student.id + attempt + exam.id).substring(0, 64).padEnd(64, '0');
      const sub = await db.submission.create({
        data: {
          examId: exam.id, studentId: student.id, attemptNumber: attempt,
          sourceCodeUrl: 'demo/submissions/' + exam.id + '/' + student.id + '_attempt' + attempt + '.zip',
          fileHashSha256: hash, artifactType: 'ZIP',
          originalFilename: 'solution.py', entrypoint: 'solution.py',
          status: subStatus, isLate: false, totalScore: subScore,
          submittedAt: new Date(exam.startTime.getTime() + attempt * 1800_000 + i * 300_000),
          completedAt: new Date(exam.startTime.getTime() + attempt * 1800_000 + i * 300_000 + 30_000),
          astStatus: 'COMPLETED',
          astMessage: 'Demo data - no real archive.',
          astCompletedAt: new Date(exam.startTime.getTime() + attempt * 1800_000 + i * 300_000 + 30_000),
        },
      });

      if (subStatus !== 'COMPILE_ERROR') {
        for (const [tcIdx, tc] of testCases.entries()) {
          const passes = tcIdx < (subScore / 100) * testCases.length;
          await db.submissionTestResult.upsert({
            where: { submissionId_testCaseId: { submissionId: sub.id, testCaseId: tc.id } },
            create: {
              submissionId: sub.id, testCaseId: tc.id,
              status: passes ? 'ACCEPTED' : sc.verdict,
              actualOutput: passes ? tc.expectedOutput : 'Wrong output\n',
              executionTimeMs: Math.floor(Math.random() * 500) + 50,
              memoryUsedKb: Math.floor(Math.random() * 10000) + 1000,
              scoreEarned: passes ? tc.scoreWeight : 0,
            },
            update: {},
          });
        }
      }

      if (isFinal && Math.random() > 0.3) {
        const existingReview = await db.aIReview.findUnique({
          where: { submissionId_reviewRound: { submissionId: sub.id, reviewRound: 1 } },
        });
        if (!existingReview) {
          await db.aIReview.create({
            data: {
              submissionId: sub.id, reviewRound: 1,
              cleanCodeScore: randomScore(5, 10),
              solidAnalysis: makeSolidAnalysis(subScore),
              errorExplanation: subScore < 100 ? makeErrorExplanation() : null,
              suggestions: makeSuggestions(),
              tokensUsed: Math.floor(Math.random() * 1500) + 500,
              modelName: 'gemini-1.5-flash',
            },
          });
        }
      }

      if (isFinal && subScore < 70 && subScore > 0 && Math.random() > 0.5) {
        const existingAppeal = await db.appeal.findFirst({ where: { submissionId: sub.id, studentId: student.id } });
        if (!existingAppeal) {
          await db.appeal.create({
            data: {
              submissionId: sub.id, studentId: student.id, examId: exam.id,
              round: 1, targetRole: 'LECTURER', title: 'Khieu nai ket qua cham bai',
              reason: pickRandom([
                'Toi tin rang bai lam cua minh dung nhung he thong cham sai.',
                'Output co them ky tu newline o cuoi nhung thuc te dung.',
                'Toi co giai phap khac nhung cho ket qua dung.',
                'He thong bao TLE nhung toi test thay chay rat nhanh.',
              ]),
              expectedScore: Math.min(100, subScore + 20),
              previousScore: subScore, originalScore: subScore,
              status: pickRandom(['SUBMITTED', 'IN_REVIEW', 'REJECTED', 'ACCEPTED']),
            },
          });
        }
      }
    }
  }
  console.log('    -> Da tao bai nop cho ' + students.length + ' sinh vien (bai thi da ket thuc)');
}

async function createSubmissionsForOpenExam(exam, students) {
  const testCases = await db.testCase.findMany({ where: { examId: exam.id }, orderBy: { orderIndex: 'asc' } });
  const submitted = students.filter((_, i) => i % 5 !== 0);

  for (const student of submitted) {
    const existing = await db.submission.findUnique({
      where: { examId_studentId_attemptNumber: { examId: exam.id, studentId: student.id, attemptNumber: 1 } },
    });
    if (existing) continue;

    const score = pickRandom([100, 100, 80, 60, 40]);
    const status = 'COMPLETED';
    const hash = ('open_hash_' + student.id + exam.id).substring(0, 64).padEnd(64, '0');
    const sub = await db.submission.create({
      data: {
        examId: exam.id, studentId: student.id, attemptNumber: 1,
        sourceCodeUrl: 'demo/submissions/' + exam.id + '/' + student.id + '.zip',
        fileHashSha256: hash, artifactType: 'ZIP',
        originalFilename: 'solution.py', entrypoint: 'solution.py',
        status, totalScore: score,
        submittedAt: pastDate(Math.random() * 2),
        completedAt: new Date(Date.now() - Math.random() * 7200_000 + 30_000),
        astStatus: 'COMPLETED',
        astMessage: 'Demo data - no real archive.',
        astCompletedAt: new Date(),
      },
    });

    for (const [tcIdx, tc] of testCases.entries()) {
      const passes = tcIdx < (score / 100) * testCases.length;
      await db.submissionTestResult.upsert({
        where: { submissionId_testCaseId: { submissionId: sub.id, testCaseId: tc.id } },
        create: {
          submissionId: sub.id, testCaseId: tc.id,
          status: passes ? 'ACCEPTED' : 'WRONG_ANSWER',
          actualOutput: passes ? tc.expectedOutput : 'Wrong output\n',
          executionTimeMs: Math.floor(Math.random() * 300) + 50,
          memoryUsedKb: Math.floor(Math.random() * 8000) + 1000,
          scoreEarned: passes ? tc.scoreWeight : 0,
        },
        update: {},
      });
    }
  }
  console.log('    -> Da tao bai nop cho ' + submitted.length + '/' + students.length + ' sinh vien (dang mo)');
}

async function createGroupSubmissions(exam, students) {
  if (students.length < 6) return;

  const teamConfigs = [
    {
      name: 'Nhom Alpha - Code Warriors',
      repoUrl: 'https://github.com/fpt-demo/pro192-group-alpha',
      memberIndices: [0, 1, 2], contributions: [45, 40, 15],
    },
    {
      name: 'Nhom Beta - Bug Hunters',
      repoUrl: 'https://github.com/fpt-demo/pro192-group-beta',
      memberIndices: [3, 4, 5], contributions: [60, 35, 5],
    },
  ];

  for (const config of teamConfigs) {
    let team = await db.team.findFirst({ where: { examId: exam.id, name: config.name } });
    if (!team) {
      team = await db.team.create({ data: { examId: exam.id, name: config.name, repoUrl: config.repoUrl } });
    }

    await db.teamMember.deleteMany({ where: { teamId: team.id } });
    const teamMembers = [];
    for (const [j, memberIdx] of config.memberIndices.entries()) {
      const student = students[memberIdx];
      const ghUsername = student.email.split('@')[0].replace('.', '-');
      const member = await db.teamMember.create({
        data: { teamId: team.id, studentId: student.id, role: j === 0 ? 'LEADER' : 'MEMBER', githubUsername: ghUsername },
      });
      teamMembers.push(member);
    }

    const totalCommits = Math.floor(Math.random() * 50) + 30;
    for (const [j, member] of teamMembers.entries()) {
      const pct = config.contributions[j];
      const commits = Math.round(totalCommits * pct / 100);
      await db.gitContribution.upsert({
        where: { teamId_memberId: { teamId: team.id, memberId: member.id } },
        create: {
          teamId: team.id, memberId: member.id,
          commitsCount: commits, locAdded: commits * 15, locDeleted: Math.floor(commits * 2),
          contributionPercent: pct, personalScore: pct < 10 ? null : 7.5 + (pct / 100) * 2,
          isWarning: pct < 10, syncStatus: 'SUCCESS',
        },
        update: {},
      });
    }

    const leader = students[config.memberIndices[0]];
    const testCases = await db.testCase.findMany({ where: { examId: exam.id }, orderBy: { orderIndex: 'asc' } });
    const existingSub = await db.submission.findUnique({
      where: { examId_studentId_attemptNumber: { examId: exam.id, studentId: leader.id, attemptNumber: 1 } },
    });
    if (!existingSub) {
      const score = config.name.includes('Alpha') ? 100 : 75;
      const hash = ('group_hash_' + team.id).substring(0, 64).padEnd(64, '0');
      const sub = await db.submission.create({
        data: {
          examId: exam.id, studentId: leader.id, teamId: team.id, attemptNumber: 1,
          sourceCodeUrl: 'demo/submissions/' + exam.id + '/team-' + team.id + '.zip',
          fileHashSha256: hash, artifactType: 'ZIP',
          originalFilename: 'solution.py', entrypoint: 'solution.py',
          status: 'COMPLETED', totalScore: score,
          submittedAt: pastDate(3), completedAt: pastDate(2.9),
          astStatus: 'COMPLETED',
          astMessage: 'Demo data - no real archive.',
          astCompletedAt: pastDate(2.9),
        },
      });
      for (const [tcIdx, tc] of testCases.entries()) {
        const passes = tcIdx < (score / 100) * testCases.length;
        await db.submissionTestResult.upsert({
          where: { submissionId_testCaseId: { submissionId: sub.id, testCaseId: tc.id } },
          create: {
            submissionId: sub.id, testCaseId: tc.id,
            status: passes ? 'ACCEPTED' : 'WRONG_ANSWER',
            actualOutput: passes ? tc.expectedOutput : 'Incorrect\n',
            executionTimeMs: 120, memoryUsedKb: 5000,
            scoreEarned: passes ? tc.scoreWeight : 0,
          },
          update: {},
        });
      }
    }
    console.log('    -> Nhom: ' + config.name + ' (' + teamMembers.length + ' thanh vien)');
  }
}

function makeSolidAnalysis(score) {
  if (score >= 90) return '## Phan tich SOLID\n\n**Single Responsibility:** Code co cau truc ro rang, moi ham thuc hien mot nhiem vu.\n**Open/Closed:** Thiet ke cho phep mo rong tot.\n**Liskov:** Khong ap dung.\n**Interface Segregation:** Khong ap dung.\n**Dependency Inversion:** Chua su dung, co the cai thien o du an lon hon.';
  if (score >= 60) return '## Phan tich SOLID\n\n**Single Responsibility:** Mot so ham dam nhan nhieu nhiem vu, can tach nho hon.\n**Open/Closed:** Co the cai thien bang cach dung ham truu tuong.';
  return '## Phan tich SOLID\n\n**Single Responsibility:** Kho danh gia do code chua hoan chinh.\n**Goi y:** Tap trung vao tinh dung dan truoc, sau do moi toi uu cau truc.';
}

function makeErrorExplanation() {
  return pickRandom([
    'Chuong trinh thoat voi output sai o cac test case co gia tri am. Can kiem tra lai dieu kien xu ly so am.',
    'Loi TLE co the do thuat toan O(n^2). Hay thu dung thuat toan sap xep O(n log n).',
    'Output co them dau cach hoac dong trong khong can thiet.',
    'Chuong trinh crash khi input rong. Can them kiem tra edge case.',
  ]);
}

function makeSuggestions() {
  return pickRandom([
    '## Goi y cai thien\n\n1. **Dat ten bien ro nghia**: Thay a, b bang first_number, second_number.\n2. **Them docstring**: Giai thich muc dich ham.\n3. **Kiem tra edge case**: Xu ly input rong va gia tri bien.\n4. **Type hints**: Dung annotation de code de doc hon.',
    '## Goi y cai thien\n\n1. **Modular hoa**: Tach logic chinh ra ham rieng biet.\n2. **Xu ly ngoai le**: Bao input() trong try/except ValueError.\n3. **Tranh magic numbers**: Dat hang so co ten.\n4. **Test thu cong**: Luon test voi gia tri bien truoc khi nop.',
    '## Goi y cai thien\n\n1. **Don gian hoa**: Code co the viet gon hon voi list comprehension.\n2. **Hieu suat**: Dung sys.stdin thay input() khi nhieu dong.\n3. **Nhat quan**: Dam bao format output nhat quan.\n4. **Comment**: Them giai thich ngan cho cac doan code phuc tap.',
  ]);
}

// ─── Entry ───────────────────────────────────────────────────────────────────
main()
  .catch(err => {
    console.error('\nLoi khi tao du lieu:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
