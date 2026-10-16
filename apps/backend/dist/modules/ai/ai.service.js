"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiModuleService = exports.AiModuleService = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
const ai_service_1 = require("../../infrastructure/ai/ai.service");
const submission_archive_1 = require("../../infrastructure/storage/submission-archive");
const http_1 = require("../../shared/http");
class AiModuleService {
    infra;
    constructor(infra = ai_service_1.aiInfraService) {
        this.infra = infra;
    }
    async generateExam(input) {
        if (!input.topic || !input.topic.trim()) {
            throw new http_1.HttpError(400, 'Vui lòng cung cấp chủ đề bài thi cần sinh.');
        }
        return this.infra.generateExam(input);
    }
    async generateRubric(input) {
        if (!input.title || !input.title.trim()) {
            throw new http_1.HttpError(400, 'Vui lòng cung cấp tiêu đề hoặc nội dung bài thi.');
        }
        return this.infra.generateRubric(input);
    }
    async explainError(language, compileMessage, files) {
        if (!compileMessage || !compileMessage.trim()) {
            throw new http_1.HttpError(400, 'Vui lòng cung cấp thông báo lỗi cần giải nghĩa.');
        }
        return this.infra.explainCompilationError({
            language: language || 'PYTHON',
            compileMessage,
            files,
        });
    }
    async reviewSubmission(submissionId) {
        const submission = await prisma_1.prisma.submission.findUnique({
            where: { id: submissionId },
            include: {
                exam: true,
                sourceFiles: true,
            },
        });
        if (!submission) {
            throw new http_1.HttpError(404, 'Không tìm thấy bài nộp để thực hiện AI Review.');
        }
        // Load source code files from ZIP archive if available
        let files = [];
        if (submission.artifactType === 'ZIP' && submission.sourceCodeUrl) {
            try {
                const bundle = await (0, submission_archive_1.loadBundle)(submission.sourceCodeUrl, submission.fileHashSha256, submission.exam.allowedLanguage, submission.entrypoint);
                files = bundle.files.map(f => ({
                    path: f.path,
                    content: f.data.toString('utf-8'),
                }));
            }
            catch (err) {
                console.warn(`[AI Review] Không thể giải nén bundle của submission ${submissionId}:`, err.message);
            }
        }
        // Run Semantic Clean Code review
        const cleanCode = await this.infra.reviewCleanCode({
            submissionId,
            language: submission.exam.allowedLanguage,
            files,
            examTitle: submission.exam.title,
            examDescription: submission.exam.descriptionMd,
        });
        // If there is compile error or message, explain it
        let errorExplanation = undefined;
        if (submission.status === 'COMPILE_ERROR' || (submission.compileMessage && submission.compileMessage.trim())) {
            try {
                errorExplanation = await this.infra.explainCompilationError({
                    language: submission.exam.allowedLanguage,
                    compileMessage: submission.compileMessage || '',
                    files,
                });
            }
            catch (err) {
                console.warn(`[AI Review] Không thể giải nghĩa lỗi compiler cho submission ${submissionId}:`, err.message);
            }
        }
        // Determine reviewRound
        const lastReview = await prisma_1.prisma.aIReview.findFirst({
            where: { submissionId },
            orderBy: { reviewRound: 'desc' },
            select: { reviewRound: true },
        });
        const reviewRound = (lastReview?.reviewRound || 0) + 1;
        // Save to database
        const saved = await prisma_1.prisma.aIReview.create({
            data: {
                submissionId,
                reviewRound,
                cleanCodeScore: cleanCode.cleanCodeScore,
                solidAnalysis: cleanCode.solidAnalysis,
                errorExplanation: errorExplanation ? JSON.stringify(errorExplanation) : null,
                suggestions: cleanCode.suggestions,
                tokensUsed: cleanCode.tokensUsed + (errorExplanation?.tokensUsed || 0),
                modelName: cleanCode.modelUsed,
            },
        });
        return { review: saved, cleanCode, errorExplanation };
    }
    async getReviewsBySubmission(submissionId) {
        return prisma_1.prisma.aIReview.findMany({
            where: { submissionId },
            orderBy: { reviewRound: 'desc' },
        });
    }
    getStatus() {
        return this.infra.getStatus();
    }
}
exports.AiModuleService = AiModuleService;
exports.aiModuleService = new AiModuleService();
