"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autogradingService = exports.AutogradingService = void 0;
const submission_repository_1 = require("./submission.repository");
const exam_repository_1 = require("../exams/exam.repository");
const docker_sandbox_service_1 = require("../../infrastructure/sandbox/docker-sandbox.service");
const submission_archive_1 = require("../../infrastructure/storage/submission-archive");
const bullmq_job_queue_1 = require("../../infrastructure/queue/bullmq-job-queue");
class AutogradingService {
    submissionRepo;
    examRepo;
    sandbox;
    queue;
    constructor(submissionRepo = submission_repository_1.submissionRepository, examRepo = exam_repository_1.examRepository, sandbox = docker_sandbox_service_1.dockerSandbox, queue = bullmq_job_queue_1.defaultJobQueue) {
        this.submissionRepo = submissionRepo;
        this.examRepo = examRepo;
        this.sandbox = sandbox;
        this.queue = queue;
    }
    async executeSubmission(submissionId) {
        const submission = await this.submissionRepo.findById(submissionId);
        if (!submission || ['COMPLETED', 'COMPILE_ERROR'].includes(submission.status))
            return;
        await this.submissionRepo.updateStatus(submissionId, 'RUNNING', { startedAt: new Date(), totalScore: 0 });
        try {
            const exam = await this.examRepo.findById(submission.examId, true);
            if (!exam)
                throw new Error('Exam not found.');
            let prepared;
            if (this.sandbox instanceof docker_sandbox_service_1.DockerSandboxService) {
                if (submission.artifactType !== 'ZIP')
                    throw new Error('Bài nộp cũ dùng mã nguồn dạng text. Vui lòng nộp lại bằng ZIP.');
                const bundle = await (0, submission_archive_1.loadBundle)(submission.sourceCodeUrl, submission.fileHashSha256, exam.allowedLanguage, submission.entrypoint);
                prepared = await this.sandbox.compile(bundle);
                await (0, submission_archive_1.writeSandboxLog)(submissionId, { stage: 'compile', ...prepared.compile });
                const compilation = prepared.compile;
                if (compilation.exitCode || compilation.timedOut || compilation.oom || compilation.outputTruncated) {
                    await this.submissionRepo.updateStatus(submissionId, 'COMPILE_ERROR', { completedAt: new Date(), totalScore: 0, compileMessage: (compilation.stderr + '\n' + compilation.stdout + (compilation.timedOut ? '\nCompiler exceeded 60s.' : '') + (compilation.oom ? '\nCompiler exceeded 512 MiB.' : '')).slice(0, 12000) });
                    await this.enqueueAst(submissionId);
                    return;
                }
            }
            const results = [];
            let totalScore = 0;
            for (const tc of exam.testCases || []) {
                const result = this.sandbox instanceof docker_sandbox_service_1.DockerSandboxService
                    ? await this.sandbox.executePrepared(prepared, tc.inputData, tc.expectedOutput, exam.timeLimitMs, exam.memoryLimitMb)
                    : await this.sandbox.execute(submission.sourceCodeUrl, exam.allowedLanguage, tc.inputData, tc.expectedOutput, exam.timeLimitMs);
                const scoreEarned = result.status === 'ACCEPTED' ? tc.scoreWeight : 0;
                totalScore += scoreEarned;
                results.push({ submissionId, testCaseId: tc.id, status: result.status, actualOutput: result.actualOutput, stderr: result.stderr, exitCode: result.exitCode, outputTruncated: result.outputTruncated || false, executionTimeMs: result.executionTimeMs, memoryUsedKb: result.memoryUsedKb, scoreEarned });
                await (0, submission_archive_1.writeSandboxLog)(submissionId, { stage: 'testcase', testCaseId: tc.id, isHidden: tc.isHidden, ...result });
            }
            await this.submissionRepo.saveTestResults(results);
            await this.submissionRepo.updateStatus(submissionId, 'COMPLETED', { completedAt: new Date(), totalScore: Math.round(totalScore * 100) / 100, compileMessage: prepared ? (prepared.compile.stderr + prepared.compile.stdout).slice(0, 12000) : '' });
            if (submission.artifactType === 'ZIP')
                await this.enqueueAst(submissionId);
        }
        catch (error) {
            await this.submissionRepo.updateStatus(submissionId, 'FAILED', { completedAt: new Date(), compileMessage: error.message.slice(0, 4000) });
            await (0, submission_archive_1.writeSandboxLog)(submissionId, { stage: 'error', message: error.message });
            throw error;
        }
    }
    async enqueueAst(submissionId) {
        try {
            await this.queue.addJob('plagiarism-queue', { submissionId });
        }
        catch (error) {
            console.error('[AST enqueue pending]', submissionId, error.message);
        }
    }
}
exports.AutogradingService = AutogradingService;
exports.autogradingService = new AutogradingService();
