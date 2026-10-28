export interface GenerateExamInput {
  topic: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  language?: 'PYTHON' | 'CSHARP' | 'JAVA';
  testCaseCount?: number;
  additionalRequirements?: string;
  materialContent?: string;
}

export interface GeneratedTestCase {
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
  scoreWeight: number;
  orderIndex: number;
  explanation?: string;
}

export interface GeneratedExamResult {
  title: string;
  descriptionMd: string;
  allowedLanguage: 'PYTHON' | 'CSHARP' | 'JAVA';
  timeLimitMs: number;
  memoryLimitMb: number;
  rubric: {
    totalPoints: number;
    items: Array<{
      criterion: string;
      weight: number;
      description: string;
    }>;
  };
  testCases: GeneratedTestCase[];
  modelUsed: string;
}

export interface GenerateRubricInput {
  title: string;
  descriptionMd: string;
  language?: string;
  maxScore?: number;
}

export interface GeneratedRubricResult {
  rubricMarkdown: string;
  items: Array<{
    criterion: string;
    weight: number;
    description: string;
  }>;
  totalPoints: number;
  modelUsed: string;
}

export interface ReviewCodeInput {
  submissionId: string;
  language: string;
  files: Array<{ path: string; content: string }>;
  examTitle?: string;
  examDescription?: string;
}

export interface CleanCodeReviewResult {
  cleanCodeScore: number;
  solidAnalysis: string;
  suggestions: string;
  codeSmells?: Array<{ line?: number; file?: string; smell: string; recommendation: string }>;
  modelUsed: string;
  tokensUsed: number;
}

export interface ExplainErrorInput {
  language: string;
  compileMessage: string;
  files?: Array<{ path: string; content: string }>;
}

export interface ErrorExplanationResult {
  summary: string;
  rootCause: string;
  errorLocation?: { file?: string; line?: number; column?: number };
  fixSteps: string[];
  fixedCodeExample?: string;
  tips?: string;
  modelUsed: string;
  tokensUsed: number;
}

export interface IAiProvider {
  name: string;
  isAvailable(): boolean;
  generateExam(input: GenerateExamInput): Promise<GeneratedExamResult>;
  generateRubric(input: GenerateRubricInput): Promise<GeneratedRubricResult>;
  reviewCleanCode(input: ReviewCodeInput): Promise<CleanCodeReviewResult>;
  explainCompilationError(input: ExplainErrorInput): Promise<ErrorExplanationResult>;
}
