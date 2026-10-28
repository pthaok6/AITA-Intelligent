"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appealRouter = void 0;
const express_1 = require("express");
const appeal_service_1 = require("./appeal.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const http_1 = require("../../shared/http");
exports.appealRouter = (0, express_1.Router)();
// Student creates an appeal
exports.appealRouter.post('/', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const { submissionId, title, reason, expectedScore } = req.body;
    const appeal = await appeal_service_1.appealService.createAppeal(req.user.userId, {
        submissionId,
        title,
        reason,
        expectedScore: expectedScore !== undefined ? Number(expectedScore) : undefined,
    });
    res.status(201).json({ success: true, data: appeal, message: 'Đã gửi đơn khiếu nại thành công.' });
}));
// Student gets their own appeals
exports.appealRouter.get('/my', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const appeals = await appeal_service_1.appealService.getMyAppeals(req.user.userId);
    res.json({ success: true, data: appeals });
}));
// Get appeals for a specific submission
exports.appealRouter.get('/submission/:submissionId', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const appeals = await appeal_service_1.appealService.getSubmissionAppeals(String(req.params.submissionId), req.user.userId);
    res.json({ success: true, data: appeals });
}));
// Lecturer gets appeals inbox
exports.appealRouter.get('/lecturer', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    if (req.user.role === 'STUDENT') {
        throw new http_1.HttpError(403, 'Hộp thư giải quyết khiếu nại chỉ dành cho Giảng viên và Quản trị viên.');
    }
    const { status, classId, examId, round, targetRole } = req.query;
    const appeals = await appeal_service_1.appealService.getLecturerAppeals(req.user.userId, req.user.role, {
        status: status ? String(status) : undefined,
        classId: classId ? String(classId) : undefined,
        examId: examId ? String(examId) : undefined,
        round: round ? Number(round) : undefined,
        targetRole: targetRole ? String(targetRole) : undefined,
    });
    res.json({ success: true, data: appeals });
}));
// Get single appeal details
exports.appealRouter.get('/:id', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const appeal = await appeal_service_1.appealService.getAppealById(String(req.params.id), req.user.userId, req.user.role);
    res.json({ success: true, data: appeal });
}));
// Lecturer resolves an appeal
exports.appealRouter.patch('/:id/resolve', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    if (req.user.role === 'STUDENT') {
        throw new http_1.HttpError(403, 'Chỉ Giảng viên hoặc Quản trị viên mới có quyền giải quyết khiếu nại.');
    }
    const { status, decisionReason, newScore } = req.body;
    const updatedAppeal = await appeal_service_1.appealService.resolveAppeal(String(req.params.id), req.user.userId, req.user.role, {
        status,
        decisionReason,
        newScore: newScore !== undefined ? Number(newScore) : undefined,
    });
    res.json({ success: true, data: updatedAppeal, message: 'Đã cập nhật trạng thái khiếu nại.' });
}));
