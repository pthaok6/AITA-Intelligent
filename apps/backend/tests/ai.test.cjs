const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IntelligentLocalProvider } = require('../dist/infrastructure/ai/intelligent-local.provider');
const { KeyPool } = require('../dist/infrastructure/ai/key-pool');

const provider = new IntelligentLocalProvider();

test('AI Soạn đề bài - Sinh đề bài thuật toán BST chuẩn mực có đầy đủ bối cảnh, rubric và test cases', async () => {
  const result = await provider.generateExam({
    topic: 'Cây nhị phân tìm kiếm (BST)',
    difficulty: 'MEDIUM',
    language: 'PYTHON',
    testCaseCount: 5,
  });

  assert.ok(result.title.includes('Cây Nhị Phân Tìm Kiếm'), 'Tiêu đề phải phản ánh đúng chủ đề');
  assert.ok(result.descriptionMd.includes('Input'), 'Mô tả phải có phần Input');
  assert.ok(result.descriptionMd.includes('Output'), 'Mô tả phải có phần Output');
  assert.ok(result.descriptionMd.includes('BAREM ĐIỂM'), 'Mô tả phải có bảng barem điểm');
  assert.equal(result.allowedLanguage, 'PYTHON');
  assert.equal(result.timeLimitMs, 2000);
  assert.equal(result.memoryLimitMb, 512);

  // Kiểm tra bộ test cases
  assert.equal(result.testCases.length, 5, 'Phải sinh đúng 5 test cases');
  assert.equal(result.testCases[0].orderIndex, 1);
  assert.equal(typeof result.testCases[0].inputData, 'string');
  assert.equal(typeof result.testCases[0].expectedOutput, 'string');

  // Có cả test công khai và test ẩn
  const hasPublic = result.testCases.some(tc => !tc.isHidden);
  const hasHidden = result.testCases.some(tc => tc.isHidden);
  assert.ok(hasPublic, 'Phải có test case công khai');
  assert.ok(hasHidden, 'Phải có test case ẩn');

  // Kiểm tra rubric
  assert.equal(result.rubric.totalPoints, 10.0);
  assert.ok(result.rubric.items.length >= 3);
});

test('AI Soạn đề bài - Sinh đề bài sắp xếp QuickSort và bài toán Balo 0/1', async () => {
  const sortExam = await provider.generateExam({
    topic: 'Thuật toán sắp xếp nhanh (QuickSort)',
    difficulty: 'MEDIUM',
    language: 'JAVA',
  });
  assert.ok(sortExam.title.includes('QuickSort') || sortExam.title.includes('Sắp Xếp'));
  assert.equal(sortExam.allowedLanguage, 'JAVA');

  const dpExam = await provider.generateExam({
    topic: 'Quy hoạch động Cái túi (0-1 Knapsack)',
    difficulty: 'HARD',
    language: 'CSHARP',
  });
  assert.ok(dpExam.title.includes('Túi') || dpExam.title.includes('Knapsack'));
  assert.equal(dpExam.allowedLanguage, 'CSHARP');
});

test('AI Tự sinh barem điểm - Sinh barem điểm chuẩn 10.0 từ tiêu đề và mô tả đề bài', async () => {
  const rubricResult = await provider.generateRubric({
    title: 'Cài đặt Hàng đợi ưu tiên Heap',
    descriptionMd: 'Xây dựng cấu trúc dữ liệu Min-Heap cho phép chèn và lấy phần tử nhỏ nhất.',
    language: 'PYTHON',
    maxScore: 10.0,
  });

  assert.equal(rubricResult.totalPoints, 10.0);
  assert.ok(rubricResult.rubricMarkdown.includes('BAREM ĐIỂM ĐÁNH GIÁ'));
  assert.ok(rubricResult.rubricMarkdown.includes('Clean Code'));
  assert.ok(rubricResult.rubricMarkdown.includes('SOLID'));

  const totalWeight = rubricResult.items.reduce((sum, item) => sum + item.weight, 0);
  assert.equal(Math.round(totalWeight), 10.0, 'Tổng trọng số barem điểm phải bằng 10.0');
});

test('Semantic Code Review - Chấm điểm Clean Code và phát hiện code smells', async () => {
  const dirtyCode = `
def solve():
    a = 10000
    b = 20000
    c = a + b
    if c > 500:
        if c > 1000:
            if c > 2000:
                print("Too big")
    return c
`;

  const review = await provider.reviewCleanCode({
    submissionId: 'sub-test-1',
    language: 'PYTHON',
    files: [{ path: 'main.py', content: dirtyCode }],
    examTitle: 'Bài toán tính tổng',
  });

  assert.ok(review.cleanCodeScore >= 0 && review.cleanCodeScore <= 10.0);
  assert.ok(review.cleanCodeScore < 9.0, 'Code có biến 1 ký tự và magic numbers phải bị trừ điểm');
  assert.ok(review.solidAnalysis.length > 0);
  assert.ok(review.suggestions.includes('Refactor') || review.suggestions.includes('gợi ý') || review.suggestions.includes('Gợi ý'));
  assert.ok(review.codeSmells.length > 0, 'Phải phát hiện ít nhất 1 code smell');
});

