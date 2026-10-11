import { prisma } from '../../infrastructure/database/prisma';

export class ClassRepository {
  async create(data: { classCode: string; name: string; lecturerId: string; semester: string }) {
    return prisma.class.create({
      data,
      include: { lecturer: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async update(id: string, data: { classCode: string; name: string; semester: string }) {
    return prisma.class.update({ where: { id }, data });
  }

  async deleteIfEmpty(id: string) {
    const cls = await prisma.class.findUnique({ where: { id }, include: { _count: { select: { enrollments: true, exams: true } } } });
    if (!cls) return false;
    if (cls._count.enrollments || cls._count.exams) throw new Error('Chỉ xóa được lớp chưa có sinh viên hoặc đề thi.');
    await prisma.class.delete({ where: { id } });
    return true;
  }

  async findByCode(classCode: string) {
    return prisma.class.findUnique({ where: { classCode } });
  }

  async isStudent(studentId: string) {
    const user = await prisma.user.findUnique({ where: { id: studentId }, select: { role: true, isActive: true } });
    return user?.role === 'STUDENT' && user.isActive;
  }

  async findAll(lecturerId?: string) {
    return prisma.class.findMany({
      where: lecturerId ? { lecturerId } : undefined,
      include: {
        lecturer: { select: { id: true, fullName: true, email: true } },
        _count: { select: { enrollments: true, exams: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.class.findUnique({
      where: { id },
      include: {
        lecturer: { select: { id: true, fullName: true, email: true } },
        exams: true,
        enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
      },
    });
  }

  async enrollStudent(classId: string, studentId: string) {
    return prisma.classEnrollment.upsert({
      where: { classId_studentId: { classId, studentId } },
      create: { classId, studentId, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });
  }

  async dropStudent(classId: string, studentId: string) {
    return prisma.classEnrollment.update({ where: { classId_studentId: { classId, studentId } }, data: { status: 'DROPPED' } });
  }

  async findStudentClasses(studentId: string) {
    const enrollments = await prisma.classEnrollment.findMany({
      where: { studentId, status: 'ACTIVE' },
      include: {
        class: {
          include: {
            lecturer: { select: { id: true, fullName: true } },
            exams: true,
          },
        },
      },
    });
    return enrollments.map((e) => e.class);
  }
}

export const classRepository = new ClassRepository();
