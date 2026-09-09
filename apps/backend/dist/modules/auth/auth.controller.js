"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_service_1 = require("./auth.service");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/register', async (req, res) => {
    try {
        const { email, password, fullName, role } = req.body;
        if (!email || !password || !fullName) {
            res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ email, password và fullName' });
            return;
        }
        const result = await auth_service_1.authService.register(email, password, fullName, role);
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Lỗi đăng ký' });
    }
});
exports.authRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và password' });
            return;
        }
        const result = await auth_service_1.authService.login(email, password);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(401).json({ success: false, message: error.message || 'Lỗi đăng nhập' });
    }
});
