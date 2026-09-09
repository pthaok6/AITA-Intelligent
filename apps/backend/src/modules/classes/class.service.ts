import { classRepository, ClassRepository } from './class.repository';

export class ClassService {
  constructor(private classRepo: ClassRepository = classRepository) {}

  async createClass(classCode: string, name: string, lecturerId: string, semester: string) {
    return this.classRepo.create({ classCode, name, lecturerId, semester });
  }

  async getAllClasses() {
    return this.classRepo.findAll();
  }

  async getClassDetails(classId: string) {
    const cls = await this.classRepo.findById(classId);
    if (!cls) throw new Error('Không tìm thấy lớp học');
    return cls;
  }

  async enrollStudent(classId: string, studentId: string) {
    return this.classRepo.enrollStudent(classId, studentId);
  }

  async getMyClasses(userId: string, role: string) {
    if (role === 'STUDENT') {
      return this.classRepo.findStudentClasses(userId);
    }
    return this.classRepo.findAll();
  }
}

export const classService = new ClassService();
