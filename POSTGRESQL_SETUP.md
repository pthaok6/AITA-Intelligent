# PostgreSQL cho AITA

Repo dùng PostgreSQL 17, Prisma hiện có và Docker Compose. PostgreSQL lưu dữ liệu trong named volume `postgres_data`, chỉ mở cổng database trên localhost. Database mới khởi tạo trống; file SQLite `apps/backend/prisma/dev.db` vẫn được giữ, dữ liệu chưa tự động chuyển sang PostgreSQL.

## Chạy lần đầu trên máy Windows

1. Cài và mở Docker Desktop, chọn Linux containers, chờ engine sẵn sàng.
2. Với checkout mới, tạo `.env` ở thư mục gốc từ `.env.example`; tạo `apps/backend/.env` từ file example tương ứng. Nếu backend đã có `.env`, chỉ cập nhật `DATABASE_URL`, giữ các biến khác. `POSTGRES_PASSWORD` ở root phải khớp mật khẩu trong backend URL. Các giá trị mẫu chỉ dành cho local.
3. Chạy trong PowerShell:

```powershell
cd D:\GitHub\swp
npm.cmd run db:up
npm.cmd run db:setup
npm.cmd start
```

`db:up` đợi PostgreSQL healthy. `db:setup` áp migration đã có và generate Prisma Client, có thể chạy lại mà không xóa dữ liệu. Không cần cài PostgreSQL riêng trên Windows.

`npm start` khởi chạy API, worker BullMQ và frontend; Ctrl+C dừng các tiến trình này. Backend chạy mặc định ở `http://localhost:5000`, frontend ở `http://localhost:5173`. Sau khi tạo database, tạo tài khoản và lớp qua ứng dụng; chưa có script seed mẫu trong repo. Có thể chạy riêng bằng `npm run dev:backend`, `npm run dev:worker` hoặc `npm run dev:frontend`. Redis dùng cổng 6379 và volume riêng. Hướng dẫn Auth/Google/import/queue nằm trong `MILESTONE_2_AUTH_IMPORT_QUEUE.md`.

## Xem dữ liệu

Mở terminal thứ hai, chạy từ thư mục gốc:

```powershell
npm.cmd run db:studio
```

Mở địa chỉ Prisma Studio được in trong terminal để xem và sửa dữ liệu. Backend kết nối bằng host `localhost`, port `5432`, database `aita_db`, user `aita`; mật khẩu lấy từ `.env` gốc.

Chạy SQL trực tiếp nếu cần:

```powershell
docker compose exec postgres psql -U aita -d aita_db
```

```sql
\dt
SELECT id, email, role FROM users LIMIT 10;
\q
```

## Công việc hằng ngày

```powershell
npm.cmd run db:up
npm.cmd run db:logs
npm.cmd run db:stop
```

`db:stop` giữ dữ liệu. Khi thay đổi schema, tạo migration trong backend:

```powershell
cd apps\backend
npm.cmd run prisma:migrate -- --name ten_thay_doi
npm.cmd run prisma:generate
```

Commit `schema.prisma` và `prisma/migrations`. Các thành viên khác chạy `db:setup` để nhận migration. Migration ban đầu được tạo cho PostgreSQL trống, không dùng nó để chuyển dữ liệu SQLite hoặc áp vào một database có bảng sẵn mà chưa baseline.

## Lỗi thường gặp

- **Không kết nối Docker Engine:** mở Docker Desktop và đợi engine sẵn sàng; chạy `docker info` để kiểm tra.
- **Cổng 5432 đang dùng:** đổi cổng phía host trong `compose.yaml` thành `127.0.0.1:5433:5432`, cập nhật `DATABASE_URL` thành `localhost:5433`, rồi chạy lại `db:up`.
- **Prisma P1001:** chạy `docker compose ps` và `db:logs`, xác nhận database healthy và URL đúng.
- **Sai mật khẩu sau khi đổi `.env`:** `POSTGRES_PASSWORD` chỉ tạo mật khẩu khi volume trống lần đầu. Đổi file env không tự đổi mật khẩu của database đã có; cần đổi password trong PostgreSQL và cập nhật URL tương ứng.
- **Chạy backend trong container về sau:** đổi host trong URL từ `localhost` thành tên service `postgres`; cấu hình hiện tại dành cho backend chạy trên Windows.

`.env` và file SQLite cũ đã được theo dõi bởi Git từ trước trong checkout hiện tại; thêm `.gitignore` không tự bỏ theo dõi các file đó. Không commit thông tin đăng nhập thật; các file `.env.example` là mẫu chia sẻ cho nhóm.
