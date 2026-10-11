import { classRepository, ClassRepository } from './class.repository';
import { HttpError } from '../../shared/http';

export class ClassService {
  constructor(private classRepo: ClassRepository = classRepository) {}

  async createClass(classCode: string, name: string, lecturerId: string, semester: string) {
    return this.classRepo.create({ classCode: classCode.trim(), name: name.trim(), lecturerId, semester: semester.trim() });
  }

  async updateClass(classId: string, data: { classCode: string; name: string; semester: string }) {
    if (!data.classCode.trim() || !data.name.trim() || !data.semester.trim()) throw new Error('Mã lớp, tên lớp và học kỳ không được để trống.');
    return this.classRepo.update(classId, { classCode: data.classCode.trim(), name: data.name.trim(), semester: data.semester.trim() });
  }

  async deleteClass(classId: string) { return this.classRepo.deleteIfEmpty(classId); }

  async getAllClasses() {
    return this.classRepo.findAll();
  }

  async getClassDetails(classId: string, actor?: { userId: string; role: string }) {
    const cls = await this.classRepo.findById(classId);
    if (!cls) throw new Error('Không tìm thấy lớp học');
    if (actor && actor.role !== 'ADMIN' && cls.lecturerId !== actor.userId && !cls.enrollments.some(e => e.studentId === actor.userId && e.status === 'ACTIVE')) throw new HttpError(403, 'Bạn không có quyền xem lớp này.');
    return cls;
  }

  async enrollStudent(classId: string, studentId: string) {
    return this.classRepo.enrollStudent(classId, studentId);
  }

  async reactivateStudent(classId: string, studentId: string) {
    if (!(await this.classRepo.isStudent(studentId))) throw new Error('Chỉ có thể ghi danh tài khoản sinh viên đang hoạt động.');
    return this.classRepo.enrollStudent(classId, studentId);
  }

  async enrollByCode(classCode: string, studentId: string) {
    const cls = await this.classRepo.findByCode(classCode.trim());
    if (!cls) throw new Error('Không tìm thấy lớp theo mã đã nhập.');
    await this.classRepo.enrollStudent(cls.id, studentId);
    return cls;
  }

  async dropStudent(classId: string, studentId: string) { return this.classRepo.dropStudent(classId, studentId); }

  async getMyClasses(userId: string, role: string) {
    if (role === 'STUDENT') {
      return this.classRepo.findStudentClasses(userId);
    }
    return this.classRepo.findAll(role === 'LECTURER' ? userId : undefined);
  }
}

export const classService = new ClassService();
