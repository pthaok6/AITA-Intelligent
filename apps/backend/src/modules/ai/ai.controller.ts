import { Response, Router } from 'express';
import { aiModuleService } from './ai.service';
import { authenticateJwt, AuthRequest, requireRoles } from '../../middlewares/auth.middleware';
import { UserRole } from '../../domain/enums';
import { asyncRoute, HttpError } from '../../shared/http';
import multer from 'multer';
import { extractDocumentContent } from '../../infrastructure/ai/document-parser';

const materialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, callback) => {
    if (!/\.(pdf|pptx|docx|txt|md|markdown)$/i.test(file.originalname)) {
      callback(new HttpError(400, 'Chỉ hỗ trợ file .pdf, .pptx, .docx, .md hoặc .txt.'));
      return;
    }
    callback(null, true);
  },
});
import { prisma } from '../../infrastructure/database/prisma';
import { classAccess } from '../classes/class-access';

export const aiRouter = Router();

// Trích xuất nội dung văn bản từ tài liệu bài giảng / slide đính kèm (.pdf, .pptx, .docx, .txt, .md)
aiRouter.post(
  '/parse-material',
  authenticateJwt,
  requireRoles(UserRole.LECTURER, UserRole.ADMIN),
  materialUpload.single('materialFile'),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      throw new HttpError(400, 'Vui lòng chọn tệp slide hoặc tài liệu bài giảng (.pdf, .pptx, .docx, .md, .txt).');
    }
    const extracted = await extractDocumentContent(req.file.buffer, req.file.originalname);
    res.json({ success: true, data: extracted });
  })
);

// Giảng viên / Admin yêu cầu AI soạn đề bài và bộ testcase kèm barem điểm
aiRouter.post(
  '/generate-exam',
  authenticateJwt,
  requireRoles(UserRole.LECTURER, UserRole.ADMIN),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const { topic, difficulty, language, testCaseCount, additionalRequirements, materialContent } = req.body || {};
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      throw new HttpError(400, 'Chủ đề đề thi không được để trống.');
    }
    const result = await aiModuleService.generateExam({
      topic: topic.trim(),
      difficulty: difficulty || 'MEDIUM',
      language: language || 'PYTHON',
      testCaseCount: Number(testCaseCount) || 5,
      additionalRequirements: additionalRequirements ? String(additionalRequirements).trim() : undefined,
      materialContent: materialContent ? String(materialContent).trim() : undefined,
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

    // Permission check: Sinh viên là chủ bài nộp hoặc thành viên nhóm hoặc giảng viên của lớp
    if (req.user!.role === UserRole.STUDENT) {
      if (submission.studentId !== req.user!.userId) {
        if (submission.teamId) {
          const membership = await prisma.teamMember.findUnique({
            where: { teamId_studentId: { teamId: submission.teamId, studentId: req.user!.userId } },
          });
          if (!membership) {
            throw new HttpError(403, 'Bạn không có quyền yêu cầu review cho bài nộp của nhóm khác.');
          }
        } else {
          throw new HttpError(403, 'Bạn không có quyền yêu cầu review cho bài nộp của người khác.');
        }
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
        if (submission.teamId) {
          const membership = await prisma.teamMember.findUnique({
            where: { teamId_studentId: { teamId: submission.teamId, studentId: req.user!.userId } },
          });
          if (!membership) {
            throw new HttpError(403, 'Không có quyền truy cập bài nộp này.');
          }
        } else {
          throw new HttpError(403, 'Không có quyền truy cập bài nộp này.');
        }
      }
    } else {
      await classAccess(submission.exam.classId, req.user!, true);
    }

    const reviews = await aiModuleService.getReviewsBySubmission(submissionId);
    res.json({ success: true, data: reviews });
  })
);

import { keyPool } from '../../infrastructure/ai/key-pool';

// Kiểm tra trạng thái hệ thống AI và Key Pool
aiRouter.get(
  '/config-status',
  authenticateJwt,
  asyncRoute(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: aiModuleService.getStatus() });
  })
);

// UC14 — Manage AI API Key Rotation (Admin endpoints)
aiRouter.get(
  '/admin/keys',
  authenticateJwt,
  requireRoles(UserRole.ADMIN),
  asyncRoute(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: keyPool.listKeys() });
  })
);

aiRouter.post(
  '/admin/keys',
  authenticateJwt,
  requireRoles(UserRole.ADMIN),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const { provider, key, probeFirst } = req.body || {};
    if (!provider || !['gemini', 'openai'].includes(provider)) {
      throw new HttpError(400, 'Nhà cung cấp AI không hợp lệ (hỗ trợ gemini hoặc openai).');
    }
    const entry = await keyPool.addCustomKey(provider, key, probeFirst !== false);
    res.status(201).json({ success: true, data: entry, message: 'Thêm Key vào Pool thành công.' });
  })
);

aiRouter.delete(
  '/admin/keys/:id',
  authenticateJwt,
  requireRoles(UserRole.ADMIN),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const ok = keyPool.removeKey(String(req.params.id));
    if (!ok) throw new HttpError(404, 'Không tìm thấy Key cần xóa.');
    res.json({ success: true, message: 'Đã xóa Key khỏi Pool.' });
  })
);

aiRouter.post(
  '/admin/keys/:id/reset',
  authenticateJwt,
  requireRoles(UserRole.ADMIN),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const ok = keyPool.resetKey(String(req.params.id));
    if (!ok) throw new HttpError(404, 'Không tìm thấy Key cần reset.');
    res.json({ success: true, message: 'Đã reset cooldown cho Key.' });
  })
);

aiRouter.post(
  '/admin/keys/:id/probe',
  authenticateJwt,
  requireRoles(UserRole.ADMIN),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const probe = await keyPool.probeKey(String(req.params.id));
    res.json({ success: true, data: probe });
  })
);

