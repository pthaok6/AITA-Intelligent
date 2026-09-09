"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.examRouter = void 0;
const express_1 = require("express");
const exam_service_1 = require("./exam.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const enums_1 = require("../../domain/enums");
exports.examRouter = (0, express_1.Router)();
// Lấy danh sách đề thi theo lớp
exports.examRouter.get('/class/:classId', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const classId = req.params.classId;
        const exams = await exam_service_1.examService.getExamsByClass(classId);
        res.status(200).json({ success: true, data: exams });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
// Giảng viên tạo đề thi
exports.examRouter.post('/', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), async (req, res) => {
    try {
        const { classId, title, descriptionMd, allowedLanguage, timeLimitMs, memoryLimitMb, startTime, endTime, testCases } = req.body;
        if (!classId || !title || !descriptionMd || !startTime || !endTime) {
            res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin bài thi bắt buộc' });
            return;
        }
        const exam = await exam_service_1.examService.createExam({
            classId,
            title,
            descriptionMd,
            allowedLanguage: allowedLanguage || 'PYTHON',
            timeLimitMs,
            memoryLimitMb,
            startTime,
            endTime,
            testCases,
        });
        res.status(201).json({ success: true, data: exam });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
// Xem chi tiết đề thi
exports.examRouter.get('/:id', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const examId = req.params.id;
        const isLecturer = req.user?.role === enums_1.UserRole.LECTURER || req.user?.role === enums_1.UserRole.ADMIN;
        const exam = await exam_service_1.examService.getExamById(examId, isLecturer);
        res.status(200).json({ success: true, data: exam });
    }
    catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
});
// Thêm test case vào bài thi
exports.examRouter.post('/:id/testcases', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), async (req, res) => {
    try {
        const examId = req.params.id;
        const { inputData, expectedOutput, isHidden, scoreWeight, orderIndex } = req.body;
        const tc = await exam_service_1.examService.addTestCase(examId, {
            inputData,
            expectedOutput,
            isHidden,
            scoreWeight,
            orderIndex: orderIndex ?? 1,
        });
        res.status(201).json({ success: true, data: tc });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
