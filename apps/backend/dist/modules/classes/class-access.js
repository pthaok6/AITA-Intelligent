"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classAccess = classAccess;
const prisma_1 = require("../../infrastructure/database/prisma");
const http_1 = require("../../shared/http");
async function classAccess(classId, actor, write = false) {
    const cls = await prisma_1.prisma.class.findUnique({ where: { id: classId }, select: { lecturerId: true } });
    if (!cls)
        throw new http_1.HttpError(404, 'Không tìm thấy lớp học.');
    if (actor.role === 'ADMIN' || (actor.role === 'LECTURER' && cls.lecturerId === actor.userId))
        return;
    if (!write && actor.role === 'STUDENT') {
        const enrolled = await prisma_1.prisma.classEnrollment.findUnique({ where: { classId_studentId: { classId, studentId: actor.userId } } });
        if (enrolled?.status === 'ACTIVE')
            return;
    }
    throw new http_1.HttpError(403, 'Bạn không có quyền truy cập lớp này.');
}
