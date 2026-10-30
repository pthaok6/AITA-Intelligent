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

export function safeJsonParse<T = any>(raw: string): T {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // 1. Fix invalid escape sequences (e.g., \le, \ge, \O, \text, \ )
    let fixed = cleaned
      .replace(/\\\\/g, '\uE000')
      .replace(/\\([^"\/bfnrtu])/g, '$1')
      .replace(/\uE000/g, '\\\\');

    try {
      return JSON.parse(fixed);
    } catch (err2) {
      // 2. Also strip control characters (except common whitespace)
      fixed = fixed.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F]/g, '');
      return JSON.parse(fixed);
    }
  }
}

export class GeminiProvider implements IAiProvider {
  public name = 'gemini-3.5-flash-lite';
  private preferredModel: string;
  private fallbackModels: string[];

  constructor() {
    this.preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    this.name = this.preferredModel;
    const candidates = [
      this.preferredModel,
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemma-4-26b-a4b-it'
    ];
    this.fallbackModels = candidates.filter((m, idx, arr) => arr.indexOf(m) === idx);
  }

  public isAvailable(): boolean {
    return keyPool.getGeminiKey() !== null;
  }

  private async callGemini(prompt: string, systemInstruction?: string): Promise<{ text: string; tokensUsed: number }> {
    let lastError: Error | null = null;

    for (const modelName of this.fallbackModels) {
      const key = keyPool.getGeminiKey();
      if (!key) break;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      const payload: any = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429) {
            keyPool.markGeminiKeyFailed(key, true);
          }
          // If 503 (high demand), 429 (rate limit), 404 (deprecated), or 5xx (Google server error), auto-fallback to next model
          if ([404, 429, 500, 502, 503, 504].includes(response.status)) {
            console.warn(`[GeminiProvider] Model ${modelName} returned HTTP ${response.status}. Thử model dự phòng tiếp theo...`);
            lastError = new Error(`Gemini API Error (${response.status}): ${errorText.slice(0, 300)}`);
            continue;
          }
          throw new Error(`Gemini API Error (${response.status}): ${errorText.slice(0, 300)}`);
        }

        const data: any = await response.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || '{}';
        const tokensUsed = data.usageMetadata?.totalTokenCount || 500;
        this.name = modelName;

