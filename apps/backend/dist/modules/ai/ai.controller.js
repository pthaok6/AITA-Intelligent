"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = void 0;
const express_1 = require("express");
const ai_service_1 = require("./ai.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const enums_1 = require("../../domain/enums");
const http_1 = require("../../shared/http");
const prisma_1 = require("../../infrastructure/database/prisma");
const class_access_1 = require("../classes/class-access");
exports.aiRouter = (0, express_1.Router)();
// Giảng viên / Admin yêu cầu AI soạn đề bài và bộ testcase kèm barem điểm
exports.aiRouter.post('/generate-exam', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), (0, http_1.asyncRoute)(async (req, res) => {
    const { topic, difficulty, language, testCaseCount, additionalRequirements } = req.body || {};
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
        throw new http_1.HttpError(400, 'Chủ đề đề thi không được để trống.');
    }
    const result = await ai_service_1.aiModuleService.generateExam({
        topic: topic.trim(),
        difficulty: difficulty || 'MEDIUM',
        language: language || 'PYTHON',
        testCaseCount: Number(testCaseCount) || 5,
        additionalRequirements: additionalRequirements ? String(additionalRequirements).trim() : undefined,
    });
    res.json({ success: true, data: result });
}));
// Giảng viên / Admin yêu cầu AI tự sinh hoặc chuẩn hóa barem điểm
exports.aiRouter.post('/generate-rubric', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.LECTURER, enums_1.UserRole.ADMIN), (0, http_1.asyncRoute)(async (req, res) => {
    const { title, descriptionMd, language, maxScore } = req.body || {};
    if (!title || !descriptionMd) {
        throw new http_1.HttpError(400, 'Tiêu đề và mô tả đề bài không được để trống.');
    }
    const result = await ai_service_1.aiModuleService.generateRubric({
        title: String(title).trim(),
        descriptionMd: String(descriptionMd).trim(),
        language: language || 'PYTHON',
        maxScore: Number(maxScore) || 10.0,
    });
    res.json({ success: true, data: result });
}));
// Giải nghĩa lỗi biên dịch bằng ngôn ngữ tự nhiên
exports.aiRouter.post('/explain-error', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const { language, compileMessage } = req.body || {};
    if (!compileMessage || typeof compileMessage !== 'string' || !compileMessage.trim()) {
        throw new http_1.HttpError(400, 'Nội dung thông báo lỗi không được để trống.');
    }
    const result = await ai_service_1.aiModuleService.explainError(language || 'PYTHON', compileMessage);
    res.json({ success: true, data: result });
}));
// Thực hiện hoặc kích hoạt lại Semantic Code Review cho bài nộp
exports.aiRouter.post('/review-submission/:id', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const submissionId = String(req.params.id);
    const submission = await prisma_1.prisma.submission.findUnique({
        where: { id: submissionId },
        include: { exam: true },
    });
    if (!submission) {
        throw new http_1.HttpError(404, 'Không tìm thấy bài nộp.');
    }
    // Permission check: Sinh viên là chủ bài nộp hoặc thành viên nhóm hoặc giảng viên của lớp
    if (req.user.role === enums_1.UserRole.STUDENT) {
        if (submission.studentId !== req.user.userId) {
            if (submission.teamId) {
                const membership = await prisma_1.prisma.teamMember.findUnique({
                    where: { teamId_studentId: { teamId: submission.teamId, studentId: req.user.userId } },
                });
                if (!membership) {
                    throw new http_1.HttpError(403, 'Bạn không có quyền yêu cầu review cho bài nộp của nhóm khác.');
                }
            }
            else {
                throw new http_1.HttpError(403, 'Bạn không có quyền yêu cầu review cho bài nộp của người khác.');
            }
        }
    }
    else {
        await (0, class_access_1.classAccess)(submission.exam.classId, req.user, true);
    }
    const reviewResult = await ai_service_1.aiModuleService.reviewSubmission(submissionId);
    res.json({ success: true, data: reviewResult });
}));
// Lấy danh sách AI Review của bài nộp
exports.aiRouter.get('/reviews/:submissionId', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const submissionId = String(req.params.submissionId);
    const submission = await prisma_1.prisma.submission.findUnique({
        where: { id: submissionId },
        include: { exam: true },
    });
    if (!submission) {
        throw new http_1.HttpError(404, 'Không tìm thấy bài nộp.');
    }
    if (req.user.role === enums_1.UserRole.STUDENT) {
        if (submission.studentId !== req.user.userId) {
            if (submission.teamId) {
                const membership = await prisma_1.prisma.teamMember.findUnique({
                    where: { teamId_studentId: { teamId: submission.teamId, studentId: req.user.userId } },
                });
                if (!membership) {
                    throw new http_1.HttpError(403, 'Không có quyền truy cập bài nộp này.');
                }
            }
            else {
                throw new http_1.HttpError(403, 'Không có quyền truy cập bài nộp này.');
            }
        }
    }
    else {
        await (0, class_access_1.classAccess)(submission.exam.classId, req.user, true);
    }
    const reviews = await ai_service_1.aiModuleService.getReviewsBySubmission(submissionId);
    res.json({ success: true, data: reviews });
}));
const key_pool_1 = require("../../infrastructure/ai/key-pool");
// Kiểm tra trạng thái hệ thống AI và Key Pool
exports.aiRouter.get('/config-status', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (_req, res) => {
    res.json({ success: true, data: ai_service_1.aiModuleService.getStatus() });
}));
// UC14 — Manage AI API Key Rotation (Admin endpoints)
exports.aiRouter.get('/admin/keys', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.ADMIN), (0, http_1.asyncRoute)(async (_req, res) => {
    res.json({ success: true, data: key_pool_1.keyPool.listKeys() });
}));
exports.aiRouter.post('/admin/keys', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.ADMIN), (0, http_1.asyncRoute)(async (req, res) => {
    const { provider, key, probeFirst } = req.body || {};
    if (!provider || !['gemini', 'openai'].includes(provider)) {
        throw new http_1.HttpError(400, 'Nhà cung cấp AI không hợp lệ (hỗ trợ gemini hoặc openai).');
    }
    const entry = await key_pool_1.keyPool.addCustomKey(provider, key, probeFirst !== false);
    res.status(201).json({ success: true, data: entry, message: 'Thêm Key vào Pool thành công.' });
}));
exports.aiRouter.delete('/admin/keys/:id', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.ADMIN), (0, http_1.asyncRoute)(async (req, res) => {
    const ok = key_pool_1.keyPool.removeKey(String(req.params.id));
    if (!ok)
        throw new http_1.HttpError(404, 'Không tìm thấy Key cần xóa.');
    res.json({ success: true, message: 'Đã xóa Key khỏi Pool.' });
}));
exports.aiRouter.post('/admin/keys/:id/reset', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.ADMIN), (0, http_1.asyncRoute)(async (req, res) => {
    const ok = key_pool_1.keyPool.resetKey(String(req.params.id));
    if (!ok)
        throw new http_1.HttpError(404, 'Không tìm thấy Key cần reset.');
    res.json({ success: true, message: 'Đã reset cooldown cho Key.' });
}));
exports.aiRouter.post('/admin/keys/:id/probe', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)(enums_1.UserRole.ADMIN), (0, http_1.asyncRoute)(async (req, res) => {
    const probe = await key_pool_1.keyPool.probeKey(String(req.params.id));
    res.json({ success: true, data: probe });
}));
