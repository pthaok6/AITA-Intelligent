import {
  IAiProvider,
  GenerateExamInput,
  GeneratedExamResult,
  GenerateRubricInput,
  GeneratedRubricResult,
  ReviewCodeInput,
  CleanCodeReviewResult,
  ExplainErrorInput,
  ErrorExplanationResult,
} from './ai.interface';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';
import { IntelligentLocalProvider } from './intelligent-local.provider';
import { keyPool } from './key-pool';

export class AiInfraService {
  private gemini: GeminiProvider;
  private openai: OpenAIProvider;
  private local: IntelligentLocalProvider;

  constructor() {
    this.gemini = new GeminiProvider();
    this.openai = new OpenAIProvider();
    this.local = new IntelligentLocalProvider();
  }

  private async executeWithFallback<T>(
    actionName: string,
    operation: (provider: IAiProvider) => Promise<T>
  ): Promise<T> {
    const preferred = (process.env.AI_PROVIDER || 'auto').toLowerCase();

    // 1. If explicitly configured or auto, try Gemini first if available
    if ((preferred === 'gemini' || preferred === 'auto') && this.gemini.isAvailable()) {
      try {
        return await operation(this.gemini);
      } catch (err: any) {
        console.warn(`[AI Service] Gemini failed for ${actionName}: ${err.message}. Chuyển sang fallback...`);
      }
    }

    // 2. Try OpenAI if available
    if ((preferred === 'openai' || preferred === 'auto') && this.openai.isAvailable()) {
      try {
        return await operation(this.openai);
      } catch (err: any) {
        console.warn(`[AI Service] OpenAI failed for ${actionName}: ${err.message}. Chuyển sang fallback...`);
      }
    }

    // 3. Fallback to Intelligent Local Engine
    return await operation(this.local);
  }

  public async generateExam(input: GenerateExamInput): Promise<GeneratedExamResult> {
    return this.executeWithFallback('generateExam', provider => provider.generateExam(input));
  }

  public async generateRubric(input: GenerateRubricInput): Promise<GeneratedRubricResult> {
    return this.executeWithFallback('generateRubric', provider => provider.generateRubric(input));
  }

  public async reviewCleanCode(input: ReviewCodeInput): Promise<CleanCodeReviewResult> {
    return this.executeWithFallback('reviewCleanCode', provider => provider.reviewCleanCode(input));
  }

  public async explainCompilationError(input: ExplainErrorInput): Promise<ErrorExplanationResult> {
    return this.executeWithFallback('explainCompilationError', provider => provider.explainCompilationError(input));
  }

  public getStatus() {
    const pool = keyPool.getStatus();
    return {
      geminiAvailable: this.gemini.isAvailable(),
      openaiAvailable: this.openai.isAvailable(),
      localAvailable: true,
      keyPool: pool,
    };
  }
}

export const aiInfraService = new AiInfraService();
