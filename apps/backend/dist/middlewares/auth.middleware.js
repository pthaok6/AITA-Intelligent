"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.authenticateJwt = void 0;
const auth_service_1 = require("../modules/auth/auth.service");
const authenticateJwt = async (req, res, next) => {
    const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7) : req.cookies?.aita_access;
    if (!token) {
        res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' });
        return;
    }
    try {
        req.user = await auth_service_1.authService.authenticate(token);
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticateJwt = authenticateJwt;
const requireRoles = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
        return;
    }
    next();
};
exports.requireRoles = requireRoles;
