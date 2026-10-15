# main.py - File kiểm thử tính năng "Semantic Code Review (Clean Code & SOLID)"
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
