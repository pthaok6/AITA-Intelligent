import { Response, Router } from 'express';
import { classService } from './class.service';
import { authenticateJwt, AuthRequest, requireRoles } from '../../middlewares/auth.middleware';
import { UserRole } from '../../domain/enums';
import { classAccess } from './class-access';

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

classRouter.post('/join', authenticateJwt, requireRoles(UserRole.STUDENT), async (req: AuthRequest, res: Response) => {
  try {
    const classCode = req.body?.classCode;
    if (typeof classCode !== 'string' || !classCode.trim()) { res.status(400).json({ success: false, message: 'Vui lòng nhập mã lớp.' }); return; }
    const cls = await classService.enrollByCode(classCode, req.user!.userId);
    res.status(200).json({ success: true, data: cls, message: 'Đã tham gia lớp học.' });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
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

classRouter.patch('/:id', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    await classAccess(String(req.params.id), req.user!, true);
    const { classCode, name, semester } = req.body || {};
    if (![classCode, name, semester].every(value => typeof value === 'string')) { res.status(400).json({ success: false, message: 'Cần classCode, name và semester.' }); return; }
    res.json({ success: true, data: await classService.updateClass(String(req.params.id), { classCode, name, semester }) });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});

classRouter.delete('/:id', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    await classAccess(String(req.params.id), req.user!, true);
    await classService.deleteClass(String(req.params.id));
    res.json({ success: true, message: 'Đã xóa lớp học.' });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});

// Chi tiết lớp học
classRouter.get('/:id', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const classId = req.params.id as string;
    const cls = await classService.getClassDetails(classId, req.user);
    res.status(200).json({ success: true, data: cls });
  } catch (error: any) {
    res.status(error.status || 404).json({ success: false, message: error.message });
  }
});

// Sinh viên tham gia lớp học
classRouter.post('/:id/enroll', authenticateJwt, requireRoles(UserRole.STUDENT), async (req: AuthRequest, res: Response) => {
  try {
    const classId = req.params.id as string;
    await classService.enrollStudent(classId, req.user!.userId);
    res.status(200).json({ success: true, message: 'Tham gia lớp học thành công' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

classRouter.delete('/:id/enroll', authenticateJwt, requireRoles(UserRole.STUDENT), async (req: AuthRequest, res: Response) => {
  try {
    await classService.dropStudent(String(req.params.id), req.user!.userId);
    res.json({ success: true, message: 'Đã rời lớp học.' });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});

classRouter.delete('/:id/students/:studentId', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    await classAccess(String(req.params.id), req.user!, true);
    await classService.dropStudent(String(req.params.id), String(req.params.studentId));
    res.json({ success: true, message: 'Đã chuyển sinh viên sang trạng thái rời lớp.' });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});

classRouter.patch('/:id/students/:studentId', authenticateJwt, requireRoles(UserRole.LECTURER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    await classAccess(String(req.params.id), req.user!, true);
    const enrollment = await classService.reactivateStudent(String(req.params.id), String(req.params.studentId));
    res.json({ success: true, data: enrollment, message: 'Đã ghi danh sinh viên vào lớp.' });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, message: error.message }); }
});