        return { text, tokensUsed };
      } catch (err: any) {
        lastError = err;
        if (/500|502|503|504|404|429/.test(err.message || '')) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('Tất cả các Gemini models đều không phản hồi.');
  }

  public async generateExam(input: GenerateExamInput): Promise<GeneratedExamResult> {
    const system = 'Bạn là chuyên gia sư phạm Công nghệ Thông tin tại Trường Đại học FPT, chuyên thiết kế đề thi và barem điểm thuật toán chuẩn mực theo phương pháp Project-Based Learning.';
    const prompt = `Hãy soạn một đề thi lập trình với các thông số sau:
- Chủ đề: "${input.topic}"
- Độ khó: ${input.difficulty || 'MEDIUM'}
- Ngôn ngữ lập trình: ${input.language || 'PYTHON'}
- Số lượng test case: ${input.testCaseCount || 5}
${input.additionalRequirements ? `- Yêu cầu bổ sung: ${input.additionalRequirements}` : ''}
${input.materialContent ? `- NỘI DUNG TÀI LIỆU / BÀI GIẢNG / SLIDE ĐÍNH KÈM (Hãy phân tích kỹ các khái niệm, cấu trúc dữ liệu và thuật toán trong tài liệu này để soạn đề bài và test cases bám sát trực tiếp):
"""
${input.materialContent}
"""` : ''}

LƯU Ý: Không dùng ký hiệu LaTeX dạng gạch chéo ngược (như \\le, \\ge, \\mathcal). Hãy viết O(N), <=, >= trực tiếp bằng văn bản thông thường.

Hãy trả về định dạng JSON thuần túy theo schema sau:
{
  "title": "Tên bài toán ngắn gọn, thu hút",
  "descriptionMd": "Nội dung đề bài hoàn chỉnh bằng định dạng Markdown (gồm Bối cảnh, Yêu cầu chi tiết, Định dạng Input/Output, Ví dụ minh họa có giải thích, Ràng buộc thời gian và bộ nhớ, và Bảng Barem điểm 10.0 chi tiết)",
  "allowedLanguage": "${input.language || 'PYTHON'}",
  "timeLimitMs": 2000,
  "memoryLimitMb": 512,
  "rubric": {
    "totalPoints": 10.0,
    "items": [
      { "criterion": "Tên tiêu chí", "weight": 6.0, "description": "Mô tả tiêu chí" },
      { "criterion": "Clean Code", "weight": 2.0, "description": "Mô tả tiêu chí" },
      { "criterion": "SOLID & Tách hàm", "weight": 1.0, "description": "Mô tả tiêu chí" },
      { "criterion": "Độ phức tạp thời gian/bộ nhớ", "weight": 1.0, "description": "Mô tả tiêu chí" }
    ]
  },
  "testCases": [
    {
      "inputData": "Dữ liệu đầu vào chuẩn xác",
      "expectedOutput": "Dữ liệu đầu ra tương ứng",
      "isHidden": false,
      "scoreWeight": 2.0,
      "orderIndex": 1,
      "explanation": "Giải thích ngắn"
    }
  ]
}`;

    const { text } = await this.callGemini(prompt, system);
    const parsed = safeJsonParse(text);
    return {
      title: parsed.title,
      descriptionMd: parsed.descriptionMd,
      allowedLanguage: (input.language || 'PYTHON').toUpperCase() as any,
      timeLimitMs: parsed.timeLimitMs || 2000,
      memoryLimitMb: parsed.memoryLimitMb || 512,
      rubric: parsed.rubric || { totalPoints: 10, items: [] },
      testCases: (parsed.testCases || []).map((tc: any, i: number) => ({
        ...tc,
        orderIndex: i + 1,
      })),
      modelUsed: this.name,
    };
  }

  public async generateRubric(input: GenerateRubricInput): Promise<GeneratedRubricResult> {
    const prompt = `Dựa vào đề bài thi lập trình sau:
Tiêu đề: "${input.title}"
Mô tả đề bài:
"""
${input.descriptionMd.slice(0, 2000)}
"""

Hãy sinh Barem điểm đánh giá (Rubric) chi tiết trên thang điểm ${input.maxScore || 10.0} điểm.
Barem phải phân bổ:
1. Điểm chức năng thuật toán (Test Cases): ~50-60%
2. Điểm Clean Code & Naming Convention: ~20%
3. Điểm SOLID & Cấu trúc hàm (Single Responsibility): ~10-15%
4. Điểm Tối ưu độ phức tạp thời gian & bộ nhớ: ~10%

Trả về JSON:
{
  "rubricMarkdown": "Bảng markdown chi tiết hiển thị cột Tiêu chí, Trọng số, Chuẩn đầu ra",
  "items": [
    { "criterion": "Tên tiêu chí", "weight": 6.0, "description": "Mô tả chi tiết" }
  ],
  "totalPoints": ${input.maxScore || 10.0}
}`;

    const { text } = await this.callGemini(prompt);
    const parsed = safeJsonParse(text);
    return {
      rubricMarkdown: parsed.rubricMarkdown,
      items: parsed.items || [],
      totalPoints: parsed.totalPoints || input.maxScore || 10.0,
      modelUsed: this.name,
    };
  }

  public async reviewCleanCode(input: ReviewCodeInput): Promise<CleanCodeReviewResult> {
    const system = 'Bạn là chuyên gia Senior Software Architect và Clean Code Reviewer. Nhiệm vụ của bạn là đánh giá mã nguồn của sinh viên công bằng, sâu sắc, tuân thủ nguyên lý SOLID và Clean Code.';
    const filesSnippet = input.files.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n');

    const prompt = `Hãy thực hiện Semantic Code Review cho bài làm sau:
Ngôn ngữ: ${input.language}
${input.examTitle ? `Đề bài: "${input.examTitle}"` : ''}

Mã nguồn nộp:
"""
${filesSnippet.slice(0, 6000)}
"""

Hãy đánh giá chi tiết:
1. Clean Code Score (thang điểm 0.0 đến 10.0): dựa trên đặt tên biến/hàm, độ dài hàm, magic numbers, DRY.
2. solidAnalysis: Phân tích các nguyên lý SOLID (đặc biệt là Single Responsibility Principle, tính đóng gói, tách bạch I/O và business logic).
3. suggestions: Các khuyến nghị cải tiến cụ thể kèm ví dụ code refactor mẫu.
4. codeSmells: Danh sách các điểm bốc mùi trong code (dòng, file, tên smell, cách sửa).

Trả về JSON thuần:
{
  "cleanCodeScore": 8.5,
  "solidAnalysis": "Phân tích chi tiết định dạng Markdown...",
  "suggestions": "Gợi ý cải tiến và code mẫu định dạng Markdown...",
  "codeSmells": [
    { "line": 12, "file": "main.py", "smell": "Tên biến 1 chữ cái", "recommendation": "Đổi thành maxElement" }
  ]
}`;

    const { text, tokensUsed } = await this.callGemini(prompt, system);
    const parsed = safeJsonParse(text);
    return {
      cleanCodeScore: typeof parsed.cleanCodeScore === 'number' ? parsed.cleanCodeScore : 8.0,
      solidAnalysis: parsed.solidAnalysis || '',
      suggestions: parsed.suggestions || '',
      codeSmells: parsed.codeSmells || [],
      modelUsed: this.name,
      tokensUsed,
    };
  }

  public async explainCompilationError(input: ExplainErrorInput): Promise<ErrorExplanationResult> {
    const system = 'Bạn là giảng viên Lập trình thân thiện, chuyên hướng dẫn sinh viên hiểu và sửa các lỗi biên dịch/runtime bằng ngôn ngữ tự nhiên dễ hiểu.';
    const prompt = `Sinh viên lập trình bằng ngôn ngữ ${input.language} và gặp lỗi biên dịch / runtime sau:
Thông báo lỗi từ Compiler:
"""
${input.compileMessage.slice(0, 3000)}
"""

${input.files && input.files.length > 0 ? `Đoạn mã nguồn liên quan:\n"""\n${input.files[0].content.slice(0, 2000)}\n"""` : ''}

Hãy giải nghĩa lỗi này và hướng dẫn sinh viên sửa lỗi.
Trả về JSON thuần:
{
  "summary": "Tóm tắt ngắn gọn lỗi là gì bằng tiếng Việt dễ hiểu",
  "rootCause": "Giải thích nguyên nhân cốt lõi dẫn đến lỗi",
  "errorLocation": { "file": "tên file nếu có", "line": 10 },
  "fixSteps": [
    "Bước 1: ...",
    "Bước 2: ..."
  ],
  "fixedCodeExample": "Đoạn code sửa đúng mẫu",
  "tips": "Lời khuyên để tránh gặp lại lỗi này"
}`;

    const { text, tokensUsed } = await this.callGemini(prompt, system);
    const parsed = safeJsonParse(text);
    return {
      summary: parsed.summary || 'Lỗi biên dịch mã nguồn.',
      rootCause: parsed.rootCause || '',
      errorLocation: parsed.errorLocation,
      fixSteps: Array.isArray(parsed.fixSteps) ? parsed.fixSteps : [],
      fixedCodeExample: parsed.fixedCodeExample,
      tips: parsed.tips,
      modelUsed: this.name,
      tokensUsed,
    };
  }
}
