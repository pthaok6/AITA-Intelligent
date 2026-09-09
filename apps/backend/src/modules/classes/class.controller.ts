import { Response, Router } from 'express';
import { classService } from './class.service';
import { authenticateJwt, AuthRequest, requireRoles } from '../../middlewares/auth.middleware';
import { UserRole } from '../../domain/enums';

export const classRouter = Router();

// Lấy danh sách lớp học
classRouter.get('/', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const classes = await classService.getMyClasses(req.user!.userId, req.user!.role);
    res.status(200).json({ success: true, data: classes });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Giảng viên tạo lớp học
classRouter.post('/', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { classCode, name, semester } = req.body;
    if (!classCode || !name || !semester) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp classCode, name, semester' });
      return;
    }
    const newClass = await classService.createClass(classCode, name, req.user!.userId, semester);
    res.status(201).json({ success: true, data: newClass });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Chi tiết lớp học
classRouter.get('/:id', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const classId = req.params.id as string;
    const cls = await classService.getClassDetails(classId);
    res.status(200).json({ success: true, data: cls });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Sinh viên tham gia lớp học
classRouter.post('/:id/enroll', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const classId = req.params.id as string;
    await classService.enrollStudent(classId, req.user!.userId);
    res.status(200).json({ success: true, message: 'Tham gia lớp học thành công' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});
