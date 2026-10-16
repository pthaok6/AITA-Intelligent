# Báo cáo kiểm thử tích hợp

Ngày chạy: 2026-10-16

## Kịch bản tích hợp

Chạy bằng `npm run test:integration` trong `apps/backend`. Suite khởi động API thật trên cổng tạm, dùng PostgreSQL và Redis, đồng thời chỉ cho phép kết nối đến `TEST_DATABASE_URL` có tên chứa `test` và khác `DATABASE_URL`.

Các kịch bản trong `integration.test.cjs`:

1. Đăng ký, đăng nhập, phân quyền, cookie/JWT, refresh token, từ chối token hết hạn, khóa tài khoản, kiểm tra CSRF và nguồn gọi.
2. Google OAuth: từ chối khi tắt Google hoặc token giả; email `@fpt.edu.vn` được tạo và đăng nhập ngay; email miền khác tạo tài khoản chờ duyệt, chưa đăng nhập được, xuất hiện trong danh sách admin và đăng nhập được sau khi admin duyệt.
3. Import danh sách sinh viên: xem trước không ghi dữ liệu, kiểm tra quyền, yêu cầu receipt hợp lệ, chỉ nhận tài khoản phù hợp, bỏ qua trùng/tài khoản chưa tồn tại, từ chối file hoặc dòng sai và rollback toàn bộ khi lỗi giữa chừng.
4. Nộp bài: lưu submission và đưa job vào Redis; worker lấy job và lưu kết quả; xử lý job trùng, lỗi tạm thời, worker khởi động lại, Redis gián đoạn và phục hồi job; từ chối sinh viên không thuộc lớp.
5. Bài nhóm: tạo nhóm, thêm thành viên, cập nhật GitHub username; thành viên xem điểm chung, mở submission và gửi khiếu nại; giảng viên xem và xử lý khiếu nại, điểm cập nhật được phản ánh với thành viên.

Các kiểm thử trong `npm test` bổ sung cho AI tạo đề/rubric, code review và giải thích lỗi (dùng stub), nghiệp vụ khiếu nại, phân tích đóng góp Git BR-05/BR-12, xử lý Excel, fingerprint RBL và kiểm tra an toàn ZIP.

## Kết quả

| Lệnh | Kết quả |
|---|---|
| `npm test` | Đạt: 41/41 kiểm thử, 0 lỗi. |
| `npm run test:integration` | Đạt: 29/29 kiểm thử tích hợp, 0 lỗi; PostgreSQL và Redis hoạt động. |
| `npm run build` trong `apps/frontend` | Đạt: TypeScript và Vite production build thành công. |
| `npm run test:sandbox` | Chưa thể xác nhận: môi trường không truy cập được Docker Engine (`connect EPERM //./pipe/docker_engine`), nên kiểm thử compiler/runtime và luồng ZIP chấm bài cần chạy lại khi Docker hoạt động. |

Suite tích hợp không gọi dịch vụ Google thật; kiểm thử stub xác minh payload đã xác thực. Các kiểm thử AI dùng stub/fallback, không đo chất lượng hoặc khả năng kết nối dịch vụ AI ngoài. Vì vậy kết quả trên xác nhận các luồng API, database, queue và quy tắc nghiệp vụ đã liệt kê; chưa phải kiểm thử end-to-end giao diện trình duyệt hay sandbox Docker.

## Chạy lại

```powershell
cd apps/backend
npm test
npm run test:integration
npm run test:sandbox # cần Docker Engine đang chạy
```
