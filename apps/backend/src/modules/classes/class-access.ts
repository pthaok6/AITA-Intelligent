import { prisma } from '../../infrastructure/database/prisma';
import { HttpError } from '../../shared/http';
export async function classAccess(classId: string, actor: { userId: string; role: string }, write = false) {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { lecturerId: true } });
  if (!cls) throw new HttpError(404, 'Không tìm thấy lớp học.');
  if (actor.role === 'ADMIN' || (actor.role === 'LECTURER' && cls.lecturerId === actor.userId)) return;
  if (!write && actor.role === 'STUDENT') {
    const enrolled = await prisma.classEnrollment.findUnique({ where: { classId_studentId: { classId, studentId: actor.userId } } });
    if (enrolled?.status === 'ACTIVE') return;
  }
  throw new HttpError(403, 'Bạn không có quyền truy cập lớp này.');
}
