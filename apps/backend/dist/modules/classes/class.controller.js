"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classRouter = void 0;
const express_1 = require("express");
const class_service_1 = require("./class.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const enums_1 = require("../../domain/enums");
const class_access_1 = require("./class-access");
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
exports.classRouter.post('/join', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.STUDENT), async (req, res) => {
    try {
        const classCode = req.body?.classCode;
        if (typeof classCode !== 'string' || !classCode.trim()) {
            res.status(400).json({ success: false, message: 'Vui lòng nhập mã lớp.' });
            return;
        }
        const cls = await class_service_1.classService.enrollByCode(classCode, req.user.userId);
        res.status(200).json({ success: true, data: cls, message: 'Đã tham gia lớp học.' });
    }
    catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message });
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
exports.classRouter.patch('/:id', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), async (req, res) => {
    try {
        await (0, class_access_1.classAccess)(String(req.params.id), req.user, true);
        const { classCode, name, semester } = req.body || {};
        if (![classCode, name, semester].every(value => typeof value === 'string')) {
            res.status(400).json({ success: false, message: 'Cần classCode, name và semester.' });
            return;
        }
        res.json({ success: true, data: await class_service_1.classService.updateClass(String(req.params.id), { classCode, name, semester }) });
    }
    catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message });
    }
});
exports.classRouter.delete('/:id', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), async (req, res) => {
    try {
        await (0, class_access_1.classAccess)(String(req.params.id), req.user, true);
        await class_service_1.classService.deleteClass(String(req.params.id));
        res.json({ success: true, message: 'Đã xóa lớp học.' });
    }
    catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message });
    }
});
// Chi tiết lớp học
exports.classRouter.get('/:id', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const classId = req.params.id;
        const cls = await class_service_1.classService.getClassDetails(classId, req.user);
        res.status(200).json({ success: true, data: cls });
    }
    catch (error) {
        res.status(error.status || 404).json({ success: false, message: error.message });
    }
});
// Sinh viên tham gia lớp học
exports.classRouter.post('/:id/enroll', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.STUDENT), async (req, res) => {
    try {
        const classId = req.params.id;
        await class_service_1.classService.enrollStudent(classId, req.user.userId);
        res.status(200).json({ success: true, message: 'Tham gia lớp học thành công' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
exports.classRouter.delete('/:id/enroll', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.STUDENT), async (req, res) => {
    try {
        await class_service_1.classService.dropStudent(String(req.params.id), req.user.userId);
        res.json({ success: true, message: 'Đã rời lớp học.' });
    }
    catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message });
    }
});
exports.classRouter.delete('/:id/students/:studentId', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), async (req, res) => {
    try {
        await (0, class_access_1.classAccess)(String(req.params.id), req.user, true);
        await class_service_1.classService.removeStudentFromClass(String(req.params.id), String(req.params.studentId));
        res.json({ success: true, message: 'Đã xóa sinh viên khỏi lớp.' });
    }
    catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message });
    }
});
exports.classRouter.patch('/:id/students/:studentId', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), async (req, res) => {
    try {
        await (0, class_access_1.classAccess)(String(req.params.id), req.user, true);
        const enrollment = await class_service_1.classService.reactivateStudent(String(req.params.id), String(req.params.studentId));
        res.json({ success: true, data: enrollment, message: 'Đã ghi danh sinh viên vào lớp.' });
    }
    catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message });
    }
});
