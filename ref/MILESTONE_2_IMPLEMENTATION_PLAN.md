# Kế hoạch thực hiện Milestone 2 — AITA-Intelligent

Ngày lập: 06/10/2026. Thời lượng dự kiến: 3 tuần, tương ứng tuần 3–5 trong roadmap; nghiệm thu cuối tuần 5. Chưa có ngày bảo vệ cụ thể nên lịch dưới đây dùng ngày làm việc D1–D15. Phân công theo TV1–TV5 trong roadmap, chưa gán tên thành viên.

## 1. Mục tiêu và cơ sở lập kế hoạch

Hoàn thành hai workflow chạy bằng dữ liệu và xử lý thật, có nhánh ngoại lệ, đồng thời chuẩn bị minh chứng Sandbox và AST cho đánh giá milestone 2.

- **Workflow 1 — Thiết lập dữ liệu:** đăng nhập → tạo/quản lý lớp → import sinh viên từ Excel → tạo bài thi → cấu hình testcase.
- **Workflow 2 — Nộp và chấm bài:** sinh viên hợp lệ nộp ZIP → xác thực/lưu/hash → Redis/BullMQ → Docker biên dịch và chạy testcase → lưu kết quả → sinh viên xem kết quả. AST chạy độc lập trên dữ liệu bài nộp, lưu fingerprints và tạo báo cáo tương đồng để demo.
- Hai workflow trên là cách ánh xạ đề xuất cho AITA theo rubric; rubric chỉ nêu Workflow 1/2, chưa định nghĩa chi tiết riêng cho dự án.

Nguồn đối chiếu:

1. `AITA_Intelligent_SRS_v1.1_Approved_UseCases_Revised.docx`: chuẩn hành vi, ngôn ngữ, giới hạn và công thức.
2. `Template0_ SWP391_Milestones_FinalEvaluation_Rubrics.xlsx`, sheet `Milestone2`: chuẩn đánh giá đầu ra.
3. `PROJECT_ROADMAP_10WEEKS_AITA.md` và `RBL_Syllabus_AITA_10Weeks.md`: lịch tuần 3–5, ownership và thực nghiệm.
4. Mã nguồn hiện tại trong `apps/backend`, `apps/frontend` và `test_e2e.ps1`: cơ sở xác định phần tái sử dụng và phần còn thiếu.

**Nguyên tắc xử lý khác biệt:** dùng SRS đã duyệt cho kỹ thuật; dùng rubric cho minh chứng nghiệm thu; dùng roadmap cho trình tự và phân công. Không tự đổi SRS để khớp các ví dụ cũ trong roadmap.

| Nội dung | Chuẩn áp dụng trong kế hoạch |
| --- | --- |
| Ngôn ngữ ban đầu | C#/.NET 8 và Java JDK 17; cập nhật các mặc định Python trong mã hiện tại |
| Sandbox | 512 MiB RAM, 1.0 vCPU, tối đa 10 giây/testcase, ngắt mạng ngoài |
| ZIP | Tối đa 25 MiB; tỷ lệ giải nén tối đa 100:1; tối đa 1.000 file; từ chối path traversal |
| Phiên đăng nhập | Access token 15 phút; refresh token 7 ngày trong cookie Secure, HttpOnly, SameSite=Strict; logout vô hiệu hóa token đang hoạt động |
| Miền SSO | Cấu hình miền được phép, gồm `@fpt.edu.vn` và `@fe.edu.vn` |
| Similarity | 100 × số fingerprints chung / số fingerprints của tập nhỏ hơn; từ 80% là nghi vấn đạo văn, từ 50% đến dưới 80% là thông tin tương đồng vừa |
| Phạm vi | Web App; đánh giá chéo của môn học là hoạt động kiểm thử bên ngoài, không thêm tính năng chấm Peer Review vào sản phẩm |

