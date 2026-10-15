const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');

const outDir = path.resolve(__dirname, '../../demo-submissions');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. File gây lỗi biên dịch (SyntaxError: missing bracket)
const codeCompileError = `# main.py - File kiểm thử tính năng "AI Giải nghĩa lỗi biên dịch"
def calculate_total():
    # Cố tình thiếu dấu đóng ngoặc vuông ]
    data = [10, 20, 30, 40
    total = sum(data)
    return total

print(calculate_total())
`;

// 2. File giải đúng bài toán (Tổng 2 số nguyên a + b) nhưng vi phạm Clean Code & SOLID
const codeBadCleanCode = `# main.py - File kiểm thử tính năng "Semantic Code Review (Clean Code & SOLID)"
# Bài toán: Đọc hai số nguyên từ stdin và in ra tổng của chúng

def f(x, y):
    # Tên hàm f và tham số x, y không rõ nghĩa
    # Side effect: in thẳng ra stdout thay vì trả về kết quả
    z = int(x) + int(y)
    return z

import sys
s = sys.stdin.read().split()
if len(s) >= 2:
    # Magic numbers / không xử lý lỗi
    a = s[0]
    b = s[1]
    ans = f(a, b)
    print(ans)
`;

// 3. File giải chuẩn mực Clean Code & SOLID
const codeGoodCleanCode = `# main.py - File chuẩn mực tuân thủ Clean Code & SOLID
"""
Chương trình tính tổng hai số nguyên theo chuẩn Clean Code.
Tuân thủ nguyên lý Đơn trách nhiệm (Single Responsibility Principle - SRP).
"""
import sys
from typing import Tuple


def parse_two_integers(raw_input: str) -> Tuple[int, int]:
    """Tách và chuyển đổi hai số nguyên từ chuỗi đầu vào chuẩn."""
    tokens = raw_input.strip().split()
    if len(tokens) < 2:
        raise ValueError("Đầu vào phải chứa ít nhất hai số nguyên.")
    return int(tokens[0]), int(tokens[1])


def calculate_sum(first_number: int, second_number: int) -> int:
    """Thực hiện phép tính tổng hai số nguyên (Pure function, không side-effect)."""
    return first_number + second_number


def main() -> None:
    """Hàm điều phối luồng thực thi chính của chương trình."""
    raw_input = sys.stdin.read()
    if not raw_input.strip():
        return
    first_number, second_number = parse_two_integers(raw_input)
    result = calculate_sum(first_number, second_number)
    print(result)


if __name__ == '__main__':
    main()
`;

async function createPackage(name, code) {
  // Ghi file .py
  const pyPath = path.join(outDir, `${name}.py`);
  fs.writeFileSync(pyPath, code, 'utf8');

  // Ghi file .zip chứa main.py bên trong
  const zip = new JSZip();
  zip.file('main.py', code);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const zipPath = path.join(outDir, `${name}.zip`);
  fs.writeFileSync(zipPath, buffer);

  console.log(`Đã tạo: ${pyPath}`);
  console.log(`Đã tạo: ${zipPath}`);
}

async function run() {
  await createPackage('1_loi_bien_dich', codeCompileError);
  await createPackage('2_code_chay_duoc_nhung_xau', codeBadCleanCode);
  await createPackage('3_code_chuan_clean_code', codeGoodCleanCode);
  console.log('\nHoàn tất tạo các file mẫu tại thư mục demo-submissions!');
}

run().catch(console.error);
