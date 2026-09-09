export interface SandboxExecutionResult {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED' | 'RUNTIME_ERROR';
  actualOutput: string;
  executionTimeMs: number;
  memoryUsedKb: number;
}

export interface ISandboxService {
  execute(
    code: string,
    language: string,
    inputData: string,
    expectedOutput: string,
    timeLimitMs: number
  ): Promise<SandboxExecutionResult>;
}