Phân biệt **similarity của một cặp bài**, **tỷ lệ phát hiện trên dataset** và **coverage test**. Ngưỡng similarity 80% không đồng nghĩa recall 80%; báo cáo phải trình bày riêng.

## 2. Hiện trạng và khoảng cách cần xử lý

Nhận định dưới đây dựa trên đọc mã nguồn, chưa phải kết quả kiểm thử vận hành.

| Hạng mục | Hiện có | Việc cần làm |
| --- | --- | --- |
| Frontend | Login/register, dashboard, tạo bài thi, nộp code dạng text, xem kết quả | SSO, phiên cookie, import có preview/mapping, nộp ZIP, hiển thị trạng thái/lỗi thật |
| Backend | Express, controller/service/repository cho auth, lớp, bài thi, bài nộp | Validation, quyền sở hữu tài nguyên, API contract, bổ sung nghiệp vụ quản lý còn thiếu |
| Auth | JWT 7 ngày; frontend lưu token trong localStorage | Access/refresh theo SRS; logout/revoke; không cho đăng ký công khai tự chọn ADMIN/LECTURER; bỏ secret mặc định |
| Database | Prisma dùng SQLite, có 10 model | PostgreSQL, migration, seed, transaction import, đối chiếu ERD và constraints |
| Queue | `InMemoryJobQueue`; worker phụ thuộc trực tiếp implementation này | BullMQ/Redis; worker process riêng; retry, persistence, idempotency |
| Sandbox | `MockSandboxService` giả lập kết quả từ chuỗi code và expected output | Docker runner thật cho C#/Java, compile/runtime diagnostics và số liệu tài nguyên thật |
| Submission | JSON `sourceCode`; SHA-256 trên chuỗi code | Multipart ZIP, lưu file riêng, hash archive, kiểm tra giải nén, receipt và kiểm soát truy cập |
| AST | Có bảng fingerprints/report; chưa thấy engine trong source đã rà soát | Parser C#/Java, normalization, Winnowing, containment similarity, lưu DB và thực nghiệm |
| GenAI | Chưa thấy module trong source đã rà soát | Dataset ngụy trang có kiểm chứng; prototype sinh đề/rubric nếu tiến độ cho phép |
| Kiểm thử | Có script E2E cho luồng demo hiện tại | Assertion, dữ liệu độc lập cho mỗi lần chạy, nhánh ngoại lệ, minh chứng bảo mật và retry |

Ưu tiên P0: Auth/quyền, import, PostgreSQL/Redis, ZIP, Sandbox thật, pipeline chấm, AST và minh chứng rubric. P1: prototype sinh đề/rubric và hoàn thiện giao diện báo cáo. Semantic review đầy đủ, WebSocket toàn pipeline, appeals, Git analytics và dashboard báo cáo toàn diện theo lịch milestone 3; kết quả milestone 2 phải được ghi rõ là điểm Sandbox, không gọi là Net Score hoàn chỉnh.

## 3. Backlog và phân công

Ước lượng là ngày công chủ động của người phụ trách, có thể làm song song giữa thành viên. Đây là dự toán ban đầu, cập nhật sau checkpoint D3.

