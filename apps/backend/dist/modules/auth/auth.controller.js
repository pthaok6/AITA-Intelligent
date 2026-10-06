"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const express_rate_limit_1 = require("express-rate-limit");
const auth_service_1 = require("./auth.service");
const config_1 = require("../../config");
const http_1 = require("../../shared/http");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const prisma_1 = require("../../infrastructure/database/prisma");
exports.authRouter = (0, express_1.Router)();
const cookieOptions = () => ({ httpOnly: true, secure: (0, config_1.secureCookies)(), sameSite: 'strict' });
function sendSession(res, session, status = 200) {
    res.cookie('aita_access', session.token, { ...cookieOptions(), path: '/api', maxAge: auth_service_1.ACCESS_SECONDS * 1000 });
    res.cookie('aita_refresh', session.refreshToken, { ...cookieOptions(), path: '/api/auth', expires: session.expiresAt });
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json({ success: true, data: { user: session.user, token: session.token, expiresIn: auth_service_1.ACCESS_SECONDS } });
}
const loginLimit = (0, express_rate_limit_1.rateLimit)({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.' } });
exports.authRouter.post('/register', loginLimit, (0, http_1.asyncRoute)(async (req, res) => {
    sendSession(res, await auth_service_1.authService.register(req.body?.email, req.body?.password, req.body?.fullName, req.body?.role), 201);
}));
exports.authRouter.post('/login', loginLimit, (0, http_1.asyncRoute)(async (req, res) => { sendSession(res, await auth_service_1.authService.login(req.body?.email, req.body?.password)); }));
exports.authRouter.get('/google/config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const clientId = process.env.GOOGLE_CLIENT_ID || null;
    const nonce = clientId ? (0, node_crypto_1.randomBytes)(32).toString('base64url') : null;
    if (nonce)
        res.cookie('aita_google_nonce', nonce, { ...cookieOptions(), path: '/api/auth/google', maxAge: 10 * 60 * 1000 });
    res.json({ success: true, data: { clientId, nonce } });
});
exports.authRouter.post('/google', loginLimit, (0, http_1.asyncRoute)(async (req, res) => {
    const nonce = req.cookies?.aita_google_nonce || '';
    res.clearCookie('aita_google_nonce', { ...cookieOptions(), path: '/api/auth/google' });
    sendSession(res, await auth_service_1.authService.googleLogin(req.body?.credential, nonce, req.body?.password));
}));
exports.authRouter.post('/refresh', (0, http_1.asyncRoute)(async (req, res) => { sendSession(res, await auth_service_1.authService.refresh(req.cookies?.aita_refresh)); }));
exports.authRouter.post('/logout', (0, http_1.asyncRoute)(async (req, res) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    await auth_service_1.authService.logout(req.cookies?.aita_refresh, bearer || req.cookies?.aita_access);
    res.clearCookie('aita_access', { ...cookieOptions(), path: '/api' });
    res.clearCookie('aita_refresh', { ...cookieOptions(), path: '/api/auth' });
    res.json({ success: true });
}));
exports.authRouter.get('/me', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: req.user.userId }, select: { id: true, email: true, role: true, fullName: true } });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: user });
}));
