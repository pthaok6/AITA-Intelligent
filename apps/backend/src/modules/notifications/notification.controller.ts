import { Response, Router } from 'express';
import { authenticateJwt, AuthRequest } from '../../middlewares/auth.middleware';
import { UserRole } from '../../domain/enums';
import { asyncRoute } from '../../shared/http';
import { prisma } from '../../infrastructure/database/prisma';
import { keyPool } from '../../infrastructure/ai/key-pool';

export const notificationRouter = Router();

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'RESULT' | 'APPEAL' | 'SYSTEM' | 'TEAM';
  link: string;
  createdAt: string;
  isRead?: boolean;
}

notificationRouter.get(
  '/',
  authenticateJwt,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const notifications: InAppNotification[] = [];

    if (user.role === UserRole.STUDENT) {
      // 1. Recent completed or graded submissions
      const submissions = await prisma.submission.findMany({
        where: { studentId: user.userId },
        include: { exam: { select: { title: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 6,
      });

      for (const sub of submissions) {
        if (sub.status === 'COMPLETED') {
          notifications.push({
            id: `sub-${sub.id}`,
            title: 'Kết quả chấm tự động',
            message: `Bài thi "${sub.exam.title}" đạt ${sub.totalScore ?? 0}/100 điểm.`,
            type: 'RESULT',
            link: `/student/submissions/${sub.id}`,
            createdAt: (sub.completedAt || sub.submittedAt).toISOString(),
          });
        } else if (sub.status === 'COMPILE_ERROR') {
          notifications.push({
            id: `sub-${sub.id}`,
            title: 'Lỗi biên dịch bài nộp',
            message: `Bài thi "${sub.exam.title}" gặp lỗi biên dịch. Nhấn để xem AI giải thích lỗi.`,
            type: 'RESULT',
            link: `/student/submissions/${sub.id}`,
            createdAt: (sub.completedAt || sub.submittedAt).toISOString(),
          });
        }
      }

      // 2. Appeals status updates
      const appeals = await prisma.appeal.findMany({
        where: { studentId: user.userId },
        include: { exam: { select: { title: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      });

      for (const app of appeals) {
        if (app.status === 'ACCEPTED') {
          notifications.push({
            id: `apl-${app.id}`,
            title: 'Khiếu nại được chấp thuận',
            message: `Giảng viên đã duyệt khiếu nại bài "${app.exam.title}". Điểm mới: ${app.newScore ?? app.previousScore} điểm.`,
            type: 'APPEAL',
            link: '/student/appeals',
            createdAt: app.updatedAt.toISOString(),
          });
        } else if (app.status === 'REJECTED') {
          notifications.push({
            id: `apl-${app.id}`,
            title: 'Khiếu nại bị từ chối',
            message: `Giảng viên đã phản hồi từ chối khiếu nại bài "${app.exam.title}".`,
            type: 'APPEAL',
            link: '/student/appeals',
            createdAt: app.updatedAt.toISOString(),
          });
        }
      }
    } else {
      // LECTURER & ADMIN
      // 1. Pending appeals needing resolution
      let appealWhere: any = { status: 'SUBMITTED' };
      if (user.role === UserRole.LECTURER) {
        appealWhere = {
          status: 'SUBMITTED',
          exam: { class: { lecturerId: user.userId } },
        };
      }

      const pendingAppeals = await prisma.appeal.findMany({
        where: appealWhere,
        include: {
          student: { select: { fullName: true } },
          exam: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });

      for (const app of pendingAppeals) {
        notifications.push({
          id: `lect-apl-${app.id}`,
          title: 'Khiếu nại mới chờ xử lý',
          message: `Sinh viên ${app.student.fullName} gửi khiếu nại bài "${app.exam.title}": "${app.reason.slice(0, 50)}..."`,
          type: 'APPEAL',
          link: user.role === UserRole.ADMIN ? '/admin/appeals' : '/lecturer/appeals',
          createdAt: app.createdAt.toISOString(),
        });
      }

      // 2. Admin AI Key Pool Alerts (UC14 / UC23)
      if (user.role === UserRole.ADMIN) {
        const poolStatus = keyPool.getStatus();
        if (poolStatus.gemini.availableKeys < poolStatus.gemini.totalKeys) {
          notifications.push({
            id: `sys-key-gemini`,
            title: 'Cảnh báo AI Key Rotation (UC14)',
            message: `Gemini Key Pool có ${poolStatus.gemini.totalKeys - poolStatus.gemini.availableKeys} key đang trong thời gian Cooldown.`,
            type: 'SYSTEM',
            link: '/admin/ai-keys',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Sort by createdAt descending
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: notifications.slice(0, 15),
    });
  })
);
