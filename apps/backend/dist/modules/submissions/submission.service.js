"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionService = exports.SubmissionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const submission_repository_1 = require("./submission.repository");
const exam_repository_1 = require("../exams/exam.repository");
const in_memory_job_queue_1 = require("../../infrastructure/queue/in-memory-job-queue");
class SubmissionService {
    submissionRepo;
    examRepo;
    queue;
    constructor(submissionRepo = submission_repository_1.submissionRepository, examRepo = exam_repository_1.examRepository, queue = in_memory_job_queue_1.defaultJobQueue) {
        this.submissionRepo = submissionRepo;
        this.examRepo = examRepo;
        this.queue = queue;
    }
    async submitCode(examId, studentId, sourceCode) {
        const exam = await this.examRepo.findById(examId);
        if (!exam) {
            throw new Error('Không tìm thấy bài thi');
        }
        const now = new Date();
        if (now < exam.startTime) {
            throw new Error('Bài thi chưa bắt đầu');
        }
        if (now > exam.endTime) {
            throw new Error('Bài thi đã kết thúc, không thể nộp bài');
        }
        // Tính mã băm SHA-256 toàn vẹn cho mã nguồn
        const fileHashSha256 = crypto_1.default.createHash('sha256').update(sourceCode).digest('hex');
        // Lưu phiên nộp bài với trạng thái ban đầu là QUEUED
        const submission = await this.submissionRepo.create({
            examId,
            studentId,
            sourceCodeUrl: sourceCode, // Trong MVP lưu trực tiếp code để chạy tức thì
            fileHashSha256,
        });
        // Đẩy job vào IJobQueue
        await this.queue.addJob('grading-queue', { submissionId: submission.id });
        return submission;
    }
    async getSubmission(submissionId) {
        const submission = await this.submissionRepo.findById(submissionId);
        if (!submission) {
            throw new Error('Không tìm thấy thông tin bài nộp');
        }
        return submission;
    }
    async getSubmissionsByExam(examId) {
        return this.submissionRepo.findByExamId(examId);
    }
}
exports.SubmissionService = SubmissionService;
exports.submissionService = new SubmissionService();
