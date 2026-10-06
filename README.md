# AITA — cấu hình và chạy web

AITA là web quản lý lớp, bài kiểm tra và bài nộp lập trình. Frontend dùng React/Vite; backend dùng Express, Prisma/PostgreSQL, Redis/BullMQ và Docker Engine API.

Hiện đã có đăng nhập JWT/Google, import sinh viên Excel bằng transaction, nộp ZIP, chấm test case bằng Docker thật và phân tích AST/Winnowing. Sinh viên xem điểm, thông báo compiler và StdOut/StdErr của test công khai. Giảng viên xem bài nộp và báo cáo tương đồng. Kết quả được cập nhật bằng polling. LLM review, Tree Edit Distance, WebSocket và khiếu nại điểm chưa được triển khai trong luồng này.

## 1. Chuẩn bị

- Node.js 22 trở lên và npm; kiểm tra `node --version`, `npm.cmd --version`.
- Docker Desktop đang chạy **Linux containers**, có Docker Compose v2. Kiểm tra `docker info`, `docker compose version`.
- Trên Windows, Docker Desktop cần WSL2/virtualization hoạt động. Hoàn tất phần này trước khi chạy database hoặc Sandbox.
- Chừa dung lượng cho các image Python 3.12, .NET SDK 8 và JDK 17. Lần build đầu cần mạng để tải base image; bài nộp chạy với mạng bị tắt.
- Không cần cài PostgreSQL, Redis, Python, Java hay .NET trực tiếp trên Windows.

Các lệnh bên dưới chạy bằng PowerShell từ `D:\GitHub\swp`, trừ khi ghi rõ thư mục khác. `npm.cmd` tránh lỗi ExecutionPolicy đối với `npm.ps1`.

## 2. Cài dependency

```powershell
cd D:\GitHub\swp
npm.cmd --prefix apps/backend ci --workspaces=false
npm.cmd --prefix apps/frontend ci --workspaces=false
```

Hai ứng dụng có lockfile riêng. Nếu npm chặn lifecycle script của Prisma, bước `db:setup` phía dưới sẽ chạy Prisma CLI/generate rõ ràng; không cần bật mọi install script của dependency.

## 3. Tạo file cấu hình

Chỉ copy nếu file chưa tồn tại để giữ cấu hình, Client ID và mật khẩu hiện có:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path apps/backend/.env)) { Copy-Item apps/backend/.env.example apps/backend/.env }
```

### `.env` ở thư mục gốc

```dotenv
POSTGRES_PASSWORD=aita_local_123
```

Đây là mật khẩu mẫu cho local. Root `.env` được Docker Compose đọc; backend đọc file riêng bên dưới. Mật khẩu phải khớp giữa hai file. Khi PostgreSQL đã có volume, đổi biến này không tự đổi mật khẩu user trong DB.

### `apps/backend/.env`

```dotenv
PORT=5000
DATABASE_URL="postgresql://aita:aita_local_123@localhost:5432/aita_db?schema=public"
JWT_SECRET=replace-with-your-random-secret-at-least-32-characters
REDIS_URL=redis://127.0.0.1:6379
QUEUE_PREFIX=aita
FRONTEND_ORIGINS=http://localhost:5173
COOKIE_SECURE=false
GOOGLE_CLIENT_ID=
ALLOWED_EMAIL_DOMAINS=fpt.edu.vn,fe.edu.vn,gmail.com
SANDBOX_PYTHON_IMAGE=aita-runner-python:1
SANDBOX_CSHARP_IMAGE=aita-runner-csharp:1
SANDBOX_JAVA_IMAGE=aita-runner-java:1
WINNOWING_K=5
WINNOWING_W=4
```

Tạo JWT secret bằng lệnh sau rồi điền kết quả vào `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`COOKIE_SECURE=false` dành cho HTTP local. Với `NODE_ENV=production`, cookie luôn dùng Secure và cần HTTPS. Không commit `.env`.

