import { Response, Router } from 'express';
import { submissionService } from './submission.service';
import { authenticateJwt, AuthRequest } from '../../middlewares/auth.middleware';

export const submissionRouter = Router();

// Sinh viên nộp bài cho Exam
submissionRouter.post('/exams/:examId/submissions', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { sourceCode } = req.body;
    if (!sourceCode || typeof sourceCode !== 'string') {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp nội dung mã nguồn sourceCode' });
      return;
    }

    const examId = req.params.examId as string;
    const submission = await submissionService.submitCode(
      examId,
      req.user!.userId,
      sourceCode
    );

    res.status(201).json({ success: true, data: submission });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Xem chi tiết bài nộp và kết quả chấm
submissionRouter.get('/submissions/:id', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const submissionId = req.params.id as string;
    const submission = await submissionService.getSubmission(submissionId);
    res.status(200).json({ success: true, data: submission });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Xem toàn bộ danh sách bài nộp của một Exam (Dành cho Giảng viên hoặc thống kê)
submissionRouter.get('/exams/:examId/submissions', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params.examId as string;
    const submissions = await submissionService.getSubmissionsByExam(examId);
    res.status(200).json({ success: true, data: submissions });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});
