import { Response, Router } from 'express';
import { examService } from './exam.service';
import { authenticateJwt, AuthRequest, requireRoles } from '../../middlewares/auth.middleware';
import { UserRole } from '../../domain/enums';
import { classAccess } from '../classes/class-access';

export const examRouter = Router();

// Lấy danh sách đề thi theo lớp
examRouter.get('/class/:classId', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const classId = req.params.classId as string;
    await classAccess(classId, req.user!);
    const exams = await examService.getExamsByClass(classId);
    res.status(200).json({ success: true, data: exams });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

// Giảng viên tạo đề thi
examRouter.post('/', authenticateJwt, requireRoles(UserRole.LECTURER), async (req: AuthRequest, res: Response) => {
  try {
    const { classId, title, descriptionMd, allowedLanguage, examType, timeLimitMs, memoryLimitMb, startTime, endTime, testCases, maxTeamSize, lowerBound, upperBound } = req.body;
    if (!classId || !title || !descriptionMd || !startTime || !endTime) {
      res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin bài thi bắt buộc' });
      return;
    }
    await classAccess(classId, req.user!, true);
    const exam = await examService.createExam({
      classId,
      title,
      descriptionMd,
      allowedLanguage: allowedLanguage || 'PYTHON',
      examType: examType || 'INDIVIDUAL',
      timeLimitMs,
      memoryLimitMb,
      startTime,
      endTime,
      maxTeamSize: maxTeamSize !== undefined ? Number(maxTeamSize) : undefined,
      lowerBound: lowerBound !== undefined ? Number(lowerBound) : undefined,
      upperBound: upperBound !== undefined ? Number(upperBound) : undefined,
      testCases,
    });
    res.status(201).json({ success: true, data: exam });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

examRouter.patch('/:id', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const exam = await examService.getExamById(String(req.params.id));
    await classAccess(exam.classId, req.user!, true);
    res.json({ success: true, data: await examService.updateExam(exam.id, req.body) });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});

examRouter.delete('/:id', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const exam = await examService.getExamById(String(req.params.id));
    await classAccess(exam.classId, req.user!, true);
    await examService.deleteExam(exam.id);
    res.json({ success: true, message: 'Đã xóa đề thi.' });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});

// Xem chi tiết đề thi
examRouter.get('/:id', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params.id as string;
    const isLecturer = req.user?.role === UserRole.LECTURER || req.user?.role === UserRole.ADMIN;
    const exam = await examService.getExamById(examId, isLecturer);
    await classAccess(exam.classId, req.user!);
    res.status(200).json({ success: true, data: exam });
  } catch (error: any) {
    res.status(error.status || 404).json({ success: false, message: error.message });
  }
});

// Thêm test case vào bài thi
examRouter.post('/:id/testcases', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params.id as string;
    const exam = await examService.getExamById(examId);
    await classAccess(exam.classId, req.user!, true);
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
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

examRouter.patch('/:id/testcases/:testCaseId', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const examId = String(req.params.id);
    const exam = await examService.getExamById(examId);
    await classAccess(exam.classId, req.user!, true);
    const { inputData, expectedOutput, isHidden, scoreWeight, orderIndex } = req.body || {};
    res.json({ success: true, data: await examService.updateTestCase(examId, String(req.params.testCaseId), { inputData, expectedOutput, isHidden, scoreWeight, orderIndex }) });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});

examRouter.delete('/:id/testcases/:testCaseId', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const examId = String(req.params.id);
    const exam = await examService.getExamById(examId);
    await classAccess(exam.classId, req.user!, true);
    await examService.deleteTestCase(examId, String(req.params.testCaseId));
    res.json({ success: true, message: 'Đã xóa test case.' });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});
