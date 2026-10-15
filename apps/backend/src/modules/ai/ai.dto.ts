export interface GenerateExamDto {
  topic: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  language?: 'PYTHON' | 'CSHARP' | 'JAVA';
  testCaseCount?: number;
  additionalRequirements?: string;
}

export interface GenerateRubricDto {
  title: string;
  descriptionMd: string;
  language?: string;
  maxScore?: number;
}

export interface ExplainErrorDto {
  language: string;
  compileMessage: string;
}
