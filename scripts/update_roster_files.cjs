const ExcelJS = require('../apps/backend/node_modules/exceljs');
const fs = require('fs');
const path = require('path');

async function updateFiles() {
  const root = path.resolve(__dirname, '..');
  const students = [
    { stt: 1, code: 'SE170001', name: 'Nguyễn Văn Nam', email: 'student.test@fpt.edu.vn' },
    { stt: 2, code: 'SE170002', name: 'Trần Thị Minh Anh', email: 'student.test02@fpt.edu.vn' },
    { stt: 3, code: 'SE170003', name: 'Lê Hoàng Long', email: 'student.test03@fpt.edu.vn' },
    { stt: 4, code: 'SE170004', name: 'Phạm Đức Nam', email: 'student.test04@fpt.edu.vn' },
    { stt: 5, code: 'SE170005', name: 'Hoàng Minh Đức', email: 'student.test05@fpt.edu.vn' },
    { stt: 6, code: 'SE170101', name: 'Đỗ Quang Huy', email: 'huydqse170101@fpt.edu.vn' },
    { stt: 7, code: 'SE170102', name: 'Phạm Minh Tuấn', email: 'tuanpmse170102@fpt.edu.vn' },
    { stt: 8, code: 'SE170103', name: 'Vũ Thị Mai', email: 'maivtse170103@fpt.edu.vn' },
    { stt: 9, code: 'SE170104', name: 'Hoàng Đức Anh', email: 'anhhdse170104@fpt.edu.vn' },
    { stt: 10, code: 'SE170105', name: 'Ngô Phương Linh', email: 'linhnpse170105@fpt.edu.vn' },
    { stt: 11, code: 'SE170106', name: 'Đinh Trọng Phúc', email: 'phucdtse170106@fpt.edu.vn' },
    { stt: 12, code: 'SE170107', name: 'Bùi Khánh Huyền', email: 'huyenbkse170107@fpt.edu.vn' },
    { stt: 13, code: 'SE170108', name: 'Dương Quốc Bảo', email: 'baodqse170108@fpt.edu.vn' },
    { stt: 14, code: 'SE170109', name: 'Lý Thùy Dung', email: 'dungltse170109@fpt.edu.vn' },
    { stt: 15, code: 'SE170110', name: 'Tạ Thành Nam', email: 'namttse170110@fpt.edu.vn' }
  ];

  // 1. Write danh_sach_sinh_vien_import.xlsx
  const fileXlsx = path.join(root, 'danh_sach_sinh_vien_import.xlsx');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sách sinh viên');
  ws.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Mã sinh viên', key: 'code', width: 16 },
    { header: 'Họ và tên', key: 'name', width: 40 },
    { header: 'Email FPT', key: 'email', width: 36 }
  ];
  ws.getRow(1).font = { bold: true };
  students.forEach(s => ws.addRow(s));
  await wb.xlsx.writeFile(fileXlsx);
  console.log('Saved:', fileXlsx);

  // 2. Write danh_sach_sinh_vien_import.csv with UTF-8 BOM
  const fileCsv = path.join(root, 'danh_sach_sinh_vien_import.csv');
  let csvContent = '\uFEFF"STT","Mã sinh viên","Họ và tên","Email FPT"\r\n';
  students.forEach(s => {
    csvContent += `"${s.stt}","${s.code}","${s.name}","${s.email}"\r\n`;
  });
  fs.writeFileSync(fileCsv, csvContent, 'utf8');
  console.log('Saved:', fileCsv);

  // 3. Update examples/studentImport/sinh_vien_test_AITA-TEST-001.xlsx
  const fileEx = path.join(root, 'examples', 'studentImport', 'sinh_vien_test_AITA-TEST-001.xlsx');
  const wbEx = new ExcelJS.Workbook();
  const wsEx = wbEx.addWorksheet('Sinh viên');
  wsEx.columns = [
    { header: 'Email', key: 'email', width: 36 },
    { header: 'Họ tên', key: 'name', width: 40 }
  ];
  wsEx.getRow(1).font = { bold: true };
  students.forEach(s => wsEx.addRow({ email: s.email, name: s.name }));
  await wbEx.xlsx.writeFile(fileEx);
  console.log('Saved:', fileEx);
}

updateFiles()
  .then(() => {
    console.log('All files updated successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
