import { CookieOptions, Response, Router } from 'express';
import { randomBytes } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { authService, ACCESS_SECONDS } from './auth.service';
import { secureCookies } from '../../config';
import { asyncRoute } from '../../shared/http';
import { authenticateJwt, AuthRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../infrastructure/database/prisma';

export const authRouter = Router();
const cookieOptions = (): CookieOptions => ({ httpOnly: true, secure: secureCookies(), sameSite: 'strict' });
function sendSession(res: Response, session: Awaited<ReturnType<typeof authService.login>>, status = 200) {
  res.cookie('aita_access', session.token, { ...cookieOptions(), path: '/api', maxAge: ACCESS_SECONDS * 1000 });
  res.cookie('aita_refresh', session.refreshToken, { ...cookieOptions(), path: '/api/auth', expires: session.expiresAt });
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json({ success: true, data: { user: session.user, token: session.token, expiresIn: ACCESS_SECONDS } });
}
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.' } });
authRouter.post('/register', loginLimit, asyncRoute(async (req, res) => {
  sendSession(res, await authService.register(req.body?.email, req.body?.password, req.body?.fullName, req.body?.role), 201);
}));
authRouter.post('/login', loginLimit, asyncRoute(async (req, res) => { sendSession(res, await authService.login(req.body?.email, req.body?.password)); }));
authRouter.get('/google/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const clientId = process.env.GOOGLE_CLIENT_ID || null;
  const nonce = clientId ? randomBytes(32).toString('base64url') : null;
  if (nonce) res.cookie('aita_google_nonce', nonce, { ...cookieOptions(), path: '/api/auth/google', maxAge: 10 * 60 * 1000 });
  res.json({ success: true, data: { clientId, nonce } });
});
authRouter.post('/google', loginLimit, asyncRoute(async (req, res) => {
  const nonce = req.cookies?.aita_google_nonce || '';
  res.clearCookie('aita_google_nonce', { ...cookieOptions(), path: '/api/auth/google' });
  sendSession(res, await authService.googleLogin(req.body?.credential, nonce, req.body?.password));
}));
authRouter.post('/refresh', asyncRoute(async (req, res) => { sendSession(res, await authService.refresh(req.cookies?.aita_refresh)); }));
authRouter.post('/logout', asyncRoute(async (req, res) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  await authService.logout(req.cookies?.aita_refresh, bearer || req.cookies?.aita_access);
  res.clearCookie('aita_access', { ...cookieOptions(), path: '/api' });
  res.clearCookie('aita_refresh', { ...cookieOptions(), path: '/api/auth' });
  res.json({ success: true });
}));
authRouter.get('/me', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId }, select: { id: true, email: true, role: true, fullName: true } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: user });
}));
