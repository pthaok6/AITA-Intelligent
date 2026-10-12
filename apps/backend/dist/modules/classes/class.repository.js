"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classRepository = exports.ClassRepository = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
class ClassRepository {
    async create(data) {
        return prisma_1.prisma.class.create({
            data,
            include: { lecturer: { select: { id: true, fullName: true, email: true } } },
        });
    }
    async update(id, data) {
        return prisma_1.prisma.class.update({ where: { id }, data });
    }
    async deleteIfEmpty(id) {
        const cls = await prisma_1.prisma.class.findUnique({ where: { id }, include: { _count: { select: { enrollments: true, exams: true } } } });
        if (!cls)
            return false;
        if (cls._count.enrollments || cls._count.exams)
            throw new Error('Chỉ xóa được lớp chưa có sinh viên hoặc đề thi.');
        await prisma_1.prisma.class.delete({ where: { id } });
        return true;
    }
    async findByCode(classCode) {
        return prisma_1.prisma.class.findUnique({ where: { classCode } });
    }
    async isStudent(studentId) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: studentId }, select: { role: true, isActive: true } });
        return user?.role === 'STUDENT' && user.isActive;
    }
    async findAll(lecturerId) {
        return prisma_1.prisma.class.findMany({
            where: lecturerId ? { lecturerId } : undefined,
            include: {
                lecturer: { select: { id: true, fullName: true, email: true } },
                _count: { select: { enrollments: true, exams: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findById(id) {
        return prisma_1.prisma.class.findUnique({
            where: { id },
            include: {
                lecturer: { select: { id: true, fullName: true, email: true } },
                exams: true,
                enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
            },
        });
    }
    async enrollStudent(classId, studentId) {
        return prisma_1.prisma.classEnrollment.upsert({
            where: { classId_studentId: { classId, studentId } },
            create: { classId, studentId, status: 'ACTIVE' },
            update: { status: 'ACTIVE' },
        });
    }
    async dropStudent(classId, studentId) {
        return prisma_1.prisma.classEnrollment.update({ where: { classId_studentId: { classId, studentId } }, data: { status: 'DROPPED' } });
    }
    async findStudentClasses(studentId) {
        const enrollments = await prisma_1.prisma.classEnrollment.findMany({
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
exports.ClassRepository = ClassRepository;
exports.classRepository = new ClassRepository();
