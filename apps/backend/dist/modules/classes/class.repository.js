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
    async findAll() {
        return prisma_1.prisma.class.findMany({
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
