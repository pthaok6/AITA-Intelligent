import { classRepository, ClassRepository } from './class.repository';
import { HttpError } from '../../shared/http';

export class ClassService {
  constructor(private classRepo: ClassRepository = classRepository) {}

  async createClass(classCode: string, name: string, lecturerId: string, semester: string) {
    return this.classRepo.create({ classCode, name, lecturerId, semester });
  }

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

  async getMyClasses(userId: string, role: string) {
    if (role === 'STUDENT') {
      return this.classRepo.findStudentClasses(userId);
    }
    return this.classRepo.findAll(role === 'LECTURER' ? userId : undefined);
  }
}

export const classService = new ClassService();
