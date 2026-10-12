# Bộ file demo exception paths — Milestone 2

Các file này chỉ là dữ liệu demo, không chứa dữ liệu cá nhân. Dùng trong môi trường local/test.

## Excel import

1. Mở trang lớp với tài khoản giảng viên và chọn Import sinh viên. Cột đã đặt theo header `Email`, `Họ tên`.
2. `01-excel-invalid-row.xlsx`: preview báo dòng 3 có email không hợp lệ; không có preview token nên không thể commit batch. Dòng hợp lệ trước đó cũng không được ghi.
3. `02-excel-database-rollback.xlsx`: trước khi demo, cần có tài khoản `lecturer.test@fpt.edu.vn` đã được đăng ký và đổi role thành LECTURER (hoặc thay email trong workbook bằng tài khoản ADMIN/giảng viên hiện có). Preview sẽ hợp lệ. Khi commit, dòng sinh viên mới được xử lý trước; dòng tài khoản giảng viên gây lỗi và transaction phải rollback toàn bộ, không để lại user/enrollment của dòng trước.

## Submission ZIP

Tạo đề thi Python với thời gian mỗi test ít nhất 1000 ms, thêm một test case bất kỳ, rồi đăng nhập tài khoản sinh viên đã ghi danh và nộp ZIP tương ứng.

- `03-submission-compile-error.zip`: `main.py` có lỗi cú pháp; kỳ vọng trạng thái bài `COMPILE_ERROR`, điểm 0, có thông báo SyntaxError.
- `04-submission-timeout.zip`: vòng lặp vô hạn; kỳ vọng test case có trạng thái `TIME_LIMIT_EXCEEDED`, điểm test đó 0. Bài có thể mang trạng thái tổng `COMPLETED` sau khi tất cả testcase đã được chấm.

## Điều kiện chạy

- API, PostgreSQL, Redis và worker đang chạy; worker phải kết nối Docker.
- Image sandbox Python đã build theo hướng dẫn README gốc.
- Đề thi đang trong thời gian cho phép nộp, ngôn ngữ Python, sinh viên đã active trong lớp.
- Timeout chỉ được xác nhận bằng sandbox Docker thật; không chạy file này trực tiếp trên máy cá nhân.
