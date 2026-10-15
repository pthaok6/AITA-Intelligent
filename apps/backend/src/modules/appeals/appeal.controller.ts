import { Router } from 'express';
import { appealService } from './appeal.service';
import { authenticateJwt, AuthRequest } from '../../middlewares/auth.middleware';
import { asyncRoute, HttpError } from '../../shared/http';

export const appealRouter = Router();

// Student creates an appeal
appealRouter.post('/', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const { submissionId, title, reason, expectedScore } = req.body;
  const appeal = await appealService.createAppeal(req.user!.userId, {
    submissionId,
    title,
    reason,
    expectedScore: expectedScore !== undefined ? Number(expectedScore) : undefined,
  });
  res.status(201).json({ success: true, data: appeal, message: 'Đã gửi đơn khiếu nại thành công.' });
}));

// Student gets their own appeals
appealRouter.get('/my', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const appeals = await appealService.getMyAppeals(req.user!.userId);
  res.json({ success: true, data: appeals });
}));

// Get appeals for a specific submission
appealRouter.get('/submission/:submissionId', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const appeals = await appealService.getSubmissionAppeals(String(req.params.submissionId), req.user!.userId);
  res.json({ success: true, data: appeals });
}));

// Lecturer gets appeals inbox
appealRouter.get('/lecturer', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  if (req.user!.role === 'STUDENT') {
    throw new HttpError(403, 'Hộp thư giải quyết khiếu nại chỉ dành cho Giảng viên và Quản trị viên.');
  }
  const { status, classId, examId } = req.query;
  const appeals = await appealService.getLecturerAppeals(
    req.user!.userId,
    req.user!.role,
    {
      status: status ? String(status) : undefined,
      classId: classId ? String(classId) : undefined,
      examId: examId ? String(examId) : undefined,
    }
  );
  res.json({ success: true, data: appeals });
}));

// Get single appeal details
appealRouter.get('/:id', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const appeal = await appealService.getAppealById(String(req.params.id), req.user!.userId, req.user!.role);
  res.json({ success: true, data: appeal });
}));

// Lecturer resolves an appeal
appealRouter.patch('/:id/resolve', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  if (req.user!.role === 'STUDENT') {
    throw new HttpError(403, 'Chỉ Giảng viên hoặc Quản trị viên mới có quyền giải quyết khiếu nại.');
  }
  const { status, decisionReason, newScore } = req.body;
  const updatedAppeal = await appealService.resolveAppeal(
    String(req.params.id),
    req.user!.userId,
    req.user!.role,
    {
      status,
      decisionReason,
      newScore: newScore !== undefined ? Number(newScore) : undefined,
    }
  );
  res.json({ success: true, data: updatedAppeal, message: 'Đã cập nhật trạng thái khiếu nại.' });
}));
