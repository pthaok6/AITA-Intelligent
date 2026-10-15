# Dữ liệu mẫu & Demo AITA

Thư mục này chứa các kịch bản demo và dữ liệu kiểm thử phục vụ việc thẩm định hệ thống:

- **Các file mẫu tiêu chuẩn (Golden Samples)**:
  - Xem tại thư mục `/examples` ở thư mục gốc của dự án.
  - Bao gồm:
    - Danh sách sinh viên mẫu: `examples/studentImport/sinh_vien_test_AITA-TEST-001.xlsx` (10 sinh viên chuẩn)
    - Bài nộp mẫu C#: `examples/submissions/csharp/`
    - Bài nộp mẫu Java: `examples/submissions/java/`
    - Bài nộp mẫu Python: `examples/submissions/python/`
  - Các bài nộp mẫu tự động sinh: xem tại thư mục `/demo-submissions` ở thư mục gốc (`1_loi_bien_dich`, `2_code_chay_duoc_nhung_xau`, `3_code_chuan_clean_code`).

- **Các trường hợp ngoại lệ (Exception Paths)**:
  - Xem tại thư mục `/demo/exception-paths/`.
  - Bao gồm:
    - `01-excel-invalid-student.xlsx`: Kiểm tra email sinh viên không hợp lệ.
    - `02-excel-ineligible-account.xlsx`: Kiểm tra tài khoản không phải STUDENT (giảng viên) trong import danh sách.
    - `03-submission-compile-error.zip`: Kiểm tra bài nộp bị lỗi biên dịch.
    - `04-submission-timeout.zip`: Kiểm tra bài nộp vượt quá giới hạn thời gian (Time Limit Exceeded).