| Biến tùy chọn | Ý nghĩa |
| --- | --- |
| `DOCKER_SOCKET_PATH` | Tự chọn `//./pipe/docker_engine` trên Windows và `/var/run/docker.sock` trên Linux. Nếu dùng socket khác, điền đường dẫn socket đó. Docker context của CLI không tự thay biến này. |
| `SUBMISSION_STORAGE_DIR` | Mặc định `apps/backend/storage`. Có thể dùng đường dẫn tuyệt đối, ví dụ `D:/GitHub/swp/apps/backend/storage`. API và worker phải đọc chung thư mục này. |
| `WINNOWING_K`, `WINNOWING_W` | Số token trong k-gram và kích thước cửa sổ; số nguyên 1..100. Giữ nguyên trong một đợt thực nghiệm để so sánh cùng cấu hình. |

Frontend hiện proxy `/api` tới `http://localhost:5000` trong `apps/frontend/vite.config.ts`. Nếu đổi `PORT`, cần đổi cả proxy.

## 4. Khởi tạo PostgreSQL, Redis và runner

```powershell
npm.cmd run db:up
npm.cmd run db:setup
npm.cmd run sandbox:build
```

- `db:up`: chạy PostgreSQL 17 và Redis 7, chờ healthcheck.
- `db:setup`: áp migration và tạo Prisma Client; giữ dữ liệu hiện có. Migration mới thêm thông tin ZIP, trạng thái AST, fingerprint theo file và diagnostics.
- `sandbox:build`: build ba image runner. Worker tạo container ngắn hạn từ các image này; không cần chạy runner service thường trực.

Kiểm tra:

```powershell
docker compose ps
docker image ls --filter "reference=aita-runner-*"
```

Phải có `aita-runner-python:1`, `aita-runner-csharp:1`, `aita-runner-java:1`.

## 5. Khởi chạy web

```powershell
npm.cmd start
```

Một terminal chạy ba tiến trình: API, BullMQ worker và Vite. Để terminal mở trong lúc dùng web.

| Dịch vụ | Địa chỉ/cổng |
| --- | --- |
| Web | http://localhost:5173 |
| API health | http://localhost:5000/api/health |
| PostgreSQL | localhost:5432, database `aita_db`, user `aita` |
| Redis | 127.0.0.1:6379 |

Dùng **Ctrl+C** tại terminal `npm start` để dừng web/API/worker. Dừng database mà giữ dữ liệu:

```powershell
npm.cmd run db:stop
```

Những lần sau chỉ cần:

```powershell
npm.cmd run db:up
npm.cmd start
```

Sau khi pull thay đổi schema hoặc Dockerfile, dừng web, chạy lại `db:setup` và/hoặc `sandbox:build`, rồi `npm start`.

Có thể chạy riêng trong ba terminal:

```powershell
npm.cmd run dev:backend
npm.cmd run dev:worker
npm.cmd run dev:frontend
```

## 6. Google SSO và tài khoản giảng viên

Email/mật khẩu vẫn hoạt động khi `GOOGLE_CLIENT_ID` để trống. Để bật Google:

1. Tạo/chọn project trong Google Cloud Console, cấu hình Google Auth Platform và audience **External** nếu dùng Gmail cá nhân. Thêm tài khoản thử nghiệm nếu project yêu cầu test users.
2. Tạo OAuth client loại **Web application**. Thêm `http://localhost` và `http://localhost:5173` vào **Authorized JavaScript origins**.
3. Điền Client ID dạng `...apps.googleusercontent.com` vào backend `.env`; khởi động lại API. Luồng GIS credential callback này không cần Client Secret.
4. Đăng nhập bằng Gmail cá nhân hoặc email Workspace thuộc danh sách được phép. Nếu email đã có tài khoản mật khẩu, nhập mật khẩu hiện tại trên trang login trước khi bấm Google để liên kết.

Backend xác minh ID token và email; `gmail.com` được chấp nhận theo việc sinh viên K19 sử dụng email cá nhân. Quyền học trong lớp vẫn được kiểm tra bằng enrollment. Xem [hướng dẫn Google chính thức](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) và [chi tiết Auth/import](MILESTONE_2_AUTH_IMPORT_QUEUE.md).

Tự đăng ký chỉ tạo vai trò `STUDENT`. Để có giảng viên khi chạy local:

