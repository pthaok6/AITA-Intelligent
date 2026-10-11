import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { authenticateJwt, AuthRequest, requireRoles } from '../../middlewares/auth.middleware';
import { prisma } from '../../infrastructure/database/prisma';
import { asyncRoute, HttpError } from '../../shared/http';
import { institutionalEmail } from './auth.service';

export const adminRouter = Router();
adminRouter.use(authenticateJwt, requireRoles('ADMIN'));

adminRouter.get('/users', asyncRoute(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ createdAt: 'desc' }], select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true } });
  res.json({ success: true, data: users });
}));

adminRouter.post('/users', asyncRoute(async (req, res) => {
  const { email: emailInput, fullName, password, role } = req.body || {};
  const email = institutionalEmail(emailInput);
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100) throw new HttpError(400, 'Họ tên cần từ 1 đến 100 ký tự.');
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) throw new HttpError(400, 'Mật khẩu cần từ 8 ký tự và không quá 72 byte.');
  if (!['STUDENT', 'LECTURER', 'ADMIN'].includes(role)) throw new HttpError(400, 'Vai trò không hợp lệ.');
  try {
    const user = await prisma.user.create({ data: { email, fullName: fullName.trim(), passwordHash: await bcrypt.hash(password, 12), role }, select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true } });
    res.status(201).json({ success: true, data: user });
  } catch (error: any) { if (error.code === 'P2002') throw new HttpError(409, 'Email đã được sử dụng.'); throw error; }
}));

adminRouter.patch('/users/:id', asyncRoute(async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const { email: emailInput, fullName, role, isActive, password } = req.body || {};
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  const data: Record<string, unknown> = {};
  if (emailInput !== undefined) data.email = institutionalEmail(emailInput);
  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100) throw new HttpError(400, 'Họ tên cần từ 1 đến 100 ký tự.');
    data.fullName = fullName.trim();
  }
  if (role !== undefined) {
    if (!['STUDENT', 'LECTURER', 'ADMIN'].includes(role)) throw new HttpError(400, 'Vai trò không hợp lệ.');
    data.role = role;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') throw new HttpError(400, 'isActive phải là true hoặc false.');
    data.isActive = isActive;
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) throw new HttpError(400, 'Mật khẩu cần từ 8 ký tự và không quá 72 byte.');
    data.passwordHash = await bcrypt.hash(password, 12);
  }
  const removingAdmin = existing.role === 'ADMIN' && (data.role !== undefined && data.role !== 'ADMIN' || data.isActive === false);
  if (removingAdmin) {
    if (id === req.user!.userId) throw new HttpError(400, 'Không thể tự hạ quyền hoặc vô hiệu hóa tài khoản đang đăng nhập.');
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (existing.isActive && activeAdmins <= 1) throw new HttpError(409, 'Phải giữ lại ít nhất một quản trị viên đang hoạt động.');
  }
  try {
    const user = await prisma.user.update({ where: { id }, data: data as any, select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true } });
    res.json({ success: true, data: user });
  } catch (error: any) { if (error.code === 'P2002') throw new HttpError(409, 'Email đã được sử dụng.'); throw error; }
}));

// Soft-delete accounts so enrollments, submissions and grading evidence remain intact.
adminRouter.delete('/users/:id', asyncRoute(async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  if (id === req.user!.userId) throw new HttpError(400, 'Không thể vô hiệu hóa tài khoản đang đăng nhập.');
  if (user.role === 'ADMIN' && user.isActive && await prisma.user.count({ where: { role: 'ADMIN', isActive: true } }) <= 1) throw new HttpError(409, 'Phải giữ lại ít nhất một quản trị viên đang hoạt động.');
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { isActive: false } }),
    prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  res.json({ success: true, message: 'Đã vô hiệu hóa tài khoản.' });
}));