| ID | Công việc / đầu ra | Chủ trì | Phụ thuộc | Ước lượng |
| --- | --- | --- | --- | --- |
| M2-01 | Chốt UC, OpenAPI, DTO Sandbox/AST, trạng thái và fixture mẫu | TV5 + TV1 | Không | 1 |
| M2-02 | Compose PostgreSQL/Redis, migration, seed C#/Java, build CI | TV5 | M2-01 | 1,5 |
| M2-03 | Auth SSO/local, refresh/revoke và RBAC theo tài nguyên | TV5 | M2-01, M2-02 | 2 |
| M2-04 | Import XLSX: mapping/preview, validate, atomic commit/rollback | TV5 | M2-02, M2-03 | 1,5 |
| M2-05 | UI SSO/session, lớp và import, bài thi/testcase | TV1 | M2-01; nối API sau M2-03/04 | 4 |
| M2-06 | ZIP intake: limits, lưu/hash, kiểm tra enrollment/thời hạn, receipt | TV5 | M2-02, M2-03; phối hợp TV2 | 1,5 |
| M2-07 | Docker runner C#/Java: compile, stdin/stdout/stderr, kết quả thật | TV2 | M2-01 | 4 |
| M2-08 | Cô lập tài nguyên, timeout, giải nén an toàn và cleanup | TV2 | M2-07; phối hợp M2-06 | 3 |
| M2-09 | BullMQ worker: chấm thật, lưu DB, retry và chống ghi lặp | TV5 | M2-02, M2-06, M2-07 | 2 |
| M2-10 | UI ZIP upload, receipt, polling kết quả và lỗi | TV1 | M2-01; nối API sau M2-06/09 | 3 |
| M2-11 | Parser/normalize C# và Java; CLI có token output xác định | TV4 | M2-01 | 4 |
| M2-12 | Winnowing, similarity, lưu fingerprints/report, ma trận độc lập | TV4 | M2-11, M2-02 | 3 |
| M2-13 | 50 biến thể từ 5 bài gốc, nhãn và kiểm chứng input/output | TV3 | M2-01; gửi mẫu sớm cho TV4 | 4 |
| M2-14 | Baseline text vs AST, negative pairs, lỗi parsing và báo cáo | TV4 + TV3 | M2-12, M2-13 | 2 |
| M2-15 | Prototype sinh đề/rubric/testcase JSON, xử lý lỗi provider | TV3 | Contract đã chốt; P1 | 2 |
| M2-16 | Kiểm thử liên module, sửa lỗi, demo và gói minh chứng | Cả nhóm, TV1 điều phối | Các đầu việc P0 | 2/người |

TV5 có khoảng 10 ngày công trước phần nghiệm thu nên phải bảo vệ phạm vi. TV1 phụ trách mock/UI, TV2 sở hữu runner và extraction contract, TV3 sở hữu dataset/test fixtures; không dồn các việc này sang TV5. Chốt contract trước để mỗi người có thể triển khai module của mình.

## 4. Lịch thực hiện D1–D15

### Tuần 3 — D1–D5: chốt nền tảng và có bản chạy đầu tiên

- **D1:** đối chiếu SRS/rubric; chốt định dạng ZIP C#/Java, entrypoint, schema kết quả, trạng thái, quyền truy cập và contract import. Quy định case fingerprints rỗng là không đủ dữ liệu, không chia cho 0 hoặc gán 100%.
- **D2–D3:** TV5 dựng PostgreSQL/Redis/CI; TV1 phát triển UI theo mock contract; TV2 chạy chương trình mẫu trong Docker; TV4 thử parser cả hai ngôn ngữ; TV3 bàn giao ít nhất 10 biến thể có nhãn.
- **D4–D5:** nối login cơ bản; thử compile/pass/wrong-answer thật trên runner; AST xuất normalized tokens và fingerprints ban đầu; thử job trên BullMQ.
- **Checkpoint D3:** cả C# và Java phải có parser và runner mẫu. Nếu một ngôn ngữ bị kẹt, giải quyết dependency ngay và cập nhật dự toán; chưa công bố hỗ trợ khi chưa chạy được.
- **Gate cuối tuần:** Compose tái dựng được; contract và fixtures được review; runner không dùng expected output để tạo actual output; AST có kết quả xác định; mỗi thành viên có PR và minh chứng công việc.

### Tuần 4 — D6–D10: hoàn thiện các module P0

