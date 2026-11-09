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
import { HttpError } from '../../shared/http';

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
    operation: (provider: IAiProvider) => Promise<T>,
    allowLocalFallback = true
  ): Promise<T> {
    const preferred = (process.env.AI_PROVIDER || 'auto').toLowerCase();
    const providerErrors: string[] = [];

    // 1. If explicitly configured or auto, try Gemini first if available
    if ((preferred === 'gemini' || preferred === 'auto') && this.gemini.isAvailable()) {
      try {
        return await operation(this.gemini);
      } catch (err: any) {
        const message = String(err?.message || 'Unknown error').replace(/(?:AQ\.[A-Za-z0-9._-]+|AIza[A-Za-z0-9_-]+)/g, '[API KEY]').slice(0, 600);
        providerErrors.push(`Gemini: ${message}`);
        console.warn(`[AI Service] Gemini failed for ${actionName}: ${message}`);
      }
    }

    // 2. Try OpenAI if available
    if ((preferred === 'openai' || preferred === 'auto') && this.openai.isAvailable()) {
      try {
        return await operation(this.openai);
      } catch (err: any) {
        const message = String(err?.message || 'Unknown error').replace(/(?:AQ\.[A-Za-z0-9._-]+|AIza[A-Za-z0-9_-]+)/g, '[API KEY]').slice(0, 600);
        providerErrors.push(`OpenAI: ${message}`);
        console.warn(`[AI Service] OpenAI failed for ${actionName}: ${message}`);
      }
    }

    // Code review must use a real model: the local engine is heuristic and
    // produces placeholder-like scores that should never be persisted as AI feedback.
    if (!allowLocalFallback) {
      const reason = providerErrors.length
        ? providerErrors.join(' | ')
        : `No provider is available. AI_PROVIDER=${preferred}; check keys on the Admin AI API Keys page.`;
      throw new HttpError(502, `AI review failed. ${reason}`);
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
    return this.executeWithFallback('reviewCleanCode', provider => provider.reviewCleanCode(input), false);
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
