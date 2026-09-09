"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classRouter = void 0;
const express_1 = require("express");
const class_service_1 = require("./class.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const enums_1 = require("../../domain/enums");
exports.classRouter = (0, express_1.Router)();
// Lấy danh sách lớp học
exports.classRouter.get('/', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const classes = await class_service_1.classService.getMyClasses(req.user.userId, req.user.role);
        res.status(200).json({ success: true, data: classes });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
// Giảng viên tạo lớp học
exports.classRouter.post('/', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), async (req, res) => {
    try {
        const { classCode, name, semester } = req.body;
        if (!classCode || !name || !semester) {
            res.status(400).json({ success: false, message: 'Vui lòng cung cấp classCode, name, semester' });
            return;
        }
        const newClass = await class_service_1.classService.createClass(classCode, name, req.user.userId, semester);
        res.status(201).json({ success: true, data: newClass });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
// Chi tiết lớp học
exports.classRouter.get('/:id', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const classId = req.params.id;
        const cls = await class_service_1.classService.getClassDetails(classId);
        res.status(200).json({ success: true, data: cls });
    }
    catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
});
// Sinh viên tham gia lớp học
exports.classRouter.post('/:id/enroll', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const classId = req.params.id;
        await class_service_1.classService.enrollStudent(classId, req.user.userId);
        res.status(200).json({ success: true, message: 'Tham gia lớp học thành công' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
