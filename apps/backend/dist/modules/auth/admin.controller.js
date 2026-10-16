"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const prisma_1 = require("../../infrastructure/database/prisma");
const http_1 = require("../../shared/http");
const auth_service_1 = require("./auth.service");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)('ADMIN'));
exports.adminRouter.get('/users', (0, http_1.asyncRoute)(async (_req, res) => {
    const users = await prisma_1.prisma.user.findMany({ orderBy: [{ createdAt: 'desc' }], select: { id: true, email: true, fullName: true, role: true, isActive: true, isApproved: true, createdAt: true } });
    res.json({ success: true, data: users });
}));
exports.adminRouter.post('/users', (0, http_1.asyncRoute)(async (req, res) => {
    const { email: emailInput, fullName, password, role } = req.body || {};
    const email = (0, auth_service_1.institutionalEmail)(emailInput);
    if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100)
        throw new http_1.HttpError(400, 'Họ tên cần từ 1 đến 100 ký tự.');
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72)
        throw new http_1.HttpError(400, 'Mật khẩu cần từ 8 ký tự và không quá 72 byte.');
    if (!['STUDENT', 'LECTURER', 'ADMIN'].includes(role))
        throw new http_1.HttpError(400, 'Vai trò không hợp lệ.');
    try {
        const user = await prisma_1.prisma.user.create({ data: { email, fullName: fullName.trim(), passwordHash: await bcryptjs_1.default.hash(password, 12), role }, select: { id: true, email: true, fullName: true, role: true, isActive: true, isApproved: true, createdAt: true } });
        res.status(201).json({ success: true, data: user });
    }
    catch (error) {
        if (error.code === 'P2002')
            throw new http_1.HttpError(409, 'Email đã được sử dụng.');
        throw error;
    }
}));
exports.adminRouter.patch('/users/:id', (0, http_1.asyncRoute)(async (req, res) => {
    const id = String(req.params.id);
    const { email: emailInput, fullName, role, isActive, isApproved, password } = req.body || {};
    const existing = await prisma_1.prisma.user.findUnique({ where: { id } });
    if (!existing)
        throw new http_1.HttpError(404, 'Không tìm thấy tài khoản.');
    const data = {};
    if (emailInput !== undefined)
        data.email = (0, auth_service_1.institutionalEmail)(emailInput);
    if (fullName !== undefined) {
        if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100)
            throw new http_1.HttpError(400, 'Họ tên cần từ 1 đến 100 ký tự.');
        data.fullName = fullName.trim();
    }
    if (role !== undefined) {
        if (!['STUDENT', 'LECTURER', 'ADMIN'].includes(role))
            throw new http_1.HttpError(400, 'Vai trò không hợp lệ.');
        data.role = role;
    }
    if (isActive !== undefined) {
        if (typeof isActive !== 'boolean')
            throw new http_1.HttpError(400, 'isActive phải là true hoặc false.');
        data.isActive = isActive;
    }
    if (isApproved !== undefined) {
        if (typeof isApproved !== 'boolean')
            throw new http_1.HttpError(400, 'isApproved phải là true hoặc false.');
        data.isApproved = isApproved;
    }
    if (password !== undefined) {
        if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72)
            throw new http_1.HttpError(400, 'Mật khẩu cần từ 8 ký tự và không quá 72 byte.');
        data.passwordHash = await bcryptjs_1.default.hash(password, 12);
    }
    const removingAdmin = existing.role === 'ADMIN' && (data.role !== undefined && data.role !== 'ADMIN' || data.isActive === false);
    if (removingAdmin) {
        if (id === req.user.userId)
            throw new http_1.HttpError(400, 'Không thể tự hạ quyền hoặc vô hiệu hóa tài khoản đang đăng nhập.');
        const activeAdmins = await prisma_1.prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
        if (existing.isActive && activeAdmins <= 1)
            throw new http_1.HttpError(409, 'Phải giữ lại ít nhất một quản trị viên đang hoạt động.');
    }
    try {
        const user = await prisma_1.prisma.user.update({ where: { id }, data: data, select: { id: true, email: true, fullName: true, role: true, isActive: true, isApproved: true, createdAt: true } });
        res.json({ success: true, data: user });
    }
    catch (error) {
        if (error.code === 'P2002')
            throw new http_1.HttpError(409, 'Email đã được sử dụng.');
        throw error;
    }
}));
// Soft-delete accounts so enrollments, submissions and grading evidence remain intact.
exports.adminRouter.delete('/users/:id', (0, http_1.asyncRoute)(async (req, res) => {
    const id = String(req.params.id);
    const user = await prisma_1.prisma.user.findUnique({ where: { id } });
    if (!user)
        throw new http_1.HttpError(404, 'Không tìm thấy tài khoản.');
    if (id === req.user.userId)
        throw new http_1.HttpError(400, 'Không thể vô hiệu hóa tài khoản đang đăng nhập.');
    if (user.role === 'ADMIN' && user.isActive && await prisma_1.prisma.user.count({ where: { role: 'ADMIN', isActive: true } }) <= 1)
        throw new http_1.HttpError(409, 'Phải giữ lại ít nhất một quản trị viên đang hoạt động.');
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({ where: { id }, data: { isActive: false } }),
        prisma_1.prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    res.json({ success: true, message: 'Đã vô hiệu hóa tài khoản.' });
}));
