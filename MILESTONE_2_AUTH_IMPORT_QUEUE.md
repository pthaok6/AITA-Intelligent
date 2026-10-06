# Auth, import sinh viên và Redis Queue — Milestone 2

## Khởi động

Từ thư mục gốc sau khi Docker Desktop sẵn sàng:

```powershell
npm.cmd run db:up
npm.cmd run db:setup
npm.cmd run sandbox:build
npm.cmd start
```

`db:up` khởi chạy cả PostgreSQL và Redis. `npm start` chạy API, frontend và worker ở ba tiến trình riêng. Có thể chạy độc lập với `npm run dev:backend`, `npm run dev:frontend`, `npm run dev:worker`. Production dùng `npm run build` trong backend, rồi chạy `npm start` và `npm run start:worker` bằng các process riêng.

## Cấu hình Auth và Google

Backend đọc `apps/backend/.env`:

```dotenv
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
REDIS_URL=redis://127.0.0.1:6379
QUEUE_PREFIX=aita
GOOGLE_CLIENT_ID=
ALLOWED_EMAIL_DOMAINS=fpt.edu.vn,fe.edu.vn,gmail.com
FRONTEND_ORIGINS=http://localhost:5173
COOKIE_SECURE=false
```

Không có Google Client ID thì login bằng email/mật khẩu vẫn hoạt động; UI thông báo Google chưa được bật và endpoint Google trả 503. Không có đường đăng nhập Google giả lập trong ứng dụng.

Tạo Client ID:

1. Mở Google Cloud Console, chọn/tạo project; cấu hình Google Auth Platform: branding, audience và tài khoản test nếu ứng dụng còn ở chế độ testing. Chọn audience phù hợp với tài khoản thuộc trường; project cá nhân thường cần External.
2. Tạo OAuth Client loại **Web application**. Authorized JavaScript origins thêm `http://localhost:5173`. Đây là GIS popup credential callback, không cần Client Secret hoặc redirect URI cho luồng này.
3. Điền Client ID dạng `....apps.googleusercontent.com` vào `GOOGLE_CLIENT_ID` ở backend `.env`, khởi động lại API. Frontend lấy Client ID từ `/api/auth/google/config`, không cần thêm Client ID vào env frontend.
4. Đăng nhập bằng Gmail cá nhân hoặc tài khoản Workspace thuộc `ALLOWED_EMAIL_DOMAINS`. Backend kiểm chữ ký, audience, issuer, expiry qua Google Auth Library, rồi kiểm `email_verified` và nonce. Gmail cá nhân được Google xác minh không cần hosted-domain `hd`; các miền khác vẫn cần Workspace `hd` được cho phép.

Google có thể từ chối tài khoản nếu chưa được thêm vào test users hoặc bị chính sách Workspace của trường chặn. Thêm đúng origin hiện đang dùng; không chuyển frontend sang cổng khác mà quên cập nhật cấu hình.

Nếu email đã có tài khoản mật khẩu nhưng chưa liên kết Google, điền mật khẩu hiện tại trên màn hình login trước khi bấm Google. Backend yêu cầu bằng chứng sở hữu cả hai tài khoản trước khi liên kết; không tự liên kết theo email đơn thuần. Tài khoản import chưa có mật khẩu được liên kết với Gmail/Workspace identity đã xác minh. Cấu hình Gmail áp dụng theo thông tin người dùng xác nhận: từ K19 dùng email cá nhân. Đăng nhập Google chứng minh quyền sở hữu email; quyền giảng viên/quản trị và quyền truy cập lớp vẫn được kiểm riêng.

JWT access token có hạn 15 phút, refresh token 7 ngày. Cookie HttpOnly/SameSite=Strict; khi production, Secure luôn được bật. `COOKIE_SECURE=false` chỉ dành cho HTTP local. Refresh token được băm SHA-256 trong `AuthSession`, xoay sau mỗi lần refresh và không gia hạn vượt mốc 7 ngày của phiên. Logout revoke phiên và xóa cookie. JWT cũ không có session ID không còn hợp lệ; người dùng cần đăng nhập lại.

Frontend không lưu token trong localStorage. Khi access cookie hết hạn, API client gọi refresh một lần rồi thử lại; reload trang khôi phục người dùng từ `/auth/me`. Cookie mutations dùng `X-AITA-Request: 1`, backend kiểm CORS origin để chặn CSRF. Client ngoài trình duyệt có thể dùng Bearer access token.

