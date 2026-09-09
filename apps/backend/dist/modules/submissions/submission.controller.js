"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionRouter = void 0;
const express_1 = require("express");
const submission_service_1 = require("./submission.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
exports.submissionRouter = (0, express_1.Router)();
// Sinh viên nộp bài cho Exam
exports.submissionRouter.post('/exams/:examId/submissions', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const { sourceCode } = req.body;
        if (!sourceCode || typeof sourceCode !== 'string') {
            res.status(400).json({ success: false, message: 'Vui lòng cung cấp nội dung mã nguồn sourceCode' });
            return;
        }
        const examId = req.params.examId;
        const submission = await submission_service_1.submissionService.submitCode(examId, req.user.userId, sourceCode);
        res.status(201).json({ success: true, data: submission });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
// Xem chi tiết bài nộp và kết quả chấm
exports.submissionRouter.get('/submissions/:id', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const submissionId = req.params.id;
        const submission = await submission_service_1.submissionService.getSubmission(submissionId);
        res.status(200).json({ success: true, data: submission });
    }
    catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
});
// Xem toàn bộ danh sách bài nộp của một Exam (Dành cho Giảng viên hoặc thống kê)
exports.submissionRouter.get('/exams/:examId/submissions', auth_middleware_1.authenticateJwt, async (req, res) => {
    try {
        const examId = req.params.examId;
        const submissions = await submission_service_1.submissionService.getSubmissionsByExam(examId);
        res.status(200).json({ success: true, data: submissions });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