test('Semantic Code Review - Code chất lượng cao đạt điểm Clean Code xuất sắc', async () => {
  const cleanCode = `
class MathCalculator:
    """Class cung cấp các hàm tính toán hình học cơ bản."""
    DEFAULT_SCALE_FACTOR = 1.0

    @staticmethod
    def calculate_circle_area(radius: float) -> float:
        import math
        if radius < 0:
            raise ValueError("Bán kính không được âm.")
        return math.pi * (radius ** 2)
`;

  const review = await provider.reviewCleanCode({
    submissionId: 'sub-test-clean',
    language: 'PYTHON',
    files: [{ path: 'calculator.py', content: cleanCode }],
    examTitle: 'Tính diện tích hình tròn',
  });

  assert.ok(review.cleanCodeScore >= 8.5, 'Code sạch, tuân thủ naming và SRP phải đạt điểm cao');
});

test('Giải nghĩa lỗi biên dịch - Python IndentationError và SyntaxError', async () => {
  const indentErr = `
  File "main.py", line 14
    print("Result:", total)
    ^
IndentationError: expected an indented block after 'if' statement on line 12
`;

  const explanation = await provider.explainCompilationError({
    language: 'PYTHON',
    compileMessage: indentErr,
  });

  assert.ok(explanation.summary.includes('thụt lề') || explanation.summary.includes('IndentationError'));
  assert.equal(explanation.errorLocation?.line, 14);
  assert.ok(explanation.fixSteps.length >= 2, 'Phải có hướng dẫn khắc phục từng bước');
  assert.ok(explanation.fixedCodeExample.length > 0, 'Phải có ví dụ code sửa đúng');

  const syntaxErr = `
  File "solution.py", line 8
    if a = b:
         ^
SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?
`;

  const syntaxExplanation = await provider.explainCompilationError({
    language: 'PYTHON',
    compileMessage: syntaxErr,
  });

  assert.ok(syntaxExplanation.summary.includes('cú pháp') || syntaxExplanation.summary.includes('SyntaxError'));
});

test('Giải nghĩa lỗi biên dịch - C# CS1002 và Java cannot find symbol', async () => {
  const csharpErr = `
Program.cs(15,22): error CS1002: ; expected [/app/solution.csproj]
`;

  const csExplanation = await provider.explainCompilationError({
    language: 'CSHARP',
    compileMessage: csharpErr,
  });

  assert.ok(csExplanation.summary.includes('chấm phẩy') || csExplanation.summary.includes('CS1002'));
  assert.equal(csExplanation.errorLocation?.line, 15);

  const javaErr = `
Main.java:7: error: cannot find symbol
        Scanner sc = new Scanner(System.in);
        ^
  symbol:   class Scanner
  location: class Main
1 error
`;

  const javaExplanation = await provider.explainCompilationError({
    language: 'JAVA',
    compileMessage: javaErr,
  });

  assert.ok(javaExplanation.summary.includes('không tìm thấy') || javaExplanation.summary.includes('cannot find symbol'));
  assert.ok(javaExplanation.fixSteps.some(step => step.includes('import java.util')));
});

test('KeyPool - Quản lý danh sách API key, xoay vòng và cooldown khi rate limit', () => {
  const originalGemini = process.env.GEMINI_API_KEYS;
  process.env.GEMINI_API_KEYS = 'key_alpha,key_beta,key_gamma';

  try {
    const pool = new KeyPool();
    const k1 = pool.getGeminiKey();
    const k2 = pool.getGeminiKey();
    const k3 = pool.getGeminiKey();

    assert.equal(k1, 'key_alpha');
    assert.equal(k2, 'key_beta');
    assert.equal(k3, 'key_gamma');

    // Sau khi hết 3 keys, quay lại key đầu tiên
    const k4 = pool.getGeminiKey();
    assert.equal(k4, 'key_alpha');

    // Giả lập key_alpha bị 429 RateLimit
    pool.markGeminiKeyFailed('key_alpha', true);
    const status = pool.getStatus();
    assert.equal(status.gemini.totalKeys, 3);
    assert.equal(status.gemini.availableKeys, 2, 'Key bị cooldown không nằm trong available');
  } finally {
    process.env.GEMINI_API_KEYS = originalGemini;
  }
});
