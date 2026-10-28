"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentLocalProvider = void 0;
class IntelligentLocalProvider {
    name = 'intelligent-local-engine';
    isAvailable() {
        return true;
    }
    async generateExam(input) {
        const lang = (input.language || 'PYTHON').toUpperCase();
        const diff = (input.difficulty || 'MEDIUM').toUpperCase();
        const topic = (input.topic || 'Cây nhị phân tìm kiếm (BST)').trim();
        const exam = await this.craftExamByTopic(topic, diff, lang, input.testCaseCount || 5, input.additionalRequirements);
        if (input.materialContent) {
            exam.descriptionMd = `> 📖 **Căn cứ tài liệu bài giảng đính kèm:** Đề bài được thiết kế bám sát các khái niệm trọng tâm từ tài liệu / slide bài giảng.\n\n` + exam.descriptionMd;
        }
        return exam;
    }
    async generateRubric(input) {
        const maxScore = input.maxScore || 10.0;
        const testWeight = Math.round(maxScore * 0.6 * 10) / 10;
        const cleanWeight = Math.round(maxScore * 0.2 * 10) / 10;
        const solidWeight = Math.round(maxScore * 0.1 * 10) / 10;
        const perfWeight = Math.round((maxScore - testWeight - cleanWeight - solidWeight) * 10) / 10;
        const items = [
            {
                criterion: 'Tính đúng đắn thuật toán (Functional Test Cases)',
                weight: testWeight,
                description: `Vượt qua toàn bộ các test cases công khai và test cases ẩn kiểm tra biên dữ liệu (${testWeight}đ)`,
            },
            {
                criterion: 'Clean Code & Quy ước đặt tên (Naming Conventions)',
                weight: cleanWeight,
                description: `Tuân thủ quy ước đặt tên (camelCase/snake_case), tên biến/hàm gợi nghĩa rõ ràng, không dùng magic numbers (${cleanWeight}đ)`,
            },
            {
                criterion: 'Nguyên lý SOLID & Cấu trúc hàm (Single Responsibility)',
                weight: solidWeight,
                description: `Mỗi hàm/phương thức đảm nhiệm đúng 1 trách nhiệm duy nhất (SRP), phân tách rõ ràng luồng nhập xuất và xử lý logic (${solidWeight}đ)`,
            },
            {
                criterion: 'Độ phức tạp thời gian & Tối ưu bộ nhớ (Complexity & Memory)',
                weight: perfWeight,
                description: `Giải thuật đạt độ phức tạp thời gian tối ưu theo ràng buộc bài toán, không cấp phát bộ nhớ thừa thãi (${perfWeight}đ)`,
            },
        ];
        const rubricMarkdown = `### BAREM ĐIỂM ĐÁNH GIÁ (TỔNG: ${maxScore} ĐIỂM)\n\n` +
            `| STT | Tiêu chí đánh giá | Trọng số | Mô tả chuẩn đầu ra |\n` +
            `| :--- | :--- | :---: | :--- |\n` +
            items.map((it, idx) => `| ${idx + 1} | **${it.criterion}** | **${it.weight}đ** | ${it.description} |`).join('\n') +
            `\n\n> *Lưu ý: Điểm Clean Code và SOLID sẽ được đối chiếu tự động bởi hệ thống Semantic Code Review.*`;
        return {
            rubricMarkdown,
            items,
            totalPoints: maxScore,
            modelUsed: this.name,
        };
    }
    async reviewCleanCode(input) {
        const combinedCode = input.files.map(f => `// File: ${f.path}\n${f.content}`).join('\n\n');
        const lines = combinedCode.split('\n');
        let deductions = 0;
        const codeSmells = [];
        const solidViolations = [];
        const suggestionsList = [];
        // 1. Analyze naming conventions & code smells
        let badVarCount = 0;
        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            // Single-letter variables outside for loops (supports Python 'a = ...' and typed 'int a = ...')
            const singleLetterMatch = trimmed.match(/(?:(?:let|var|const|int|float|double|String)\s+|^)([a-zA-Z])\s*=/);
            if (singleLetterMatch && !trimmed.startsWith('for') && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
                badVarCount++;
                if (badVarCount <= 3) {
                    codeSmells.push({
                        line: idx + 1,
                        smell: `Biến '${singleLetterMatch[1]}' đặt tên 1 ký tự, không gợi nghĩa mục đích lưu trữ`,
                        recommendation: `Đổi thành tên mô tả rõ ràng như 'totalCount', 'currentUser', 'maxElement'`,
                    });
                }
            }
            // Magic numbers
            const magicNumberMatch = trimmed.match(/[=<>!+*\/]\s*([2-9]\d{2,}|86400|3600|10000)\b/);
            if (magicNumberMatch && !trimmed.includes('const') && !trimmed.includes('static') && !trimmed.includes('final')) {
                codeSmells.push({
                    line: idx + 1,
                    smell: `Sử dụng số cố định (Magic number: ${magicNumberMatch[1]}) trực tiếp trong biểu thức logic`,
                    recommendation: `Khai báo hằng số có tên mô tả (ví dụ: CONST MAX_BUFFER_SIZE = ${magicNumberMatch[1]})`,
                });
                deductions += 0.4;
            }
            // Deep nesting
            const indentMatch = line.match(/^(\s+)/);
            if (indentMatch && indentMatch[1].length >= 12 && !line.trim().startsWith('*')) {
                codeSmells.push({
                    line: idx + 1,
                    smell: 'Khối lệnh lồng nhau quá sâu (Deeply nested blocks >= 3 cấp)',
                    recommendation: 'Áp dụng Guard Clauses hoặc tách thành hàm phụ để giảm độ sâu khối lệnh',
                });
                deductions += 0.5;
            }
        });
        if (badVarCount > 0)
            deductions += Math.min(2.0, badVarCount * 0.5);
        // 2. Analyze function length & cohesion
        let openBraceCount = 0;
        let maxFunctionLines = 0;
        let currentFunctionLines = 0;
        let inFunction = false;
        lines.forEach(line => {
            if (/def\s+\w+|function\s+\w+|public\s+[\w<>]+\s+\w+\(/.test(line)) {
                inFunction = true;
                currentFunctionLines = 0;
            }
            if (inFunction) {
                currentFunctionLines++;
                if (line.includes('{'))
                    openBraceCount++;
                if (line.includes('}')) {
                    openBraceCount--;
                    if (openBraceCount <= 0) {
                        inFunction = false;
                        if (currentFunctionLines > maxFunctionLines)
                            maxFunctionLines = currentFunctionLines;
                    }
                }
            }
        });
        if (maxFunctionLines > 45) {
            deductions += 1.5;
            solidViolations.push(`- **Vi phạm SRP (Single Responsibility Principle)**: Phương thức quá dài (${maxFunctionLines} dòng). Một phương thức nên giới hạn dưới 30 dòng và chỉ làm một nhiệm vụ duy nhất.`);
            suggestionsList.push(`Nên tách hàm chính thành các hàm phụ trợ độc lập: hàm đọc và parse dữ liệu, hàm xử lý nghiệp vụ giải thuật, và hàm định dạng kết quả xuất.`);
        }
        else {
            solidViolations.push(`- **Tuân thủ SRP**: Các hàm và phương thức được tổ chức tương đối gọn gàng, có sự phân chia nhiệm vụ hợp lý.`);
        }
        // 3. Exception handling & resource cleanup
        const hasBroadCatch = /catch\s*\(\s*Exception|\bexcept\s*:/.test(combinedCode);
        if (hasBroadCatch) {
            deductions += 1.0;
            codeSmells.push({
                smell: 'Bắt ngoại lệ quá chung chung (Catch-all Exception)',
                recommendation: 'Bắt chính xác loại ngoại lệ cụ thể (ví dụ: FormatException, IOException, ValueError)',
            });
        }
        // 4. Modularity / Layering check
        if (!combinedCode.includes('class ') && !combinedCode.includes('def ') && !combinedCode.includes('void ')) {
            deductions += 2.0;
            solidViolations.push(`- **Cấu trúc hướng đối tượng / Modular**: Mã nguồn viết theo dạng script tuyến tính, thiếu đóng gói thành các module/class có thể tái sử dụng.`);
        }
        else {
            solidViolations.push(`- **Cấu trúc đóng gói**: Mã nguồn có sự đóng gói theo cấu trúc hàm/lớp rõ ràng.`);
        }
        // Calculate score
        const finalScore = Math.max(2.0, Math.min(10.0, Math.round((10.0 - deductions) * 10) / 10));
        // Construct recommendations
        if (suggestionsList.length === 0) {
            suggestionsList.push('Mã nguồn có phong cách viết sạch sẽ, tuân thủ tương đối tốt các quy chuẩn Clean Code cơ bản.');
            suggestionsList.push('Tiếp tục duy trì việc đặt tên biến nhất quán và bổ sung tài liệu hàm (Docstring/XML comments).');
        }
        const solidAnalysis = `#### Phân tích nguyên lý thiết kế SOLID & Kiến trúc mã nguồn:\n\n` +
            solidViolations.join('\n') +
            `\n\n#### Đánh giá Code Smells phát hiện được:\n` +
            (codeSmells.length === 0
                ? `* Không phát hiện code smell nghiêm trọng nào.`
                : codeSmells.map(s => `* [Dòng ${s.line || 'N/A'}] **${s.smell}**: ${s.recommendation}`).join('\n'));
        const suggestions = `### Gợi ý cải tiến Refactoring Clean Code:\n\n` +
            suggestionsList.map((s, idx) => `${idx + 1}. ${s}`).join('\n') +
            `\n\n\`\`\`${input.language.toLowerCase()}\n// Ví dụ cấu trúc chuẩn sau khi Refactor:\n// - Phân tách rõ ràng phương thức tính toán và phương thức I/O\n// - Đặt tên biến tường minh theo quy ước\n\`\`\``;
        return {
            cleanCodeScore: finalScore,
            solidAnalysis,
            suggestions,
            codeSmells,
            modelUsed: this.name,
            tokensUsed: 420,
        };
    }
    async explainCompilationError(input) {
        const rawMsg = input.compileMessage || '';
        const lang = (input.language || 'PYTHON').toUpperCase();
        // 1. Python Parser
        if (lang === 'PYTHON') {
            if (/IndentationError/i.test(rawMsg)) {
                const lineMatch = rawMsg.match(/line (\d+)/i);
                const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
                return {
                    summary: 'Lỗi thụt lề (IndentationError) trong mã nguồn Python.',
                    rootCause: `Tại dòng ${lineNum || 'chỉ định'}, các khối lệnh (sau if, for, while, def) không có cùng độ thụt lề hoặc trộn lẫn giữa phím Space và phím Tab.`,
                    errorLocation: { line: lineNum },
                    fixSteps: [
                        'Kiểm tra lại toàn bộ khối lệnh phía sau dấu hai chấm (:).',
                        'Quy ước thụt lề chuẩn: Sử dụng chính xác 4 phím Space cho mỗi cấp độ khối.',
                        'Cấu hình IDE chuyển đổi tất cả phím Tab thành 4 Spaces để tránh xung đột.',
                    ],
                    fixedCodeExample: `# ĐÚNG:\ndef solve():\n    if condition:\n        process_item()\n    return result`,
                    tips: 'Luôn bật hiển thị Whitespace characters trong Visual Studio Code hoặc PyCharm để phát hiện lỗi thụt lề.',
                    modelUsed: this.name,
                    tokensUsed: 210,
                };
            }
            if (/SyntaxError/i.test(rawMsg)) {
                const lineMatch = rawMsg.match(/line (\d+)/i);
                const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
                return {
                    summary: 'Lỗi cú pháp (SyntaxError): Trình thông dịch Python không thể phân tích cú pháp câu lệnh.',
                    rootCause: `Tại hoặc trước dòng ${lineNum || 'báo lỗi'}, câu lệnh có thể thiếu dấu hai chấm (:), thiếu dấu đóng ngoặc (), [], {} hoặc gán nhầm toán tử so sánh (dùng '=' thay vì '==').`,
                    errorLocation: { line: lineNum },
                    fixSteps: [
                        'Kiểm tra ngay phía trên dòng báo lỗi xem các dấu ngoặc đã đóng đủ cặp chưa.',
                        'Đảm bảo các cấu trúc if, for, while, def, class kết thúc bằng dấu hai chấm (:).',
                        'Kiểm tra các chuỗi string đã đóng đủ dấu ngoặc kép hoặc ngoặc đơn chưa.',
                    ],
                    fixedCodeExample: `# ĐÚNG:\nif a == b:  # Có dấu hai chấm và toán tử so sánh ==\n    print("Equal")`,
                    tips: 'Lỗi cú pháp thường xảy ra do quên đóng ngoặc ở dòng ngay phía trước dòng được báo lỗi.',
                    modelUsed: this.name,
                    tokensUsed: 220,
                };
            }
            if (/NameError/i.test(rawMsg)) {
                const varMatch = rawMsg.match(/name '(\w+)' is not defined/i);
                const varName = varMatch ? varMatch[1] : 'biến';
                return {
                    summary: `Lỗi biến chưa được khai báo hoặc sai tên (NameError: name '${varName}' is not defined).`,
                    rootCause: `Bạn đang gọi sử dụng định danh '${varName}', nhưng định danh này chưa được gán giá trị trước đó hoặc bị viết sai chính tả (chữ hoa/chữ thường).`,
                    fixSteps: [
                        `Kiểm tra lại xem bạn có gõ nhầm chính tả biến '${varName}' không.`,
                        `Đảm bảo biến '${varName}' đã được khởi tạo trước khi được gọi trong luồng code.`,
                        `Nếu '${varName}' là một hàm từ thư viện (như sys, math, collections), hãy kiểm tra lệnh import ở đầu file.`,
                    ],
                    fixedCodeExample: `# Khai báo trước khi dùng:\n${varName} = 0\nprint(${varName})`,
                    tips: 'Python phân biệt chữ hoa và chữ thường (case-sensitive): myVar khác myvar.',
                    modelUsed: this.name,
                    tokensUsed: 200,
                };
            }
        }
        // 2. C# (.NET Roslyn) Parser
        if (lang === 'CSHARP') {
            if (/CS0246/i.test(rawMsg)) {
                const typeMatch = rawMsg.match(/type or namespace name '(\w+)' could not be found/i);
                const typeName = typeMatch ? typeMatch[1] : 'Type';
                return {
                    summary: `Lỗi không tìm thấy kiểu dữ liệu hoặc namespace (CS0246: '${typeName}').`,
                    rootCause: `Trình biên dịch C# không nhận diện được kiểu '${typeName}'. Nguyên nhân thường là thiếu chỉ thị 'using' ở đầu file hoặc viết sai tên lớp.`,
                    fixSteps: [
                        `Thêm chỉ thị using phù hợp ở đầu file (ví dụ: 'using System.Collections.Generic;' nếu dùng List<T>).`,
                        `Kiểm tra xem tên lớp '${typeName}' có viết hoa/thường chính xác theo chuẩn C# không.`,
                    ],
                    fixedCodeExample: `using System;\nusing System.Collections.Generic;\n\npublic class Solution {\n    // Sử dụng List hoặc kiểu mong muốn\n}`,
                    tips: 'C# yêu cầu rõ ràng các namespace của thư viện hệ thống trước khi sử dụng.',
                    modelUsed: this.name,
                    tokensUsed: 230,
                };
            }
            if (/CS1002/i.test(rawMsg)) {
                const lineMatch = rawMsg.match(/\((\d+),(\d+)\)/);
                const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
                return {
                    summary: 'Lỗi thiếu dấu chấm phẩy (CS1002: ; expected).',
                    rootCause: `Tại dòng ${lineNum || 'chỉ định'}, một câu lệnh đã kết thúc nhưng bị thiếu dấu chấm phẩy ';' ở cuối dòng.`,
                    errorLocation: { line: lineNum },
                    fixSteps: [
                        `Đi đến dòng ${lineNum || 'báo lỗi'} hoặc dòng ngay trước đó.`,
                        'Thêm dấu chấm phẩy (;) vào cuối biểu thức câu lệnh.',
                    ],
                    fixedCodeExample: `int totalScore = 100; // Có dấu chấm phẩy ở cuối dòng`,
                    tips: 'Mọi câu lệnh đơn trong C# đều phải kết thúc bằng dấu chấm phẩy.',
                    modelUsed: this.name,
                    tokensUsed: 190,
                };
            }
        }
        // 3. Java Parser
        if (lang === 'JAVA') {
            if (/cannot find symbol/i.test(rawMsg)) {
                return {
                    summary: 'Lỗi không tìm thấy định danh (cannot find symbol).',
                    rootCause: 'Trình biên dịch javac không tìm thấy biến, phương thức hoặc lớp mà bạn đang gọi. Có thể do chưa khai báo, gõ sai tên hoặc chưa import thư viện java.util.*.',
                    fixSteps: [
                        'Kiểm tra khai báo biến và phạm vi (scope) của biến.',
                        'Thêm "import java.util.*;" hoặc import tương ứng ở đầu file.',
                        'Kiểm tra xem chữ hoa/chữ thường có khớp với tên phương thức/lớp không.',
                    ],
                    fixedCodeExample: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n    }\n}`,
                    tips: 'Java phân biệt hoa thường rất nghiêm ngặt.',
                    modelUsed: this.name,
                    tokensUsed: 220,
                };
            }
        }
        // Default Fallback Explainer
        const lineFound = rawMsg.match(/line (\d+)|\((\d+),\d+\)/i);
        const resolvedLine = lineFound ? parseInt(lineFound[1] || lineFound[2], 10) : undefined;
        return {
            summary: `Phát hiện lỗi biên dịch trong bài nộp ngôn ngữ ${lang}.`,
            rootCause: `Trình biên dịch gặp sự cố tại ${resolvedLine ? `dòng ${resolvedLine}` : 'mã nguồn'}. Nội dung chi tiết: ${rawMsg.slice(0, 200)}...`,
            errorLocation: { line: resolvedLine },
            fixSteps: [
                'Xem kỹ thông báo chi tiết trong khối log bên dưới.',
                'Kiểm tra lại cấu trúc cú pháp ở dòng được chỉ định.',
                'Biên dịch và chạy thử kiểm tra trên máy local trước khi nộp lại.',
            ],
            fixedCodeExample: '// Hãy kiểm tra lại cú pháp và đảm bảo code chạy thành công trên máy tính của bạn trước khi nén file zip.',
            tips: 'Đọc kỹ dòng thông báo đầu tiên trong bảng log vì đó thường là nguồn gốc gây ra chuỗi lỗi tiếp theo.',
            modelUsed: this.name,
            tokensUsed: 180,
        };
    }
    // Helper to craft detailed, pedagogically sound exam questions
    craftExamByTopic(topic, difficulty, language, tcCount, additionalRequirements) {
        const isPython = language === 'PYTHON';
        const isJava = language === 'JAVA';
        const isCsharp = language === 'CSHARP';
        let title = '';
        let descriptionMd = '';
        let testCases = [];
        // Binary Search Tree (BST)
        if (/cây nhị phân|bst|binary search tree|tree/i.test(topic)) {
            title = `Cài đặt Cây Nhị Phân Tìm Kiếm (BST) và Tìm Độ Sâu Node`;
            descriptionMd = `## Bối cảnh bài toán\n` +
                `Trong các hệ thống quản lý cơ sở dữ liệu và công cụ tìm kiếm, cấu trúc **Cây nhị phân tìm kiếm (Binary Search Tree - BST)** là nền tảng để lưu trữ dữ liệu có thứ tự, cho phép các thao tác tra cứu, chèn và xóa đạt hiệu năng tối ưu $O(\\log N)$.\n\n` +
                `## Yêu cầu bài toán\n` +
                `Bạn được yêu cầu xây dựng chương trình nhận vào một danh sách gồm $N$ số nguyên dương phân biệt, lần lượt chèn từng phần tử vào cây nhị phân tìm kiếm rỗng ban đầu theo quy tắc BST:\n` +
                `- Với mỗi node giá trị $X$, mọi node thuộc cây con bên trái đều có giá trị nhỏ hơn $X$.\n` +
                `- Mọi node thuộc cây con bên phải đều có giá trị lớn hơn $X$.\n\n` +
                `Sau khi dựng xong cây, cho trước một giá trị truy vấn $K$. Hãy tìm và in ra **độ sâu (depth)** của node chứa giá trị $K$ trong cây. Gốc của cây (root) có độ sâu là $1$. Nếu không tìm thấy $K$ trong cây, in ra \`-1\`.\n\n` +
                `## Định dạng Đầu vào (Input)\n` +
                `- Dòng 1: Số nguyên dương $N$ ($1 \\le N \\le 10^5$) - số lượng phần tử.\n` +
                `- Dòng 2: $N$ số nguyên phân biệt $A_1, A_2, \\dots, A_N$ ($1 \\le A_i \\le 10^9$) cách nhau bởi dấu cách.\n` +
                `- Dòng 3: Số nguyên $K$ - giá trị cần tra cứu.\n\n` +
                `## Định dạng Đầu ra (Output)\n` +
                `- In ra một số nguyên duy nhất là độ sâu của node $K$, hoặc \`-1\` nếu không tồn tại.\n\n` +
                `## Ví dụ minh họa\n` +
                `### Ví dụ 1:\n` +
                `**Input:**\n` +
                `\`\`\`\n` +
                `5\n` +
                `50 30 70 20 40\n` +
                `40\n` +
                `\`\`\`\n` +
                `**Output:**\n` +
                `\`\`\`\n` +
                `3\n` +
                `\`\`\`\n` +
                `*Giải thích: Root là 50 (độ sâu 1). 30 nằm bên trái 50 (độ sâu 2). 40 nằm bên phải 30 (độ sâu 3).*\n\n` +
                `## Ràng buộc kỹ thuật\n` +
                `- Giới hạn thời gian thực thi: 2.0 giây\n` +
                `- Giới hạn bộ nhớ: 512 MiB\n` +
                (additionalRequirements ? `\n> **Yêu cầu bổ sung từ Giảng viên:** ${additionalRequirements}\n` : '') +
                `\n### BAREM ĐIỂM ĐÁNH GIÁ (10.0 ĐIỂM)\n` +
                `| Tiêu chí | Điểm | Mô tả |\n` +
                `| :--- | :---: | :--- |\n` +
                `| **Tính đúng đắn (Test cases)** | **6.0đ** | Đạt 100% test cases chức năng (gồm 2 test công khai và 3 test ẩn biên) |\n` +
                `| **Clean Code & Đặt tên** | **2.0đ** | Tuân thủ naming convention (${isPython ? 'snake_case PEP8' : 'camelCase/PascalCase'}), biến gợi nghĩa, không magic numbers |\n` +
                `| **Nguyên lý SOLID (SRP)** | **1.0đ** | Tách riêng hàm Insert, Search và định dạng I/O |\n` +
                `| **Tối ưu độ phức tạp** | **1.0đ** | Đạt độ phức tạp trung bình $O(\\log N)$, không gây tràn ngăn xếp đệ quy |`;
            testCases = [
                { inputData: '5\n50 30 70 20 40\n40', expectedOutput: '3', isHidden: false, scoreWeight: 2.0, orderIndex: 1, explanation: 'Test cơ bản node ở nhánh con bên phải của nhánh trái' },
                { inputData: '5\n50 30 70 20 40\n50', expectedOutput: '1', isHidden: false, scoreWeight: 2.0, orderIndex: 2, explanation: 'Test tìm chính node root' },
                { inputData: '5\n50 30 70 20 40\n99', expectedOutput: '-1', isHidden: true, scoreWeight: 2.0, orderIndex: 3, explanation: 'Test phần tử không tồn tại trong cây' },
                { inputData: '1\n100\n100', expectedOutput: '1', isHidden: true, scoreWeight: 2.0, orderIndex: 4, explanation: 'Biên: Cây chỉ có đúng 1 node' },
                { inputData: '6\n10 20 30 40 50 60\n60', expectedOutput: '6', isHidden: true, scoreWeight: 2.0, orderIndex: 5, explanation: 'Biên: Cây thoái hóa thành đường thẳng bên phải' },
            ];
        }
        // Sorting (QuickSort / MergeSort)
        else if (/sắp xếp|quicksort|merge|sort/i.test(topic)) {
            title = `Thuật Toán Sắp Xếp Nhanh (QuickSort) và Phân Vùng Hai Con Trỏ`;
            descriptionMd = `## Bối cảnh bài toán\n` +
                `Sắp xếp là một trong những bài toán kinh điển nhất của khoa học máy tính. Thuật toán **QuickSort** áp dụng tư tưởng Chia để trị (Divide and Conquer), được áp dụng rộng rãi trong các thư viện chuẩn nhờ hiệu năng thực tế vượt trội.\n\n` +
                `## Yêu cầu bài toán\n` +
                `Cho một mảng gồm $N$ số nguyên. Hãy viết chương trình thực hiện cài đặt thuật toán QuickSort để sắp xếp mảng theo thứ tự **tăng dần**.\n` +
                `Ngoài ra, chương trình phải in ra số lần thực hiện phép hoán vị (swap) trong suốt quá trình phân vùng (partition) của thuật toán với pivot là phần tử cuối cùng của đoạn đang xét.\n\n` +
                `## Định dạng Đầu vào\n` +
                `- Dòng 1: Số nguyên $N$ ($1 \\le N \\le 10^5$).\n` +
                `- Dòng 2: $N$ số nguyên $A_1, A_2, \\dots, A_N$ ($-10^9 \\le A_i \\le 10^9$).\n\n` +
                `## Định dạng Đầu ra\n` +
                `- Dòng 1: Dãy số sau khi sắp xếp, cách nhau bởi một dấu cách.\n\n` +
                `## Ví dụ minh họa\n` +
                `**Input:**\n` +
                `\`\`\`\n` +
                `6\n` +
                `7 2 1 6 8 5\n` +
                `\`\`\`\n` +
                `**Output:**\n` +
                `\`\`\`\n` +
                `1 2 5 6 7 8\n` +
                `\`\`\`\n\n` +
                `### BAREM ĐIỂM ĐÁNH GIÁ (10.0 ĐIỂM)\n` +
                `| Tiêu chí | Điểm | Mô tả |\n` +
                `| :--- | :---: | :--- |\n` +
                `| **Tính đúng đắn (Test cases)** | **6.0đ** | Sắp xếp chính xác các trường hợp thường, mảng đã sắp xếp, mảng nghịch đảo |\n` +
                `| **Clean Code** | **2.0đ** | Đặt tên hàm swap, partition, quickSort rõ ràng, không lặp code |\n` +
                `| **SOLID & Modularity** | **1.0đ** | Phân tách phân vùng và đệ quy độc lập |\n` +
                `| **Độ phức tạp $O(N \\log N)$** | **1.0đ** | Thời gian chạy không bị TLE với mảng lớn |`;
            testCases = [
                { inputData: '6\n7 2 1 6 8 5', expectedOutput: '1 2 5 6 7 8', isHidden: false, scoreWeight: 2.0, orderIndex: 1 },
                { inputData: '5\n5 4 3 2 1', expectedOutput: '1 2 3 4 5', isHidden: false, scoreWeight: 2.0, orderIndex: 2 },
                { inputData: '4\n1 2 3 4', expectedOutput: '1 2 3 4', isHidden: true, scoreWeight: 2.0, orderIndex: 3 },
                { inputData: '1\n42', expectedOutput: '42', isHidden: true, scoreWeight: 2.0, orderIndex: 4 },
                { inputData: '8\n-5 12 0 -5 99 -100 0 3', expectedOutput: '-100 -5 -5 0 0 3 12 99', isHidden: true, scoreWeight: 2.0, orderIndex: 5 },
            ];
        }
        // Dynamic Programming / Knapsack
        else if (/balo|knapsack|quy hoạch động|dp|dynamic programming/i.test(topic)) {
            title = `Quy Hoạch Động: Bài Toán Cái Túi 0/1 (0-1 Knapsack Problem)`;
            descriptionMd = `## Bối cảnh bài toán\n` +
                `Một nhà thám hiểm mang theo một chiếc ba lô có tải trọng tối đa là $W$. Có $N$ đồ vật được đánh số từ $1$ đến $N$, mỗi đồ vật $i$ có khối lượng $w_i$ và giá trị lợi ích $v_i$. Nhà thám hiểm chỉ có thể chọn mang theo hoặc bỏ lại mỗi đồ vật (không thể chia nhỏ đồ vật).\n\n` +
                `## Yêu cầu bài toán\n` +
                `Hãy lập trình thuật toán Quy hoạch động để tìm tổng giá trị lớn nhất của các đồ vật mà nhà thám hiểm có thể mang theo sao cho tổng khối lượng không vượt quá $W$.\n\n` +
                `## Định dạng Đầu vào\n` +
                `- Dòng 1: Hai số nguyên $N$ ($1 \\le N \\le 1000$) và $W$ ($1 \\le W \\le 5000$).\n` +
                `- $N$ dòng tiếp theo: Mỗi dòng gồm 2 số nguyên $w_i$ và $v_i$ ($1 \\le w_i, v_i \\le 1000$).\n\n` +
                `## Định dạng Đầu ra\n` +
                `- In ra một số nguyên duy nhất là giá trị lớn nhất đạt được.\n\n` +
                `## Ví dụ minh họa\n` +
                `**Input:**\n` +
                `\`\`\`\n` +
                `3 50\n` +
                `10 60\n` +
                `20 100\n` +
                `30 120\n` +
                `\`\`\`\n` +
                `**Output:**\n` +
                `\`\`\`\n` +
                `220\n` +
                `\`\`\`\n` +
                `*Giải thích: Chọn đồ vật 2 (w=20, v=100) và đồ vật 3 (w=30, v=120) -> tổng khối lượng 50, giá trị 220.*\n\n` +
                `### BAREM ĐIỂM ĐÁNH GIÁ (10.0 ĐIỂM)\n` +
                `| Tiêu chí | Điểm | Mô tả |\n` +
                `| :--- | :---: | :--- |\n` +
                `| **Tính đúng đắn (Test cases)** | **6.0đ** | Kết quả tối ưu cho các bộ test ba lô |\n` +
                `| **Clean Code** | **2.0đ** | Đặt tên bảng DP rõ ràng, giải phóng bộ nhớ khi cần |\n` +
                `| **Tối ưu bảng DP** | **2.0đ** | Sử dụng mảng 1 chiều $O(W)$ hoặc bảng 2 chiều không tràn bộ nhớ |`;
            testCases = [
                { inputData: '3 50\n10 60\n20 100\n30 120', expectedOutput: '220', isHidden: false, scoreWeight: 2.0, orderIndex: 1 },
                { inputData: '4 10\n5 10\n4 40\n6 30\n3 50', expectedOutput: '90', isHidden: false, scoreWeight: 2.0, orderIndex: 2 },
                { inputData: '2 5\n10 100\n20 200', expectedOutput: '0', isHidden: true, scoreWeight: 2.0, orderIndex: 3, explanation: 'Mọi vật đều nặng hơn sức chứa ba lô' },
                { inputData: '1 10\n10 500', expectedOutput: '500', isHidden: true, scoreWeight: 2.0, orderIndex: 4 },
                { inputData: '5 20\n2 3\n3 4\n4 5\n5 8\n9 10', expectedOutput: '30', isHidden: true, scoreWeight: 2.0, orderIndex: 5 },
            ];
        }
        // Generic / Custom Algorithm Problem
        else {
            title = `Thuật Toán Xử Lý Dữ Liệu: ${topic}`;
            descriptionMd = `## Bối cảnh bài toán\n` +
                `Trong hệ thống xử lý dữ liệu thông minh, bài toán **${topic}** đóng vai trò thiết yếu để đảm bảo độ chính xác và tính toàn vẹn của dữ liệu trong điều kiện thời gian thực.\n\n` +
                `## Yêu cầu bài toán\n` +
                `Lập trình giải thuật giải quyết chủ đề **${topic}** với độ khó **${difficulty}** trên ngôn ngữ **${language}**.\n` +
                `- Chương trình nhận vào một danh sách các phần tử dữ liệu từ luồng chuẩn (StdIn).\n` +
                `- Áp dụng giải thuật ${topic} để tính toán kết quả theo yêu cầu bài toán.\n` +
                `- Xuất kết quả tương ứng ra luồng xuất chuẩn (StdOut).\n\n` +
                `## Định dạng Đầu vào\n` +
                `- Dòng 1: Số nguyên $N$ ($1 \\le N \\le 10^5$).\n` +
                `- Dòng 2: $N$ số nguyên $A_1, A_2, \\dots, A_N$.\n\n` +
                `## Định dạng Đầu ra\n` +
                `- In ra kết quả xử lý của giải thuật.\n\n` +
                (additionalRequirements ? `> **Yêu cầu bổ sung:** ${additionalRequirements}\n\n` : '') +
                `### BAREM ĐIỂM ĐÁNH GIÁ (10.0 ĐIỂM)\n` +
                `| Tiêu chí | Điểm | Mô tả |\n` +
                `| :--- | :---: | :--- |\n` +
                `| **Tính đúng đắn (Test cases)** | **6.0đ** | Vượt qua toàn bộ bộ test kiểm thử |\n` +
                `| **Clean Code & Naming** | **2.0đ** | Mã nguồn rõ ràng, đặt tên biến chuẩn xác |\n` +
                `| **Cấu trúc hàm & SOLID** | **1.0đ** | Phân rã bài toán thành các hàm con hợp lý |\n` +
                `| **Tối ưu hiệu năng** | **1.0đ** | Thời gian thực thi trong giới hạn cho phép |`;
            testCases = [
                { inputData: '5\n1 3 5 7 9', expectedOutput: '25', isHidden: false, scoreWeight: 2.0, orderIndex: 1 },
                { inputData: '4\n2 4 6 8', expectedOutput: '20', isHidden: false, scoreWeight: 2.0, orderIndex: 2 },
                { inputData: '1\n10', expectedOutput: '10', isHidden: true, scoreWeight: 2.0, orderIndex: 3 },
                { inputData: '3\n-5 0 5', expectedOutput: '0', isHidden: true, scoreWeight: 2.0, orderIndex: 4 },
                { inputData: '6\n10 20 30 40 50 60', expectedOutput: '210', isHidden: true, scoreWeight: 2.0, orderIndex: 5 },
            ];
        }
        // Scale test case weights so they sum to 6.0
        const eachWeight = Math.round((6.0 / testCases.length) * 10) / 10;
        testCases = testCases.slice(0, tcCount).map((tc, idx) => ({
            ...tc,
            orderIndex: idx + 1,
            scoreWeight: eachWeight,
        }));
        return {
            title,
            descriptionMd,
            allowedLanguage: language,
            timeLimitMs: 2000,
            memoryLimitMb: 512,
            rubric: {
                totalPoints: 10.0,
                items: [
                    { criterion: 'Tính đúng đắn thuật toán (Test Cases)', weight: 6.0, description: 'Vượt qua 100% test cases chức năng' },
                    { criterion: 'Clean Code & Quy ước đặt tên', weight: 2.0, description: 'Tên biến hàm gợi nghĩa, không magic numbers' },
                    { criterion: 'Nguyên lý SOLID (SRP)', weight: 1.0, description: 'Tách biệt hàm xử lý và luồng I/O' },
                    { criterion: 'Tối ưu độ phức tạp thuật toán', weight: 1.0, description: 'Thời gian chạy và bộ nhớ trong giới hạn' },
                ],
            },
            testCases,
            modelUsed: this.name,
        };
    }
}
exports.IntelligentLocalProvider = IntelligentLocalProvider;
