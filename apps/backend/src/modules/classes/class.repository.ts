import { prisma } from '../../infrastructure/database/prisma';

export class ClassRepository {
  async create(data: { classCode: string; name: string; lecturerId: string; semester: string }) {
    return prisma.class.create({
      data,
      include: { lecturer: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async findAll() {
    return prisma.class.findMany({
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
