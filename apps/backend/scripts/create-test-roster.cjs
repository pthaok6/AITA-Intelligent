const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
require('ts-node').register({ project: path.resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { readRoster, rosterImportService } = require('../src/modules/classes/roster-import.service');
const { prisma } = require('../src/infrastructure/database/prisma');

async function main() {
  const rows = [
    ['student.test@fpt.edu.vn', 'Nguyễn Văn Test'],
    ['student.test02@fpt.edu.vn', 'Trần Thị Minh Anh'],
    ['student.test03@fpt.edu.vn', 'Lê Hoàng Nam'],
    ['student.test04@fpt.edu.vn', 'Phạm Ngọc Hà'],
    ['student.test05@fpt.edu.vn', 'Hoàng Minh Đức'],
    ['student.test06@fpt.edu.vn', 'Vũ Thị Thu Trang'],
    ['student.test07@fpt.edu.vn', 'Đặng Quốc Bảo'],
    ['student.test08@fpt.edu.vn', 'Bùi Khánh Linh'],
    ['student.test09@fpt.edu.vn', 'Đỗ Hải Đăng'],
    ['student.test10@fpt.edu.vn', 'Ngô Phương Thảo'],
  ];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AITA';
  const sheet = workbook.addWorksheet('Sinh viên', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });
  sheet.columns = [
    { header: 'Email', key: 'email', width: 40 },
    { header: 'Họ tên', key: 'fullName', width: 30 },
  ];
  sheet.addRows(rows);
  sheet.autoFilter = 'A1:B11';
  sheet.eachRow((row, index) => {
    row.height = index === 1 ? 28 : 24;
    row.eachCell(cell => {
      cell.numFmt = '@';
      cell.font = { name: 'Calibri', size: 12, color: { argb: 'FF1F2937' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      if (index === 1) {
        cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      } else if (index % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    });
  });
  sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  sheet.pageSetup.printArea = 'A1:B11';
  const outputDir = path.resolve(__dirname, '../../../outputs/test-roster-20261006');
  await fs.mkdir(outputDir, { recursive: true });
  const file = path.join(outputDir, 'sinh_vien_test_AITA-TEST-001.xlsx');
  await workbook.xlsx.writeFile(file);

  const buffer = await fs.readFile(file);
  const parsed = await readRoster(buffer);
  assert.deepEqual(parsed.mapping, { email: 1, fullName: 2 });
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.rows.map(row => [row.email, row.fullName]), rows);
  const users = await prisma.user.findMany({ where: { email: { in: rows.map(row => row[0]) } } });
  assert(users.every(user => user.role === 'STUDENT' && user.isActive), 'Có email thuộc tài khoản không hợp lệ cho import.');
  const cls = await prisma.class.findUniqueOrThrow({ where: { classCode: 'AITA-TEST-001' } });
  const beforeCount = await prisma.classEnrollment.count({ where: { classId: cls.id } });
  const preview = await rosterImportService.preview(cls.id, { userId: cls.lecturerId, role: 'LECTURER' }, buffer);
  assert.equal(preview.totalRows, 10);
  assert.deepEqual(preview.errors, []);
  assert(preview.previewToken);
  assert.equal(await prisma.classEnrollment.count({ where: { classId: cls.id } }), beforeCount);
  console.log(JSON.stringify({ file, students: parsed.rows.length, bytes: buffer.length, mapping: parsed.mapping, errors: parsed.errors, previewVerified: true, enrollmentCount: beforeCount }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