1. Đăng ký tài khoản trên web.
2. Mở terminal khác, chạy `npm.cmd run db:studio`.
3. Trong bảng `User`, tìm đúng email, đổi `role` thành `LECTURER` rồi lưu. `ADMIN` dành cho người quản trị.
4. Đăng xuất rồi đăng nhập lại để nhận phiên có vai trò mới.

## 7. Thử luồng đầy đủ trên web

### Giảng viên

1. Tạo lớp tại dashboard.
2. Import file `.xlsx` với hai cột **Email**, **Họ tên**. Xem preview, kiểm tra mapping rồi xác nhận import. Import dùng transaction: lỗi sẽ rollback toàn bộ batch.
3. Tạo bài kiểm tra, chọn **PYTHON / CSHARP / JAVA**, mô tả và test case. Thời gian 1..10000 ms/test, RAM 64..512 MiB/test; mặc định 2000 ms, 512 MiB.
4. Đánh dấu test ẩn nếu cần. Đặt tổng `scoreWeight` theo thang điểm muốn dùng, ví dụ 5 test × 20 = 100.
5. Vào trang bài nộp/kết quả của lớp. Trang tự tải lại dữ liệu mỗi 5 giây, gồm trạng thái AST và các cặp bài tương đồng.

Tài khoản sinh viên do import tạo chưa có mật khẩu mặc định; đăng nhập Google bằng đúng email đã import. Muốn thử email/mật khẩu khi chưa có Client ID, cho sinh viên tự đăng ký trước rồi import email đó vào lớp.

### Sinh viên

1. Đăng nhập bằng email đã được thêm vào lớp.
2. Mở bài kiểm tra đang trong thời gian làm bài.
3. Chọn ZIP chứa mã nguồn, điền entrypoint nếu cần, bấm **Nộp bài và chấm tự động**.
4. Trang kết quả tự cập nhật: `QUEUED → RUNNING → COMPLETED` hoặc `COMPILE_ERROR / FAILED`.
5. Xem điểm, StdOut/StdErr của test công khai, thông báo compiler, SHA-256 và số fingerprint. Có thể tải lại ZIP đã nộp.

