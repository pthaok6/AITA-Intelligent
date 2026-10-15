import { Response, Router } from 'express';
import { aiModuleService } from './ai.service';
import { authenticateJwt, AuthRequest, requireRoles } from '../../middlewares/auth.middleware';
import { UserRole } from '../../domain/enums';
import { asyncRoute, HttpError } from '../../shared/http';
import { prisma } from '../../infrastructure/database/prisma';
import { classAccess } from '../classes/class-access';

export const aiRouter = Router();

// Giảng viên / Admin yêu cầu AI soạn đề bài và bộ testcase kèm barem điểm
aiRouter.post(
  '/generate-exam',
  authenticateJwt,
  requireRoles(UserRole.LECTURER, UserRole.ADMIN),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const { topic, difficulty, language, testCaseCount, additionalRequirements } = req.body || {};
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      throw new HttpError(400, 'Chủ đề đề thi không được để trống.');
    }
    const result = await aiModuleService.generateExam({
      topic: topic.trim(),
      difficulty: difficulty || 'MEDIUM',
      language: language || 'PYTHON',
      testCaseCount: Number(testCaseCount) || 5,
      additionalRequirements: additionalRequirements ? String(additionalRequirements).trim() : undefined,
    });
    res.json({ success: true, data: result });
  })
);

// Giảng viên / Admin yêu cầu AI tự sinh hoặc chuẩn hóa barem điểm
aiRouter.post(
  '/generate-rubric',
  authenticateJwt,
  requireRoles(UserRole.LECTURER, UserRole.ADMIN),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const { title, descriptionMd, language, maxScore } = req.body || {};
    if (!title || !descriptionMd) {
      throw new HttpError(400, 'Tiêu đề và mô tả đề bài không được để trống.');
    }
    const result = await aiModuleService.generateRubric({
      title: String(title).trim(),
      descriptionMd: String(descriptionMd).trim(),
      language: language || 'PYTHON',
      maxScore: Number(maxScore) || 10.0,
    });
    res.json({ success: true, data: result });
  })
);

// Giải nghĩa lỗi biên dịch bằng ngôn ngữ tự nhiên
aiRouter.post(
  '/explain-error',
  authenticateJwt,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const { language, compileMessage } = req.body || {};
    if (!compileMessage || typeof compileMessage !== 'string' || !compileMessage.trim()) {
      throw new HttpError(400, 'Nội dung thông báo lỗi không được để trống.');
    }
    const result = await aiModuleService.explainError(
      language || 'PYTHON',
      compileMessage
    );
    res.json({ success: true, data: result });
  })
);

// Thực hiện hoặc kích hoạt lại Semantic Code Review cho bài nộp
aiRouter.post(
  '/review-submission/:id',
  authenticateJwt,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const submissionId = String(req.params.id);
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { exam: true },
    });
    if (!submission) {
      throw new HttpError(404, 'Không tìm thấy bài nộp.');
    }

    // Permission check: Sinh viên là chủ bài nộp hoặc giảng viên của lớp
    if (req.user!.role === UserRole.STUDENT) {
      if (submission.studentId !== req.user!.userId) {
        throw new HttpError(403, 'Bạn không có quyền yêu cầu review cho bài nộp của người khác.');
      }
    } else {
      await classAccess(submission.exam.classId, req.user!, true);
    }

    const reviewResult = await aiModuleService.reviewSubmission(submissionId);
    res.json({ success: true, data: reviewResult });
  })
);

// Lấy danh sách AI Review của bài nộp
aiRouter.get(
  '/reviews/:submissionId',
  authenticateJwt,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const submissionId = String(req.params.submissionId);
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { exam: true },
    });
    if (!submission) {
      throw new HttpError(404, 'Không tìm thấy bài nộp.');
    }

    if (req.user!.role === UserRole.STUDENT) {
      if (submission.studentId !== req.user!.userId) {
        throw new HttpError(403, 'Không có quyền truy cập bài nộp này.');
      }
      // Check if scores are released
      const scoreReleased = new Date() >= submission.exam.endTime;
      if (!scoreReleased) {
        res.json({ success: true, data: [] });
        return;
      }
    } else {
      await classAccess(submission.exam.classId, req.user!, true);
    }

    const reviews = await aiModuleService.getReviewsBySubmission(submissionId);
    res.json({ success: true, data: reviews });
  })
);

// Kiểm tra trạng thái hệ thống AI và Key Pool
aiRouter.get(
  '/config-status',
  authenticateJwt,
  asyncRoute(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: aiModuleService.getStatus() });
  })
);