- TV5 hoàn thiện SSO/access-refresh, import transactional, ZIP intake và chuyển worker sang BullMQ.
- TV1 nối Auth/import thật, có mapping preview và lỗi từng dòng; hoàn thiện ZIP upload và màn hình trạng thái.
- TV2 áp giới hạn RAM/CPU/PIDs/thời gian/disk-output; chạy non-root, bỏ capabilities không cần thiết, không mount host secrets hoặc Docker socket vào container bài nộp; cleanup cả khi lỗi/timeout.
- TV4 hoàn thiện normalization/Winnowing cho C#/Java, tie chọn minimum bên phải, containment similarity và persistence; kiểm tra đổi tên, comment, thứ tự hàm bằng thực nghiệm, không giả định thuật toán tự bất biến với mọi biến đổi.
- TV3 giao đủ 50 biến thể trước D9 để TV4 còn thời gian đo; kiểm chứng biên dịch và testcase, lưu bài gốc, loại biến đổi, ngôn ngữ và nhãn. Bổ sung bài độc lập làm negative pairs.
- **Gate cuối tuần:** Workflow 1 chạy thật; một bài ZIP từ API đi qua Redis → Docker → DB; có AC/WA/compile-error/timeout; AST có báo cáo sơ bộ và dữ liệu đo tái lập được.

### Tuần 5 — D11–D15: tích hợp, kiểm thử và nghiệm thu

- **D11–D12:** nối UI → upload → queue → Docker → DB → kết quả; tích hợp đường chạy AST tối thiểu bằng CLI/API nội bộ, lưu fingerprints và xuất report thật. Kiểm tra hai ngôn ngữ, quyền, testcase ẩn và các nhánh ngoại lệ.
- **D13:** kiểm thử Sandbox trong môi trường kiểm thử cô lập; kiểm tra worker restart/retry; đo similarity và false positives trên dataset cố định; sửa các lỗi chặn demo.
- **D14:** đóng phạm vi P0, rehearsal từ DB/seed sạch, xuất log và bảng kết quả; hoàn thiện tài liệu cài đặt, đối chiếu rubric, rà soát commits/AI logs.
- **D15:** demo, thực hiện kiểm thử chéo theo lịch môn học, lưu kết quả thực tế và danh sách giới hạn/việc chuyển milestone 3.
- **Gate cuối tuần:** hai workflow chạy thật và có ít nhất hai nhánh ngoại lệ; không còn lỗi vượt quyền/lộ testcase ẩn/thoát Sandbox/mất bài nộp đã nhận mà chưa có cơ chế phục hồi.

Đường phụ thuộc cần theo dõi: contract → ZIP + PostgreSQL/Redis → Docker runner → worker → UI kết quả → kiểm thử. Nhánh nghiên cứu: parser C#/Java → normalization/Winnowing → dataset có nhãn → số liệu + report. Gửi dataset mẫu ngay tuần 3 để nhánh nghiên cứu không chờ tuần 4.

## 5. Tiêu chí nghiệm thu

### Workflow 1 — Thiết lập dữ liệu

- Login local và SSO đúng miền; token hết hạn được xử lý; logout/revoke có hiệu lực; sinh viên không tự nâng quyền.
- Giảng viên quản lý lớp/bài thi của mình; danh sách và chi tiết lọc theo người dùng; có các thao tác quản lý được UC yêu cầu, không ép hard-delete bản ghi đã có bài nộp chỉ để đủ CRUD.
- Import `.xlsx` dưới 10 MB, preview/mapping trước commit; dữ liệu hợp lệ tạo user/enrollment đúng; lỗi không phục hồi rollback cả batch; chính sách added/skipped/trùng lặp rõ ràng.
- Testcase công khai/ẩn phân tách; dữ liệu bài thi, giới hạn C#/Java và thời gian hợp lệ; enrollment và liên kết PK/FK đầy đủ.

### Workflow 2 — Nộp và chấm bài