`COMPLETED` nghĩa là đã chạy hết test; vẫn có thể có test `WRONG_ANSWER`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED` hoặc `OUTPUT_LIMIT_EXCEEDED`. Sinh viên không được xem stdout/stderr của test ẩn hay bài nộp người khác.

## 8. Chuẩn bị ZIP

Chỉ các file mã nguồn của ngôn ngữ bài thi được truyền vào container. Không dùng package ngoài; file build do sinh viên gửi (`.csproj`, scripts...) không được thực thi. Extension cần viết thường: `.py`, `.cs`, `.java`.

### Python 3.12

```text
submission.zip
├── main.py
└── helper.py     # tùy chọn
```

`main.py`:

```python
a, b = map(int, input().split())
print(a + b)
```

Hệ thống tự tìm `main.py` duy nhất hoặc file `.py` duy nhất. Nếu có nhiều file và không có `main.py` duy nhất, điền đường dẫn chính xác trong ZIP, ví dụ `src/solution.py`.

### C# / .NET 8

ZIP chứa `Program.cs` và các file `.cs` khác. Để trống entrypoint; dùng `Main` hoặc top-level statements. Hệ thống tạo project console .NET 8 riêng, tắt analyzer và nguồn NuGet ngoài.

```csharp
var parts = Console.ReadLine()!.Split();
Console.WriteLine(int.Parse(parts[0]) + int.Parse(parts[1]));
```

### Java 17

ZIP chứa `Main.java` và các file `.java` khác. Entrypoint mặc định là `Main`; nếu có package thì dùng tên đầy đủ, ví dụ `school.Main`. Annotation processing bị tắt.

```java
import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.println(scanner.nextInt() + scanner.nextInt());
    }
}
```

Đóng gói các mẫu sẵn có từ thư mục gốc:

```powershell
Compress-Archive -Path examples/submissions/python/* -DestinationPath sum-python.zip
Compress-Archive -Path examples/submissions/csharp/* -DestinationPath sum-csharp.zip
Compress-Archive -Path examples/submissions/java/* -DestinationPath sum-java.zip
```

ZIP tối đa **25 MiB**, tổng giải nén tối đa **50 MiB**, tối đa 1000 mục/200 file nguồn; tỷ lệ nén bất thường bị từ chối. ZIP có traversal, đường dẫn tuyệt đối, symlink, mã hóa hoặc tên trùng không được nhận. Dữ liệu được giải nén vào bộ nhớ có giới hạn; không ghi đường dẫn từ ZIP lên filesystem host.

## 9. Sandbox, AST và dữ liệu lưu trữ

```mermaid
flowchart LR
  U[Upload ZIP] --> V[Kiểm tra ZIP và băm SHA-256]
  V --> DB[(PostgreSQL receipt)]
  DB --> Q[grading-queue]
  Q --> C[Kiểm tra SHA-256 và biên dịch]
  C --> T[Container riêng từng test]
  T --> R[Điểm và StdOut/StdErr]
  R --> A[plagiarism-queue]
  A --> P[Python ast / Roslyn / Java AST]
  P --> W[Token chuẩn hóa và Winnowing]
  W --> F[(Fingerprint và báo cáo DB)]
```

**Docker:** sử dụng API qua `dockerode`, UID/GID 1000, mạng `none`, root filesystem chỉ đọc, drop toàn bộ capabilities, `no-new-privileges`, 1 CPU, tối đa 128 PID, RAM/swap được chặn bằng cgroup. `/work` và `/tmp` là tmpfs có giới hạn, `noexec/nosuid`. Không mount thư mục host hay Docker socket vào container. Source/compiled artifacts được truyền qua Docker Exec stdin/stdout với lệnh `tar` cố định.

Compiler chạy tối đa 60 giây với 512 MiB, biên dịch một lần. Mỗi test chạy trong container mới. StdOut và StdErr bị giới hạn riêng 64 KiB; vượt giới hạn sẽ dừng container. Expected output chỉ được so sánh ở worker, không đưa vào container. CRLF được đổi thành LF và bỏ whitespace cuối output trước khi đối chiếu. Đo RAM từ cgroup v2 memory peak hoặc mẫu Docker stats; đo thời gian thực thi bằng đồng hồ host, gồm overhead Docker Exec/polling. Không coi các số này là benchmark thuần của chương trình.

**AST:** Python dùng `ast.parse`, C# dùng Roslyn SyntaxTree, Java dùng JDK compiler Trees API. Parser đọc cú pháp, không import hay chạy bài sinh viên. Comment/formatting không vào token; identifier được chuẩn hóa thành `ID`, node kind/operator/literal vẫn đóng góp cấu trúc. Python bỏ docstring. Token hóa được version hóa `ast-winnowing-v1`.

**Winnowing:** băm SHA-256 mỗi k-gram token, lấy 63 bit đầu để lưu PostgreSQL `BIGINT`; chọn minimum ngoài cùng bên phải trong mỗi cửa sổ `w`, loại lần chọn lặp cùng vị trí. Với mặc định k=5, w=4, mỗi file có fingerprint riêng kèm đường dẫn, dòng và vị trí token. File ít hơn k token không có fingerprint. Parser giới hạn 30 giây/512 MiB/50000 token toàn bài.

Fingerprint được lưu transaction vào `ast_fingerprints`. `plagiarism_reports` so sánh các bài **cùng bài kiểm tra và cùng version/k/w**; mỗi bài kiểm tra có một ngôn ngữ. Công thức hiện tại: `100 × số hash chung / min(số hash phân biệt A, số hash phân biệt B)`; tập rỗng cho 0%. Cặp bài lưu thứ tự ID A < B để tránh hai báo cáo đảo chiều. Mức đánh dấu: ≥80% `SUSPECTED`, ≥50% `MODERATE`, còn lại `LOW`. Cấu trúc ngắn hoặc code mẫu có thể tạo điểm cao; giảng viên cần xem mã nguồn trước khi kết luận. Chưa có loại trừ starter code hoặc so khớp cây bằng Tree Edit Distance.

AST có trạng thái riêng `PENDING/RUNNING/COMPLETED/ERROR`; lỗi AST giữ nguyên điểm Sandbox. BullMQ có 3 lần thử và backoff; mỗi queue có concurrency 2. Worker đối soát receipt `QUEUED` và AST `PENDING` của bài chấm xong mỗi 10 giây. API/worker dùng storage chung; không đưa cả ZIP vào Redis.

| Vị trí | Nội dung |
| --- | --- |
| `apps/backend/storage/archives/<uuid>.zip` | ZIP gốc, kiểm tra lại SHA-256 trước khi compiler/parser đọc |
| `apps/backend/storage/logs/<submission-id>.jsonl` | Log compiler/testcase/AST, StdOut/StdErr, exit code, thời gian/RAM |
| PostgreSQL | Metadata, điểm/test diagnostics, fingerprint và báo cáo tương đồng |
| Docker named volumes | Dữ liệu PostgreSQL/Redis tồn tại sau khi stop |

Log có thể chứa output test ẩn; chỉ người vận hành đọc thư mục log. API che output test ẩn đối với sinh viên. Storage chưa tự xóa theo lịch; sao lưu cùng DB và quản lý dung lượng theo đợt học. Container được xóa trong `finally`; nếu worker bị kill cưỡng bức, kiểm tra các container có label `aita.sandbox=true` trước khi xử lý container sót.

## 10. API chính

Mọi route dưới đây cần đăng nhập và kiểm tra quyền. Request ghi dữ liệu dùng cookie cần header `X-AITA-Request: 1`; client ngoài trình duyệt có thể dùng Bearer JWT.

| Route | Chức năng |
| --- | --- |
| `POST /api/exams/:examId/submissions` | Multipart `file=<ZIP>`, `entrypoint=<optional>`; JSON `sourceCode` cũ không còn dùng trên HTTP |
| `GET /api/submissions/:id` | Metadata, điểm, compiler diagnostics, test results và số fingerprint |
| `GET /api/submissions/:id/archive` | Tải ZIP với kiểm tra chủ bài/giảng viên |
| `GET /api/submissions/:id/fingerprints` | Tối đa 1000 fingerprint; trả tổng số và hash dạng string |
| `GET /api/exams/:examId/submissions` | Danh sách bài nộp của giảng viên sở hữu lớp/admin |
| `GET /api/exams/:examId/plagiarism` | Báo cáo cặp bài; chỉ giảng viên sở hữu lớp/admin |

Các bài raw text cũ được migration đánh dấu `LEGACY_TEXT`, AST `SKIPPED`. Điểm cũ được giữ; muốn chấm Docker/AST thì nộp lại bằng ZIP. MockSandbox chỉ dùng khi kiểm thử queue có inject mock rõ ràng, không phải mặc định của worker.

## 11. Chạy kiểm thử

Unit test không cần chạy Docker:

```powershell
npm.cmd --prefix apps/backend test
npm.cmd run build:frontend
```

Integration dùng **database riêng**, không dùng `aita_db`. Tạo database test một lần:

```powershell
docker compose exec postgres createdb -U aita aita_m2_test
```

Nếu database đã tồn tại, giữ nguyên và bỏ qua lệnh tạo. Tạo `apps/backend/.env.test`, dùng đúng mật khẩu local:

```dotenv
TEST_DATABASE_URL="postgresql://aita:aita_local_123@localhost:5432/aita_m2_test?schema=public"
```

Sau đó:

```powershell
cd apps/backend
npm.cmd run test:db:setup
npm.cmd run test:integration
npm.cmd run test:sandbox
```

`test:integration` kiểm tra Auth, Google token giả, Excel transaction/rollback, quyền và queue bằng mock được inject rõ ràng. `test:sandbox` cần Docker + ba runner image + DB test + Redis; kiểm tra Python/C#/Java compile/run/AST, AC/WA, lỗi cú pháp, timeout, OOM, output limit, StdOut/StdErr, mạng tắt, UID non-root, rootfs chỉ đọc, container cleanup và luồng ZIP/BullMQ/fingerprint/báo cáo DB thật. Test tạo tài khoản/lớp/storage riêng và dọn các fixture đó.

## 12. Lỗi thường gặp

| Lỗi/hiện tượng | Cách xử lý |
| --- | --- |
| `Port 5000/5173 is already in use` | Dừng terminal đang chạy bằng Ctrl+C. Dùng `Get-NetTCPConnection -State Listen -LocalPort 5000,5173` và `Get-Process -Id <PID>` để xác định trước khi dừng đúng process. Chỉ chạy một `npm start`. |
| Prisma `EPERM ... query_engine-windows.dll.node` | Dừng API, worker và Prisma Studio, chạy lại `npm.cmd run db:setup`, sau đó khởi động web. |
| `ENOENT ... docker_engine` / Docker unavailable | Mở Docker Desktop, chọn Linux containers, kiểm tra `docker info` và socket của worker. |
| `No such image` | Chạy `npm.cmd run sandbox:build`, kiểm tra tên image trong `.env`, khởi động lại worker. |
| Bài đứng `QUEUED` | Kiểm tra terminal worker, `docker compose ps`, `REDIS_URL`, `QUEUE_PREFIX` của API và worker. Receipt sẽ được đối soát lại khi worker hoạt động. |
| Bài `FAILED`, SHA-256 mismatch | ZIP trên storage bị thay đổi. Giữ log để điều tra và nộp lại ZIP; không sửa hash DB để bỏ qua xác thực. |
| Bài `COMPILE_ERROR` | Xem compiler message. Kiểm tra ngôn ngữ bài thi, extension, Main/entrypoint và việc dùng package ngoài. |
| AST `ERROR` | Xem `astMessage`: cú pháp sai, quá nhiều token hoặc runner/parser lỗi. Điểm chấm vẫn được giữ. Sửa bài rồi nộp lại. |
| `origin is not allowed` khi login Google | Thêm đúng scheme/host/port vào Authorized JavaScript origins. Dùng localhost:5173; kiểm tra test users/audience. |
| Không thấy lớp/bài tập | Kiểm tra enrollment có đúng email đăng nhập, trạng thái ACTIVE và vai trò. |
| Đổi password root `.env` nhưng DB không login | PostgreSQL volume đã khởi tạo bằng mật khẩu cũ; dùng mật khẩu hiện tại hoặc thay mật khẩu qua SQL bằng quyền quản trị. Không xóa volume để sửa lỗi kết nối. |

## 13. Build để chạy bằng JavaScript

```powershell
cd D:\GitHub\swp
npm.cmd run build:backend
npm.cmd run build:frontend
```

Chạy backend và worker bằng hai process riêng, với working directory `apps/backend`:

```powershell
cd apps/backend
npm.cmd start
# Terminal khác, cùng thư mục:
npm.cmd run start:worker
```

Frontend build nằm ở `apps/frontend/dist`; cấu hình web server phục vụ SPA (fallback về `index.html`) và reverse proxy `/api` tới backend. `npm start` tại root là chế độ phát triển, không tự phục vụ frontend production. API/worker cần cùng DB/Redis/storage; worker cần Docker socket. Trước khi public, cấu hình HTTPS, origins chính xác và secrets riêng. Với mã nguồn không tin cậy ngoài phạm vi lớp học, triển khai worker trên máy/VM riêng và đánh giá cách ly runtime theo mô hình vận hành.

## 14. Mã nguồn và tài liệu

- `docker/sandbox/`: Dockerfile, trusted compiler và AST parser.
- `apps/backend/src/infrastructure/sandbox/docker-sandbox.service.ts`: Docker API, giới hạn và thu diagnostics.
- `apps/backend/src/infrastructure/storage/submission-archive.ts`: ZIP và SHA-256.
- `apps/backend/src/modules/rbl/`: token fingerprints, Winnowing và báo cáo.
- `apps/backend/prisma/schema.prisma`: schema DB; `prisma/migrations/`: migration version hóa.
- [Syllabus](RBL_Syllabus_AITA_10Weeks.md), [thiết kế DB](DATABASE_DESIGN_3NF.md), [Auth/import/queue](MILESTONE_2_AUTH_IMPORT_QUEUE.md).
- [Python ast](https://docs.python.org/3.12/library/ast.html), [Roslyn syntax analysis](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/get-started/syntax-analysis), [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/), [Docker security](https://docs.docker.com/engine/security/), [bài báo Winnowing gốc](https://www.cs.princeton.edu/courses/archive/spring05/cos598E/bib/p76-schleimer.pdf).
