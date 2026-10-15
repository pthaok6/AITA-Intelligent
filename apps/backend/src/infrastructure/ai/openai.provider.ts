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
import { keyPool } from './key-pool';

export class OpenAIProvider implements IAiProvider {
  public readonly name = 'openai-gpt-4o';
  private model: string;

  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  public isAvailable(): boolean {
    return keyPool.getOpenAIKey() !== null;
  }

  private async callOpenAI(messages: Array<{ role: string; content: string }>): Promise<{ text: string; tokensUsed: number }> {
    const key = keyPool.getOpenAIKey();
    if (!key) throw new Error('Không có OpenAI API Key khả dụng.');

    const url = 'https://api.openai.com/v1/chat/completions';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isRateLimit = response.status === 429;
        keyPool.markOpenAIKeyFailed(key, isRateLimit);
        throw new Error(`OpenAI API Error (${response.status}): ${errorText.slice(0, 300)}`);
      }

      const data: any = await response.json();
      const text = data.choices?.[0]?.message?.content || '{}';
      const tokensUsed = data.usage?.total_tokens || 500;
      return { text, tokensUsed };
    } catch (err: any) {
      if (!err.message?.includes('OpenAI API Error')) {
        keyPool.markOpenAIKeyFailed(key, false);
      }
      throw err;
    }
  }

  public async generateExam(input: GenerateExamInput): Promise<GeneratedExamResult> {
    const prompt = `Soạn đề thi lập trình chuẩn FPT:
- Chủ đề: "${input.topic}"
- Độ khó: ${input.difficulty || 'MEDIUM'}
- Ngôn ngữ: ${input.language || 'PYTHON'}
- Số test cases: ${input.testCaseCount || 5}
${input.additionalRequirements ? `- Yêu cầu: ${input.additionalRequirements}` : ''}

Trả về JSON có cấu trúc:
{
  "title": "Tên bài thi",
  "descriptionMd": "Mô tả bài toán Markdown đầy đủ gồm bối cảnh, yêu cầu, input/output format, ví dụ và Barem điểm 10.0",
  "allowedLanguage": "${input.language || 'PYTHON'}",
  "timeLimitMs": 2000,
  "memoryLimitMb": 512,
  "rubric": {
    "totalPoints": 10.0,
    "items": [
      { "criterion": "Tiêu chí 1", "weight": 6.0, "description": "Mô tả" }
    ]
  },
  "testCases": [
    { "inputData": "input", "expectedOutput": "output", "isHidden": false, "scoreWeight": 2.0, "orderIndex": 1 }
  ]
}`;

    const { text } = await this.callOpenAI([
      { role: 'system', content: 'Bạn là chuyên gia sư phạm CNTT, thiết kế đề bài thuật toán kèm barem điểm.' },
      { role: 'user', content: prompt },
    ]);
    const parsed = JSON.parse(text);
    return {
      title: parsed.title,
      descriptionMd: parsed.descriptionMd,
      allowedLanguage: (input.language || 'PYTHON').toUpperCase() as any,
      timeLimitMs: parsed.timeLimitMs || 2000,
      memoryLimitMb: parsed.memoryLimitMb || 512,
      rubric: parsed.rubric || { totalPoints: 10, items: [] },
      testCases: (parsed.testCases || []).map((tc: any, i: number) => ({ ...tc, orderIndex: i + 1 })),
      modelUsed: this.name,
    };
  }

  public async generateRubric(input: GenerateRubricInput): Promise<GeneratedRubricResult> {
    const prompt = `Sinh barem điểm cho đề bài "${input.title}":
${input.descriptionMd.slice(0, 2000)}

Trả về JSON:
{
  "rubricMarkdown": "Bảng markdown barem điểm chi tiết",
  "items": [
    { "criterion": "Tiêu chí", "weight": 6.0, "description": "Mô tả" }
  ],
  "totalPoints": ${input.maxScore || 10.0}
}`;

    const { text } = await this.callOpenAI([
      { role: 'system', content: 'Bạn là chuyên gia thiết kế rubric chấm điểm đồ án phần mềm.' },
      { role: 'user', content: prompt },
    ]);
    const parsed = JSON.parse(text);
    return {
      rubricMarkdown: parsed.rubricMarkdown,
      items: parsed.items || [],
      totalPoints: parsed.totalPoints || input.maxScore || 10.0,
      modelUsed: this.name,
    };
  }

  public async reviewCleanCode(input: ReviewCodeInput): Promise<CleanCodeReviewResult> {
    const filesSnippet = input.files.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n');
    const prompt = `Review Semantic Clean Code cho bài nộp ngôn ngữ ${input.language}:
${filesSnippet.slice(0, 6000)}

Đánh giá Clean Code, SOLID, code smells. Trả về JSON:
{
  "cleanCodeScore": 8.0,
  "solidAnalysis": "Phân tích SOLID định dạng markdown...",
  "suggestions": "Gợi ý refactor định dạng markdown...",
  "codeSmells": [{ "line": 1, "smell": "Mô tả", "recommendation": "Khắc phục" }]
}`;

    const { text, tokensUsed } = await this.callOpenAI([
      { role: 'system', content: 'Bạn là Senior Software Engineer review Clean Code.' },
      { role: 'user', content: prompt },
    ]);
    const parsed = JSON.parse(text);
    return {
      cleanCodeScore: parsed.cleanCodeScore || 7.5,
      solidAnalysis: parsed.solidAnalysis || '',
      suggestions: parsed.suggestions || '',
      codeSmells: parsed.codeSmells || [],
      modelUsed: this.name,
      tokensUsed,
    };
  }

  public async explainCompilationError(input: ExplainErrorInput): Promise<ErrorExplanationResult> {
    const prompt = `Giải thích lỗi biên dịch sau bằng tiếng Việt tự nhiên dễ hiểu cho sinh viên:
Ngôn ngữ: ${input.language}
Lỗi compiler:
${input.compileMessage.slice(0, 3000)}

Trả về JSON:
{
  "summary": "Tóm tắt ngắn gọn",
  "rootCause": "Nguyên nhân cốt lõi",
  "errorLocation": { "file": "tên file", "line": 10 },
  "fixSteps": ["Bước 1", "Bước 2"],
  "fixedCodeExample": "Đoạn code sửa đúng",
  "tips": "Lời khuyên"
}`;

    const { text, tokensUsed } = await this.callOpenAI([
      { role: 'system', content: 'Bạn là giảng viên hướng dẫn sửa lỗi lập trình.' },
      { role: 'user', content: prompt },
    ]);
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || 'Lỗi biên dịch.',
      rootCause: parsed.rootCause || '',
      errorLocation: parsed.errorLocation,
      fixSteps: parsed.fixSteps || [],
      fixedCodeExample: parsed.fixedCodeExample,
      tips: parsed.tips,
      modelUsed: this.name,
      tokensUsed,
    };
  }
}
