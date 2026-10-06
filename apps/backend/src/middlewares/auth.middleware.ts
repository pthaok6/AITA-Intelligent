import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service';

export interface AuthRequest extends Request {
  user?: { userId: string; email: string; role: string; sessionId: string };
}
export const authenticateJwt = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7) : req.cookies?.aita_access;
  if (!token) { res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' }); return; }
  try { req.user = await authService.authenticate(token); next(); }
  catch (error) { next(error); }
};
export const requireRoles = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || !roles.includes(req.user.role)) { res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' }); return; }
  next();
};
