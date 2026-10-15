# main.py - File chuẩn mực tuân thủ Clean Code & SOLID
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
