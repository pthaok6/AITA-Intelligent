import { prisma } from '../../infrastructure/database/prisma';
import { aiInfraService } from '../../infrastructure/ai/ai.service';
import {
  GenerateExamInput,
  GeneratedExamResult,
  GenerateRubricInput,
  GeneratedRubricResult,
  ErrorExplanationResult,
  CleanCodeReviewResult,
} from '../../infrastructure/ai/ai.interface';
import { loadBundle } from '../../infrastructure/storage/submission-archive';
import { HttpError } from '../../shared/http';

export class AiModuleService {
  constructor(private infra = aiInfraService) {}

  public async generateExam(input: GenerateExamInput): Promise<GeneratedExamResult> {
    if (!input.topic || !input.topic.trim()) {
      throw new HttpError(400, 'Vui lòng cung cấp chủ đề bài thi cần sinh.');
    }
    return this.infra.generateExam(input);
  }

  public async generateRubric(input: GenerateRubricInput): Promise<GeneratedRubricResult> {
    if (!input.title || !input.title.trim()) {
      throw new HttpError(400, 'Vui lòng cung cấp tiêu đề hoặc nội dung bài thi.');
    }
    return this.infra.generateRubric(input);
  }

  public async explainError(language: string, compileMessage: string, files?: Array<{ path: string; content: string }>): Promise<ErrorExplanationResult> {
    if (!compileMessage || !compileMessage.trim()) {
      throw new HttpError(400, 'Vui lòng cung cấp thông báo lỗi cần giải nghĩa.');
    }
    return this.infra.explainCompilationError({
      language: language || 'PYTHON',
      compileMessage,
      files,
    });
  }

  public async reviewSubmission(submissionId: string): Promise<{ review: any; cleanCode: CleanCodeReviewResult; errorExplanation?: ErrorExplanationResult }> {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        exam: true,
        sourceFiles: true,
      },
    });

    if (!submission) {
      throw new HttpError(404, 'Không tìm thấy bài nộp để thực hiện AI Review.');
    }

    // Load source code files from ZIP archive if available
    let files: Array<{ path: string; content: string }> = [];
    if (submission.artifactType === 'ZIP' && submission.sourceCodeUrl) {
      try {
        const bundle = await loadBundle(
          submission.sourceCodeUrl,
          submission.fileHashSha256,
          submission.exam.allowedLanguage,
          submission.entrypoint
        );
        files = bundle.files.map(f => ({
          path: f.path,
          content: f.data.toString('utf-8'),
        }));
      } catch (err: any) {
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
    let errorExplanation: ErrorExplanationResult | undefined = undefined;
    if (submission.status === 'COMPILE_ERROR' || (submission.compileMessage && submission.compileMessage.trim())) {
      try {
        errorExplanation = await this.infra.explainCompilationError({
          language: submission.exam.allowedLanguage,
          compileMessage: submission.compileMessage || '',
          files,
        });
      } catch (err: any) {
        console.warn(`[AI Review] Không thể giải nghĩa lỗi compiler cho submission ${submissionId}:`, err.message);
      }
    }

    // Determine reviewRound
    const lastReview = await prisma.aIReview.findFirst({
      where: { submissionId },
      orderBy: { reviewRound: 'desc' },
      select: { reviewRound: true },
    });
    const reviewRound = (lastReview?.reviewRound || 0) + 1;

    // Save to database
    const saved = await prisma.aIReview.create({
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

  public async getReviewsBySubmission(submissionId: string) {
    return prisma.aIReview.findMany({
      where: { submissionId },
      orderBy: { reviewRound: 'desc' },
    });
  }

  public getStatus() {
    return this.infra.getStatus();
  }
}

export const aiModuleService = new AiModuleService();
