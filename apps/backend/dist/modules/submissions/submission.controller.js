"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const submission_service_1 = require("./submission.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const class_access_1 = require("../classes/class-access");
const exam_service_1 = require("../exams/exam.service");
const http_1 = require("../../shared/http");
const submission_archive_1 = require("../../infrastructure/storage/submission-archive");
const prisma_1 = require("../../infrastructure/database/prisma");
exports.submissionRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: submission_archive_1.ZIP_LIMIT, files: 1, fields: 1, fieldSize: 512, parts: 2 },
    fileFilter: (_req, file, done) => /\.zip$/i.test(file.originalname) ? done(null, true) : done(new http_1.HttpError(400, 'Chỉ nhận bài nộp .zip.')) });
exports.submissionRouter.post('/exams/:examId/submissions', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, _res, next) => { await submission_service_1.submissionService.authorizeSubmission(String(req.params.examId), req.user.userId); next(); }), upload.single('file'), (0, http_1.asyncRoute)(async (req, res) => {
    if (!req.file)
        throw new http_1.HttpError(400, 'Gửi ZIP ở trường file, dùng multipart/form-data.');
    const submission = await submission_service_1.submissionService.submitArchive(String(req.params.examId), req.user.userId, req.file.buffer, req.file.originalname, req.body.entrypoint);
    res.status(201).json({ success: true, data: { ...submission, sourceCodeUrl: undefined } });
}));
async function authorizedSubmission(req) {
    const submission = await submission_service_1.submissionService.getSubmission(String(req.params.id));
    if (submission.studentId !== req.user.userId)
        await (0, class_access_1.classAccess)(submission.exam.classId, req.user, true);
    return submission;
}
exports.submissionRouter.get('/submissions/:id/archive', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res, next) => {
    const submission = await authorizedSubmission(req);
    if (submission.artifactType !== 'ZIP')
        throw new http_1.HttpError(404, 'Bài nộp cũ không có ZIP.');
    res.download((0, submission_archive_1.archivePath)(submission.sourceCodeUrl), 'submission-' + submission.id + '.zip', error => { if (error)
        next(error); });
}));
exports.submissionRouter.get('/submissions/:id', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const submission = await authorizedSubmission(req);
    const studentView = req.user.role === 'STUDENT';
    res.json({ success: true, data: { ...submission, sourceCodeUrl: undefined,
            testResults: submission.testResults.map(result => studentView && result.testCase.isHidden ? { ...result, actualOutput: null, stderr: null } : result) } });
}));
exports.submissionRouter.get('/exams/:examId/submissions', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const exam = await exam_service_1.examService.getExamById(String(req.params.examId));
    await (0, class_access_1.classAccess)(exam.classId, req.user, true);
    res.json({ success: true, data: (await submission_service_1.submissionService.getSubmissionsByExam(exam.id)).map(submission => ({ ...submission, sourceCodeUrl: undefined })) });
}));
exports.submissionRouter.get('/exams/:examId/plagiarism', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const exam = await exam_service_1.examService.getExamById(String(req.params.examId));
    await (0, class_access_1.classAccess)(exam.classId, req.user, true);
    const reports = await prisma_1.prisma.plagiarismReport.findMany({ where: { examId: exam.id }, orderBy: { similarityScore: 'desc' },
        include: { submissionA: { select: { id: true, student: { select: { fullName: true, email: true } } } }, submissionB: { select: { id: true, student: { select: { fullName: true, email: true } } } } } });
    res.json({ success: true, data: reports });
}));
exports.submissionRouter.get('/submissions/:id/fingerprints', auth_middleware_1.authenticateJwt, (0, http_1.asyncRoute)(async (req, res) => {
    const submission = await authorizedSubmission(req);
    const fingerprints = await prisma_1.prisma.aSTFingerprint.findMany({ where: { submissionId: submission.id }, orderBy: [{ sourcePath: 'asc' }, { tokenStart: 'asc' }], take: 1000 });
    res.json({ success: true, data: { total: submission._count.fingerprints, limit: 1000, items: fingerprints.map(fp => ({ ...fp, hashValue: fp.hashValue.toString() })) } });
}));
