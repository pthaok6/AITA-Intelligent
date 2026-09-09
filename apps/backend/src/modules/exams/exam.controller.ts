import { Response, Router } from 'express';
import { examService } from './exam.service';
import { authenticateJwt, AuthRequest, requireRoles } from '../../middlewares/auth.middleware';
import { UserRole } from '../../domain/enums';

export const examRouter = Router();

// Lấy danh sách đề thi theo lớp
examRouter.get('/class/:classId', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const classId = req.params.classId as string;
    const exams = await examService.getExamsByClass(classId);
    res.status(200).json({ success: true, data: exams });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Giảng viên tạo đề thi
examRouter.post('/', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { classId, title, descriptionMd, allowedLanguage, timeLimitMs, memoryLimitMb, startTime, endTime, testCases } = req.body;
    if (!classId || !title || !descriptionMd || !startTime || !endTime) {
      res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin bài thi bắt buộc' });
      return;
    }
    const exam = await examService.createExam({
      classId,
      title,
      descriptionMd,
      allowedLanguage: allowedLanguage || 'PYTHON',
      timeLimitMs,
      memoryLimitMb,
      startTime,
      endTime,
      testCases,
    });
    res.status(201).json({ success: true, data: exam });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Xem chi tiết đề thi
examRouter.get('/:id', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params.id as string;
    const isLecturer = req.user?.role === UserRole.LECTURER || req.user?.role === UserRole.ADMIN;
    const exam = await examService.getExamById(examId, isLecturer);
    res.status(200).json({ success: true, data: exam });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Thêm test case vào bài thi
examRouter.post('/:id/testcases', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params.id as string;
    const { inputData, expectedOutput, isHidden, scoreWeight, orderIndex } = req.body;
    const tc = await examService.addTestCase(examId, {
      inputData,
      expectedOutput,
      isHidden,
      scoreWeight,
      orderIndex: orderIndex ?? 1,
    });
    res.status(201).json({ success: true, data: tc });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});
