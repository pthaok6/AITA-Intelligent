const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();
const password = 'AitaTest@123';

async function main() {
  console.log('--- Đang khởi tạo dữ liệu mẫu cho Đề thi Nhóm & Git Analytics ---');
  const passwordHash = await bcrypt.hash(password, 12);

  // 1. Users
  const lecturer = await db.user.upsert({
    where: { email: 'admin.test@fpt.edu.vn' },
    create: { email: 'admin.test@fpt.edu.vn', fullName: 'Giảng viên hướng dẫn SWP', passwordHash, role: 'ADMIN', isActive: true },
    update: { passwordHash, isActive: true }
  });

  const studentLeader = await db.user.upsert({
    where: { email: 'student.test@fpt.edu.vn' },
    create: { email: 'student.test@fpt.edu.vn', fullName: 'Nguyễn Văn Nam (Trưởng nhóm)', passwordHash, role: 'STUDENT', isActive: true },
    update: { passwordHash, isActive: true }
  });

  const studentMember1 = await db.user.upsert({
    where: { email: 'student.test02@fpt.edu.vn' },
    create: { email: 'student.test02@fpt.edu.vn', fullName: 'Trần Thị Minh Anh (Thành viên Dev)', passwordHash, role: 'STUDENT', isActive: true },
    update: { passwordHash, isActive: true }
  });

  const studentMember2 = await db.user.upsert({
    where: { email: 'student.test03@fpt.edu.vn' },
    create: { email: 'student.test03@fpt.edu.vn', fullName: 'Lê Hoàng Long (Thành viên Tester)', passwordHash, role: 'STUDENT', isActive: true },
    update: { passwordHash, isActive: true }
  });

  const studentFreerider = await db.user.upsert({
    where: { email: 'student.test04@fpt.edu.vn' },
    create: { email: 'student.test04@fpt.edu.vn', fullName: 'Phạm Đức Lười (Cảnh báo Free-rider BR-05)', passwordHash, role: 'STUDENT', isActive: true },
    update: { passwordHash, isActive: true }
  });

  const students = [studentLeader, studentMember1, studentMember2, studentFreerider];
  console.log(`Đã tạo / cập nhật ${students.length} tài khoản sinh viên và 1 giảng viên.`);

  // 2. Class
  const classCode = 'SWP391-SE1801';
  const cls = await db.class.upsert({
    where: { classCode },
    create: {
      classCode,
      name: 'Lớp Dự Án Phần Mềm SWP391 (Kỳ Fall 2026)',
      lecturerId: lecturer.id,
      semester: 'FA26'
    },
    update: { name: 'Lớp Dự Án Phần Mềm SWP391 (Kỳ Fall 2026)', lecturerId: lecturer.id }
  });

  // Enroll students
  for (const s of students) {
    await db.classEnrollment.upsert({
      where: { classId_studentId: { classId: cls.id, studentId: s.id } },
      create: { classId: cls.id, studentId: s.id },
      update: {}
    });
  }
  console.log(`Đã đăng ký sinh viên vào lớp: ${cls.name} (${classCode})`);

  // 3. Exam (GROUP)
  const examTitle = '[BTL Nhóm] Xử lý số học phân tán & Tối ưu thuật toán';
  const existingExam = await db.exam.findFirst({
    where: { classId: cls.id, title: examTitle }
  });

  const now = new Date();
  const examData = {
    classId: cls.id,
    title: examTitle,
    descriptionMd: `## Đề thi thực hành nhóm SWP391

### Mô tả bài toán
Hệ thống yêu cầu các nhóm xây dựng module xử lý tính tổng hai số nguyên $A$ và $B$ trong môi trường tính toán tối ưu.

### Yêu cầu kỹ thuật
- **Ngôn ngữ**: Python 3
- Đọc từ chuẩn \`stdin\` hai số nguyên $A$ và $B$ cách nhau bởi dấu cách.
- In ra chuẩn \`stdout\` một số nguyên duy nhất là kết quả của $A + B$.
- Giới hạn: $-10^9 \\le A, B \\le 10^9$.
- Giới hạn thời gian: 2.0 giây.
- Giới hạn bộ nhớ: 512 MB.

### Quy định nộp bài theo nhóm (BR-11, BR-12)
1. **Quyền nộp bài**: Chỉ **Trưởng nhóm (Team Leader)** mới có quyền nộp bài đại diện cho nhóm. Các thành viên khác nếu nộp sẽ bị hệ thống từ chối.
2. **Chấm điểm cá nhân**: Sau khi nộp bài và chấm điểm kiểm thử tự động, Giảng viên sẽ kích hoạt phân tích lịch sử commit trên GitHub repo của nhóm để phân chia điểm số cá nhân theo tỉ lệ đóng góp (BR-12). Thành viên có tỉ lệ đóng góp $< 5\\%$ sẽ bị cảnh báo vi phạm quy chế làm việc nhóm (BR-05).
`,
    allowedLanguage: 'PYTHON',
    examType: 'GROUP',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Bắt đầu từ 2 tiếng trước
    endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Kết thúc sau 30 ngày
  };

  const exam = existingExam
    ? await db.exam.update({ where: { id: existingExam.id }, data: examData })
    : await db.exam.create({ data: examData });

  console.log(`Đã tạo / cập nhật Đề thi nhóm: ${exam.title} (ID: ${exam.id})`);

  // Test cases
  await db.testCase.deleteMany({ where: { examId: exam.id } });
  await db.testCase.createMany({
    data: [
      {
        examId: exam.id,
        inputData: '3 5',
        expectedOutput: '8',
        isHidden: false,
        scoreWeight: 4,
        orderIndex: 1
      },
      {
        examId: exam.id,
        inputData: '10 20',
        expectedOutput: '30',
        isHidden: false,
        scoreWeight: 3,
        orderIndex: 2
      },
      {
        examId: exam.id,
        inputData: '-5 15',
        expectedOutput: '10',
        isHidden: true,
        scoreWeight: 3,
        orderIndex: 3
      }
    ]
  });
  console.log('Đã tạo 3 test cases chuẩn (Tổng điểm: 10/10).');

  // 4. Team & Members
  let team = await db.team.findFirst({
    where: { examId: exam.id, name: 'Nhóm 01 - Dev Warriors' }
  });

  if (!team) {
    team = await db.team.create({
      data: {
        examId: exam.id,
        name: 'Nhóm 01 - Dev Warriors',
        repoUrl: 'https://github.com/aita-demo/group-project-01'
      }
    });
  }

  // Create or update Team Members
  await db.teamMember.deleteMany({ where: { teamId: team.id } });
  
  const mLeader = await db.teamMember.create({
    data: {
      teamId: team.id,
      studentId: studentLeader.id,
      role: 'LEADER',
      githubUsername: 'leader-nam'
    }
  });

  const mMember1 = await db.teamMember.create({
    data: {
      teamId: team.id,
      studentId: studentMember1.id,
      role: 'MEMBER',
      githubUsername: 'minhanh-coder'
    }
  });

  const mMember2 = await db.teamMember.create({
    data: {
      teamId: team.id,
      studentId: studentMember2.id,
      role: 'MEMBER',
      githubUsername: 'long-tester'
    }
  });

  const mFreerider = await db.teamMember.create({
    data: {
      teamId: team.id,
      studentId: studentFreerider.id,
      role: 'MEMBER',
      githubUsername: 'freerider-duc'
    }
  });

  console.log(`Đã gán 4 thành viên vào "${team.name}":`);
  console.log(`- Trưởng nhóm (LEADER): ${studentLeader.fullName} (${studentLeader.email})`);
  console.log(`- Thành viên (MEMBER): ${studentMember1.fullName} (${studentMember1.email})`);
  console.log(`- Thành viên (MEMBER): ${studentMember2.fullName} (${studentMember2.email})`);
  console.log(`- Thành viên Cảnh báo (MEMBER): ${studentFreerider.fullName} (${studentFreerider.email})`);

  console.log('\n Khởi tạo dữ liệu thành công 100%!');
}

main()
  .catch(err => {
    console.error('Lỗi khởi tạo:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