Tự đăng ký chỉ tạo STUDENT; không nhận ADMIN/LECTURER từ client. Tài khoản giảng viên có thể được cấp vai trò bằng Prisma Studio bởi người quản trị local, sau đó đăng nhập lại. Tài khoản có `isActive=false` không được đăng nhập/refresh. Endpoint dữ liệu kiểm quyền lớp và chủ bài nộp.

Tài liệu Google: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid và https://developers.google.com/identity/gsi/web/guides/verify-google-id-token.

## Bulk import Excel

Trong dashboard giảng viên, chọn **Import sinh viên** ở lớp cần nhập.

1. Chọn `.xlsx` nhỏ hơn 10 MB. Sheet đầu tiên, dòng 1 là header; tối đa 5.000 sinh viên/100 cột. Các header mặc định hỗ trợ `Email` và `Họ tên`/`Full Name`.
2. Nhấn **Xem trước**. Nếu header khác, chọn cột Email/Họ tên rồi xem trước lại. Dòng lỗi và email trùng trong file phải được sửa trước khi xác nhận.
3. Nhấn **Xác nhận import**. Một SQL transaction ở isolation Serializable ghi tất cả user/enrollment; lỗi validation, role conflict hay DB failure rollback toàn bộ batch.

API multipart:

- `POST /api/classes/:classId/students/import/preview`: `file`, `mapping` tùy chọn (JSON `{"email":1,"fullName":2}`, chỉ số cột bắt đầu từ 1).
- `POST /api/classes/:classId/students/import`: cùng `file`/`mapping` và `previewToken` từ bước preview. Token gắn với file hash, mapping, lớp và người import, hết hạn sau 15 phút.
- Cookie client gửi `X-AITA-Request: 1`; Bearer client gửi access token. Chỉ giảng viên sở hữu lớp hoặc ADMIN được import.

Tài khoản mới có vai trò STUDENT và chưa có mật khẩu local, đăng nhập bằng Google với email đã import khi cấu hình Google hoàn tất. Hỗ trợ Gmail cá nhân trong roster. Tài khoản có sẵn giữ nguyên tên/mật khẩu; email không phải STUDENT hoặc tài khoản bị khóa khiến cả batch rollback. Enrollment đã ACTIVE được tính skipped; enrollment DROPPED được kích hoạt lại và tính added. Kết quả có `added`, `skipped`, `createdUsers`, `total`, `errors`.

File sai định dạng, công thức/ô lỗi ở cột import và archive vượt giới hạn giải nén được từ chối. Không thực thi công thức Excel.

## BullMQ và khả năng phục hồi

Redis dùng AOF và volume `redis_data`, policy `noeviction`. Queue `grading-queue`, job ID bằng submission ID, attempts=3, exponential backoff 1 giây, concurrency=2. Producer và worker dùng kết nối Redis khác nhau. API giữ timeout enqueue 5 giây, worker chờ Redis kết nối lại.

API lưu submission QUEUED vào PostgreSQL trước enqueue. Nếu enqueue lỗi, receipt vẫn được trả với `queuePending=true`; worker đối soát các hàng QUEUED mỗi 10 giây và enqueue lại. Job ID ổn định chống job lặp; bài COMPLETED không chấm lại, kết quả testcase được upsert theo khóa unique. Worker restart được BullMQ xử lý job stalled theo cơ chế queue; không cần giữ process API để tiêu thụ job.

Luồng nhận bài hiện dùng multipart ZIP và Docker Sandbox thật. Sau chấm test case, worker chuyển bài sang `plagiarism-queue` để phân tích AST, tạo fingerprint Winnowing và lưu báo cáo tương đồng vào DB. Xem [README](README.md) để cấu hình runner, đóng gói bài nộp và chạy kiểm thử Docker.

Tài liệu BullMQ: https://docs.bullmq.io/guide/connections và https://docs.bullmq.io/guide/going-to-production.

## Kiểm thử

```powershell
cd apps\backend
npm.cmd test
npm.cmd run test:integration
```

Integration cần database riêng có tên chứa `test`, cấu hình `TEST_DATABASE_URL` trong `apps/backend/.env.test` và Redis đang chạy. Database test phải được áp cùng migrations trước khi chạy; tuyệt đối không trỏ TEST_DATABASE_URL vào database ứng dụng. Các test tạo dữ liệu riêng và cleanup dữ liệu của chính lần chạy.

Bộ test kiểm miền email/Google claims/nonce, parser và giới hạn XLSX, JWT/cookie/refresh/logout/quyền tài khoản, CSRF, ownership import, validation và rollback khi lỗi DB thật, producer không có worker, worker nhận job cũ, retry, duplicate và recovery khi enqueue thất bại. Đăng nhập Google thực tế cần Client ID và tài khoản của trường; test local không thay thế bước này.