- ZIP đúng chuẩn được lưu và hash SHA-256 trên archive; receipt có submission ID; submission lưu đường dẫn file, không nhét raw code vào `sourceCodeUrl`.
- Chỉ sinh viên thuộc lớp được nộp trong thời hạn; chỉ chủ bài và giảng viên có quyền xem kết quả; testcase ẩn không bị lộ qua API/diagnostics.
- BullMQ xử lý bất đồng bộ, worker tách khỏi API; restart không mất job; retry không nhân đôi điểm hoặc test results. Có bước đối soát bài đã lưu DB nhưng enqueue lỗi.
- C#/Java được compile/run thật; actual output được so với expected output ở grader; ghi stdout/stderr, exit code, thời gian và bộ nhớ thật. Trạng thái compilation failure, timeout, runtime error, memory limit được phân biệt.
- Container giới hạn 512 MiB/1.0 vCPU/10 giây mỗi testcase, không mạng ngoài; giới hạn process và lượng file/output; không truy cập được host secret; container/thư mục tạm được dọn cả khi bị dừng.
- UI hiển thị receipt và kết quả bằng polling trong milestone 2; các lỗi chấm không làm treo màn hình hoặc API.

### AST và minh chứng nghiên cứu

- Parser không thực thi bài nộp; normalize C#/Java có output xác định; lưu tham số k/w và phiên bản thuật toán cùng kết quả thực nghiệm.
- Similarity đúng containment theo SRS; ngưỡng 50/80% đúng; xử lý bài ngắn, rỗng và parsing failure rõ ràng.
- Dataset có 50 biến thể được kiểm chứng và negative pairs; báo cáo similarity từng cặp, precision/recall theo nhãn, false positives và thời gian xử lý; so với baseline raw text.
- Demo các biến thể bề mặt đạt ngưỡng similarity kỳ vọng của roadmap trên tập kiểm thử đã khai báo. Đổi cấu trúc vòng lặp/dead code/đảo hàm phải báo cáo kết quả đo thực tế; không cam kết mọi biến thể đều đạt 80%.
- Ma trận/report ở milestone 2 có thể xuất CLI/JSON/CSV; giao diện heatmap và toàn pipeline AST tự động hoàn thiện theo milestone 3.

## 6. Bộ kiểm thử và kịch bản demo

Mỗi ca kiểm thử có input, expected behavior, actual result và log; dùng dữ liệu riêng cho từng lần chạy. Nâng `test_e2e.ps1` thành kiểm tra có assertion và polling có deadline, cập nhật cookie auth/ZIP/C#/Java.

| Nhóm | Các ca bắt buộc |
| --- | --- |
| Auth/quyền | Login đúng/sai; miền SSO sai; refresh hết hạn; logout; tự nâng quyền; truy cập lớp/bài của người khác |
| Import | File hợp lệ; sai mapping; email lỗi; trùng dòng; file hỏng; transaction rollback; import bởi người không sở hữu lớp |
| ZIP | Hợp lệ; vượt 25 MiB; zip-slip; tỷ lệ giải nén/file count vượt giới hạn; chưa vào lớp; nộp ngoài thời gian |
| Sandbox | C#/Java AC và WA; compile error; runtime error; timeout; vượt RAM; bị chặn mạng; không đọc host secret; cleanup |
| Queue | API trả receipt trước khi chấm xong; worker restart; retry; kết quả không ghi lặp; enqueue lỗi có phục hồi |
| AST | Bản giống nhau; đổi tên/comment; đảo hàm; biến đổi cấu trúc; bài độc lập; fingerprints rỗng; lỗi parser; tie Winnowing |

**Demo đề xuất 10–12 phút:** đăng nhập giảng viên → tạo lớp → preview/import → tạo bài thi/testcase → sinh viên upload ZIP C#/Java → theo dõi queue và kết quả thật → demo compile-error và timeout → xuất AST similarity → trình bày giới hạn tài nguyên và rubric evidence.

Hai nhánh ngoại lệ tối thiểu của Workflow 2 là compile-error và timeout. Import rollback và upload bị từ chối là minh chứng bổ sung. Kiểm thử gây tải thực hiện trên môi trường kiểm thử riêng, theo dõi host và container.

