"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionService = exports.SubmissionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const submission_repository_1 = require("./submission.repository");
const exam_repository_1 = require("../exams/exam.repository");
const bullmq_job_queue_1 = require("../../infrastructure/queue/bullmq-job-queue");
const prisma_1 = require("../../infrastructure/database/prisma");
const http_1 = require("../../shared/http");
const submission_archive_1 = require("../../infrastructure/storage/submission-archive");
class SubmissionService {
    submissionRepo;
    examRepo;
    queue;
    constructor(submissionRepo = submission_repository_1.submissionRepository, examRepo = exam_repository_1.examRepository, queue = bullmq_job_queue_1.defaultJobQueue) {
        this.submissionRepo = submissionRepo;
        this.examRepo = examRepo;
        this.queue = queue;
    }
    async authorizeSubmission(examId, studentId) {
        const exam = await this.examRepo.findById(examId);
        if (!exam)
            throw new http_1.HttpError(404, 'Không tìm thấy bài thi.');
        const enrollment = await prisma_1.prisma.classEnrollment.findUnique({ where: { classId_studentId: { classId: exam.classId, studentId } } });
        const student = await prisma_1.prisma.user.findUnique({ where: { id: studentId } });
        if (!enrollment || enrollment.status !== 'ACTIVE' || student?.role !== 'STUDENT')
            throw new http_1.HttpError(403, 'Chỉ sinh viên đang học trong lớp được nộp bài.');
        if (new Date() < exam.startTime || new Date() >= exam.endTime)
            throw new http_1.HttpError(400, 'Bài thi chưa bắt đầu hoặc đã kết thúc.');
        let teamId = undefined;
        if (exam.examType === 'GROUP') {
            const team = await prisma_1.prisma.team.findFirst({
                where: { examId, members: { some: { studentId } } },
                include: { members: { where: { studentId } } },
            });
            if (!team) {
                throw new http_1.HttpError(403, 'Bài thi này là bài tập nhóm. Bạn cần tham gia một nhóm trước khi nộp bài.');
            }
            const membership = team.members[0];
            if (!membership || membership.role !== 'LEADER') {
                throw new http_1.HttpError(403, 'Chỉ Trưởng nhóm (Team Leader) mới có quyền nộp bài cho nhóm (BR-11).');
            }
            teamId = team.id;
        }
        return { exam, teamId };
    }
    async enqueue(submission) {
        try {
            await this.queue.addJob('grading-queue', { submissionId: submission.id });
        }
        catch (error) {
            console.error('[Submission enqueue pending]', submission.id, error.message);
            return { ...submission, queuePending: true };
        }
        return submission;
    }
    async submitArchive(examId, studentId, bytes, filename, entrypoint) {
        if (entrypoint !== undefined && typeof entrypoint !== 'string')
            throw new http_1.HttpError(400, 'Entrypoint phải là chuỗi.');
        const { exam, teamId } = await this.authorizeSubmission(examId, studentId);
        const bundle = (0, submission_archive_1.selectBundle)(await (0, submission_archive_1.readZip)(bytes), exam.allowedLanguage, entrypoint);
        const stored = await (0, submission_archive_1.persistArchive)(bytes);
        const submission = await this.submissionRepo.create({
            examId, studentId, teamId, sourceCodeUrl: stored.key, fileHashSha256: stored.hash,
            artifactType: 'ZIP', originalFilename: filename.slice(0, 200), entrypoint: bundle.entrypoint,
            sourceFiles: bundle.files.map(file => ({ path: file.path, size: file.data.length })),
        });
        return this.enqueue(submission);
    }
    // Compatibility for explicit mock tests only. The HTTP API accepts ZIP exclusively.
    async submitCode(examId, studentId, sourceCode) {
        const { teamId } = await this.authorizeSubmission(examId, studentId);
        const submission = await this.submissionRepo.create({ examId, studentId, teamId, sourceCodeUrl: sourceCode, fileHashSha256: crypto_1.default.createHash('sha256').update(sourceCode).digest('hex'), artifactType: 'LEGACY_TEXT', astStatus: 'SKIPPED' });
        return this.enqueue(submission);
    }
    async getSubmission(id) {
        const result = await this.submissionRepo.findById(id);
        if (!result)
            throw new http_1.HttpError(404, 'Không tìm thấy bài nộp.');
        return result;
    }
    async getLatestSubmissionId(examId, studentId) {
        return (await this.submissionRepo.findLatestForStudent(examId, studentId))?.id;
    }
    async getSubmissionsByExam(examId, studentId) { return this.submissionRepo.findByExamId(examId, studentId); }
}
exports.SubmissionService = SubmissionService;
exports.submissionService = new SubmissionService();