## 7. Gói bàn giao và đối chiếu rubric

| Tiêu chí milestone 2 | Trọng số trong rubric | Minh chứng cần bàn giao |
| --- | --- | --- |
| Workflow Implementation | 50% | Hai workflow, main flow và ≥2 exception paths; checklist, kết quả chạy, ảnh/video demo |
| Codebase & Database | 30% | Controller/service/repository; nghiệp vụ quản lý đầy đủ trong phạm vi UC; ≥10 bảng, schema chuẩn hóa, PK/FK, ERD và migration |
| Collaboration + AI debugging | 20% | ≥8 commits có nội dung thực chất/mỗi thành viên và ≥6 AI debugging logs theo rubric; PR/review, lỗi, cách sửa và kiểm chứng |

Trọng số 50/30/20 là phân bổ **trong sheet Milestone2**; roadmap/syllabus ghi milestone 2 chiếm 20% điểm học phần. Không trộn tỷ trọng này với công thức Net Score của sản phẩm.

Gói cuối milestone gồm code và hướng dẫn tái dựng, Compose/seed, OpenAPI và DTO, ERD cập nhật, hướng dẫn ZIP C#/Java, test report, Sandbox logs, dataset/AST report, slide hoặc demo script, weekly reports và AI debugging logs. Schema hiện có 10 model; cần kiểm chứng migration và quan hệ, không thêm bảng hình thức để đạt số lượng.

Coverage ≥80% và bộ ≥25 test cases thuộc yêu cầu milestone 3/final trong các tài liệu đã đọc. Milestone 2 vẫn kiểm thử đầy đủ các hành vi trên, nhưng không gán các mốc này thành tiêu chí chính thức của sheet Milestone2.

## 8. Theo dõi tiến độ và xử lý rủi ro

- Mỗi ngày cập nhật đầu việc, PR, blocker và ngày dự kiến hoàn thành; review giữa tuần và cuối tuần. Mỗi PR nêu UC liên quan và cách kiểm chứng.
- **Rủi ro C#/Java:** parser và runner cả hai ngôn ngữ phải chạy mẫu trước D3; fixture phải thống nhất packaging/entrypoint trước khi phát triển upload.
- **Rủi ro tích hợp muộn:** có pipeline thật đầu tiên trước D10; D11–D12 dành cho UI và ngoại lệ, D13–D14 dành cho sửa lỗi/rehearsal.
- **Rủi ro quá tải TV5:** UI/mocks, runner, dataset và AST giữ đúng ownership; cắt P1 trước nếu trễ, giữ P0 và báo rõ phần chưa đạt.
- **Rủi ro OAuth:** chuẩn bị client/redirect URI và tài khoản test trong D1; mock dùng cho phát triển, gate cuối milestone phải có kiểm chứng SSO thật.
- **Rủi ro Windows/Docker:** xác nhận môi trường Linux containers trong D1; kiểm thử giới hạn tài nguyên trên môi trường nghiệm thu, không dùng số ngẫu nhiên của mock làm bằng chứng.
- **Rủi ro similarity sai:** dùng công thức SRS, dữ liệu gán nhãn và negative pairs; ghi rõ hạn chế với biến đổi cấu trúc, tránh suy ra đạo văn chỉ từ similarity.
- **Rủi ro lệch tài liệu:** giữ bảng đối chiếu SRS–roadmap–rubric trong PR đầu tiên; nếu giảng viên đưa tiêu chí mới, cập nhật kế hoạch và ghi thay đổi phạm vi trước triển khai phần phụ thuộc.

Việc bắt đầu ngay: M2-01 và M2-02, đồng thời TV2/TV4 kiểm chứng runner/parser C# và Java, TV1 dựng UI theo contract, TV3 tạo dataset mẫu. Kế hoạch này chưa triển khai thay đổi mã nguồn hay chạy các bài kiểm thử sản phẩm.
