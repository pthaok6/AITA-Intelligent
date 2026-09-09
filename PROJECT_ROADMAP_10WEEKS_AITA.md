# KẾ HOẠCH PHÁT TRIỂN DỰ ÁN 10 TUẦN: AITA-INTELLIGENT
## HỆ THỐNG TRỢ LÝ GIẢNG DẠY THÔNG MINH & PHÂN TÍCH MÃ NGUỒN AST
**Học phần:** SWP391 - Phiên bản RBL (Research-Based Learning)  
**Phương pháp:** Kiến trúc Ownership Phân quyền • Chiến lược Contract-First • Đánh giá P2P (École 42)

---

## I. MA TRẬN PHÂN QUYỀN SỞ HỮU (DOMAIN OWNERSHIP MATRIX)

| Thành viên | Danh xưng & Vai trò | Phân hệ phụ trách chính | Công nghệ chủ đạo | Trách nhiệm cốt lõi |
| :--- | :--- | :--- | :--- | :--- |
| **TV 1** | **Frontend & Integration Lead** | Phân hệ 1: Portal & Auth Subsystem | React, Vite, TypeScript, Tailwind CSS, TanStack Query | Toàn bộ UI/UX sinh viên & giảng viên, JWT/SSO, điều phối tích hợp API, kịch bản Demo |
| **TV 2** | **Systems & Sandbox Security Engineer** | Phân hệ 2: Docker Autograding Sandbox | Docker Engine SDK, Linux Security (cgroups, seccomp), Shell | Module thực thi mã nguồn cô lập (512MB RAM, network none), Test runner StdIn/StdOut, phòng thủ mã độc |
| **TV 3** | **GenAI Core & Dataset Lead** | Phân hệ 3: GenAI Core & Review Hub | OpenAI GPT-4o / Gemini API, LangChain, Python/Node | Sinh đề bài/rubric, Semantic Code Review (Clean Code/SOLID), tạo dataset mã nguồn ngụy trang cho TV4 |
| **TV 4** | **AST Plagiarism & Research Lead** | Phân hệ 4: AST Plagiarism Engine | Python AST Parser, Winnowing Algorithm, NetworkX | Khử ngụy trang cú pháp AST, băm k-grams & vân tay số Winnowing, ma trận tương đồng, Trưởng nhóm nghiên cứu IEEE |
| **TV 5** | **Backend Infra & DevOps Engineer** | Phân hệ 5: Redis Queue & Core Infrastructure | PostgreSQL/Prisma, Redis (BullMQ), WebSockets, Docker Compose, k6 | CSDL chuẩn 3NF, API Gateway, điều phối hàng đợi chấm bài bất đồng bộ, WebSocket realtime, CI/CD, đo tải k6 |

---

## II. QUY TẮC "CONTRACT-FIRST" ĐỂ PHÁT TRIỂN SONG SONG (TUẦN 3 – 5)

Để tránh tình trạng "người này ngồi chờ người kia code xong", nhóm áp dụng 3 quy tắc bất khả xâm phạm:
1. **Chốt Contract vào cuối Tuần 2:** Chốt file OpenAPI/Swagger, DTOs giữa các tầng, và định dạng JSON Event trên Redis.
2. **Mocking độc lập ở Tuần 3 - 5:**
   * **TV1:** Dùng MSW (Mock Service Worker) để code xong toàn bộ UI mà không cần Backend.
   * **TV2:** Xây dựng Sandbox dưới dạng CLI độc lập (`input: code.zip + testcases/ -> output: execution_result.json`).
   * **TV3:** Tinh chỉnh Prompt trên tập lỗi biên dịch mẫu và tạo bộ dữ liệu 50 file code ngụy trang.
   * **TV4:** Xây dựng AST Engine dưới dạng CLI độc lập (`input: source_folder/ -> output: similarity_matrix.json`).
   * **TV5:** Dựng Redis BullMQ với Mock Worker giả lập để kiểm tra luồng nhận hàng ngàn job.
3. **Không ai ôm việc của người khác:** Mỗi người làm chủ từ code, unit test, tài liệu đến kết quả thực nghiệm của phân hệ mình.

---

## III. LỘ TRÌNH CHI TIẾT THEO TỪNG TUẦN (WEEK-BY-WEEK SPRINT PLAN)

---

### GIAI ĐOẠN 1: THIẾT KẾ KIẾN TRÚC, CONTRACTS & ĐỀ XUẤT NGHIÊN CỨU
#### 🎯 CỘT MỐC: MILESTONE 1 (TUẦN 1 – TUẦN 2) • TRỌNG SỐ: 15%

---

#### TUẦN 1: KHỞI ĐỘNG DỰ ÁN, PHÂN TÍCH SRS & THIẾT KẾ CƠ SỞ DỮ LIỆU
* **Mục tiêu tuần (Sprint Goal):** Hoàn thành tài liệu đặc tả yêu cầu phần mềm (SRS), thiết kế CSDL chuẩn hóa 3NF và thiết lập môi trường Monorepo.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Khởi tạo dự án Frontend bằng Vite + React + TypeScript + Tailwind CSS.
    * Vẽ Sitemap và Mockup UI (Figma) cho 4 màn hình chính: Đăng nhập, Dashboard Giảng viên, Danh sách kỳ thi, Màn hình nộp bài của Sinh viên.
    * Viết phần SRS: Lập biểu đồ UML Use Case tổng thể và Activity Diagram cho luồng nộp bài.
  * **TV 2 (Sandbox):**
    * Nghiên cứu tài liệu Docker Engine API và cơ chế bảo mật Linux (`cgroups v2`, `rlimit`, `namespaces`).
    * Thiết kế cấu trúc thư mục lưu trữ tạm thời cho bài nộp khi giải nén: `/tmp/aita_runs/{submission_id}/`.
    * Chuẩn bị danh sách testcases độc hại mẫu (vòng lặp vô hạn, fork-bomb, lệnh đọc `/etc/passwd` hoặc `.env`) để chuẩn bị kiểm thử.
  * **TV 3 (GenAI):**
    * Đăng ký và cấu hình các API keys (OpenAI GPT-4o, Google Gemini Pro).
    * Thiết kế định dạng JSON mong muốn cho kết quả sinh đề và rubric (`ExamGenerationSchema`, `RubricCriteriaSchema`).
    * Viết thử nghiệm prompt cơ bản trên Google AI Studio / OpenAI Playground để đánh giá chất lượng phản hồi.
  * **TV 4 (AST & Research Lead):**
    * Đọc bài báo gốc *"Winnowing: An Algorithm for Document Fingerprinting"* (Schleimer et al., ACM SIGMOD 2003).
    * Khảo sát module `ast` trong Python: cách duyệt cây cú pháp bằng `NodeVisitor` và cách loại bỏ comments/docstrings/variable names.
    * Soạn thảo khung sườn của **Research Proposal (Đề xuất nghiên cứu RBL)**.
  * **TV 5 (Infra & DevOps):**
    * Khởi tạo Git Monorepo, cấu hình Branch Protection (`main`, `develop`), thiết lập linter (ESLint, Prettier).
    * Thiết kế sơ đồ quan hệ thực thể (ERD) chuẩn 3NF: các bảng `Users`, `Classes`, `Exams`, `Submissions`, `TestCases`, `ASTFingerprints`, `PlagiarismReports`, `AIReviews`.
    * Viết file `docker-compose.yml` khởi tạo PostgreSQL và Redis cục bộ.

* **Giao thức phối hợp (Sync & Deliverables):**
  * Cuối tuần 1: Cả nhóm họp review bản vẽ ERD của TV5 và Mockup Figma của TV1 để đảm bảo khớp trường dữ liệu.

---

#### TUẦN 2: CHỐT "CONTRACT-FIRST", HOÀN THIỆN PROPOSAL & BẢO VỆ MILESTONE 1
* **Mục tiêu tuần (Sprint Goal):** Ban hành bộ Contracts chính thức (Swagger/OpenAPI & DTOs), hoàn thành Research Proposal và vượt qua đợt đánh giá P2P Milestone 1.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Thống nhất danh sách REST API endpoints với TV5 (Authentication, Submission, Exam Management).
    * Cài đặt Mock Service Worker (MSW) trong React để chuẩn bị mock data cho tuần 3.
    * Tổng hợp slide thuyết trình cho buổi bảo vệ Milestone 1.
  * **TV 2 (Sandbox):**
    * Thống nhất với TV5 định dạng JSON kết quả chạy Sandbox (`SandboxExecutionResultDTO` gồm `exitCode`, `stdout`, `stderr`, `timeMs`, `memoryKb`, `status`).
    * Viết Dockerfile cho base runner image (chứa compiler gcc/g++, openjdk, hoặc .NET SDK).
  * **TV 3 (GenAI):**
    * Chốt schema DTO cho kết quả review Clean Code và giải nghĩa lỗi biên dịch với TV1 và TV5.
    * Đóng góp phần phân tích "Các kỹ thuật ngụy trang code bằng GenAI" vào Research Proposal của TV4.
  * **TV 4 (AST & Research Lead):**
    * Hoàn thiện và nộp bản **Research Proposal** (Mục tiêu, phương pháp AST + Winnowing, tập dữ liệu thực nghiệm dự kiến, chỉ số đo lường Precision/Recall).
    * Thống nhất cấu trúc bảng lưu trữ vân tay số: `hash_value (bigint)`, `submission_id (uuid)`, `position_index (int)`.
  * **TV 5 (Infra & DevOps):**
    * Viết file `openapi.yaml` (Swagger documentation) chuẩn hóa tất cả request/response body.
    * Viết migration CSDL khởi tạo đầy đủ các bảng trong PostgreSQL.
    * Cấu hình GitHub Actions tự động kiểm tra cú pháp (Lint check) và build thử nghiệm.

* **🎯 CỘT MỐC ĐÁNH GIÁ P2P MILESTONE 1 (Cuối tuần 2 - 15%):**
  * **Hoạt động P2P:** Nhóm tiến hành chấm chéo tài liệu SRS và CSDL ERD của nhóm bạn theo checklist (chuẩn 3NF, tính toàn vẹn khóa ngoại, logic nghiệp vụ).
  * **Bảo vệ trước Giảng viên:** TV1 và TV4 đại diện thuyết trình kiến trúc hệ thống và đề xuất nghiên cứu.

---

### GIAI ĐOẠN 2: PHÁT TRIỂN LÕI ĐỘC LẬP & THỰC NGHIỆM P2P TESTING
#### 🎯 CỘT MỐC: MILESTONE 2 (TUẦN 3 – TUẦN 5) • TRỌNG SỐ: 20%

---

#### TUẦN 3: PHÁT TRIỂN CÁC MODULE ĐỘC LẬP (ISOLATED DEVELOPMENT)
* **Mục tiêu tuần (Sprint Goal):** Mỗi thành viên lập trình độc lập module của mình dựa trên Contract đã chốt, không phụ thuộc hạ tầng mạng/backend.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Dựng giao diện Đăng nhập (nút Google SSO, Form JWT thông thường) kết hợp validate bằng Zod/React Hook Form.
    * Dựng giao diện Dashboard Giảng viên: Danh sách lớp học, bảng thống kê số lượng bài nộp.
    * Kết nối các components với MSW mock API.
  * **TV 2 (Sandbox):**
    * Lập trình Core Sandbox CLI bằng Python hoặc Node.js:
      * Nhận đường dẫn file zip và folder test cases.
      * Giải nén an toàn, tính mã băm SHA-256 xác thực.
      * Gọi Docker Engine API để tạo container chạy lệnh biên dịch/thực thi.
    * Kiểm thử việc bắt StdOut/StdErr khi chạy một file mã nguồn đơn giản.
  * **TV 3 (GenAI):**
    * Viết module wrapper gọi API OpenAI/Gemini hỗ trợ cơ chế tự động xoay vòng nhiều API Key (Round-robin key pool).
    * Xây dựng Prompt sinh đề bài tự động theo cấu trúc JSON: Nhập "Chủ đề: Cây nhị phân tìm kiếm, Độ khó: Trung bình" $\to$ sinh ra đề bài markdown, barem điểm và 5 cặp testcase input/output.
  * **TV 4 (AST & Research Lead):**
    * Lập trình **AST Parser**: Nhận file code Python/C $\to$ sinh cây cú pháp trừu tượng AST.
    * Xây dựng module **AST Normalization**:
      * Loại bỏ tên biến, tên hàm, thay thế bằng các token định danh chung (ví dụ: `ID`, `FUNC`).
      * Loại bỏ hoàn toàn comments, khoảng trắng, định dạng thụt lề.
      * Chuyển đổi AST đã chuẩn hóa thành chuỗi token tuyến tính.
  * **TV 5 (Infra & DevOps):**
    * Khởi tạo API Gateway (Express/NestJS hoặc FastAPI).
    * Cài đặt **BullMQ** kết nối Redis: Định nghĩa 2 queues chính: `grading-queue` (chấm testcases) và `plagiarism-queue` (so khớp AST).
    * Viết Mock Workers: Worker nhận job từ queue, in log mô phỏng và cập nhật trạng thái "COMPLETED" sau 3 giây.

* **Giao thức phối hợp (Sync & Deliverables):**
  * Họp giữa tuần: TV2 và TV4 demo bản chạy CLI độc lập trên máy local với dữ liệu mẫu.

---

#### TUẦN 4: THẮT CHẶT BẢO MẬT SANDBOX, GIẢI THUẬT WINNOWING & TẠO DATASET
* **Mục tiêu tuần (Sprint Goal):** Khóa chặt bảo mật Docker Sandbox, hoàn thiện thuật toán Winnowing và sinh bộ dữ liệu ngụy trang mã nguồn.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Xây dựng giao diện Nộp bài cho Sinh viên: Kéo thả file `.zip`, kiểm tra định dạng và dung lượng trước khi upload.
    * Xây dựng giao diện Bảng kết quả (Mockup): Hiển thị điểm testcase, điểm Clean Code và cảnh báo đạo văn.
    * Xây dựng tính năng Import danh sách sinh viên từ file Excel (phía client).
  * **TV 2 (Sandbox):**
    * **Khóa bảo mật Sandbox (Crucial):**
      * Cấu hình Docker Container cờ `--network none` (ngắt toàn bộ mạng ngoài).
      * Giới hạn RAM `--memory=512m` và swap memory `--memory-swap=512m`.
      * Thiết lập giới hạn thời gian chạy (Execution Timeout, ví dụ: tối đa 5 giây/testcase) bằng lệnh `timeout` để diệt vòng lặp vô hạn.
      * Chặn đọc file hệ thống host bằng cách chạy dưới user không có quyền root (`user: 1000:1000`).
    * Thử nghiệm tự nộp fork-bomb và script đọc `.env` vào Sandbox của mình để vá các lỗ hổng.
  * **TV 3 (GenAI & Dataset Lead):**
    * **Nhiệm vụ hỗ trợ nghiên cứu cho TV4:** 
      * Lấy 5 bài toán thuật toán mẫu chuẩn (Fibonacci, QuickSort, Dijkstra, BST, Knapsack).
      * Dùng Prompt GPT-4o sinh ra **50 biến thể mã nguồn ngụy trang** theo các cấp độ: (1) Đổi tên biến/hàm, (2) Đảo vị trí hàm, (3) Thay đổi cấu trúc lặp `for` thành `while`, (4) Chèn dead-code vô nghĩa.
      * Đóng gói bộ dataset này chuyển cho TV4 phục vụ thực nghiệm.
  * **TV 4 (AST & Research Lead):**
    * Lập trình **Thuật toán băm Winnowing**:
      * Trích xuất các chuỗi con $k$-grams từ chuỗi token đã chuẩn hóa.
      * Băm từng $k$-gram bằng thuật toán băm (ví dụ: Rolling Hash / MD5).
      * Áp dụng cửa sổ trượt kích thước $w$ (sliding window) để chọn ra giá trị băm nhỏ nhất làm vân tay số (fingerprints).
    * Bắt đầu nạp bộ 50 mã nguồn ngụy trang do TV3 cung cấp vào thuật toán Winnowing để đo tỷ lệ trùng lặp ban đầu.
  * **TV 5 (Infra & DevOps):**
    * Viết API Authentication hoàn chỉnh: Tích hợp Google OAuth2 Token Verify (miền `@fpt.edu.vn`), tạo Access Token và Refresh Token lưu trong HttpOnly Cookie.
    * Viết API Bulk Import: Đọc file Excel sinh viên, dùng **PostgreSQL Transaction** (`BEGIN ... COMMIT`) để đảm bảo không bị lỗi dữ liệu nửa chừng.

* **Giao thức phối hợp (Sync & Deliverables):**
  * TV3 bàn giao trọn vẹn thư mục dataset mã nguồn ngụy trang cho TV4 trước ngày Thứ Sáu của Tuần 4.

---

#### TUẦN 5: BẢO VỆ P2P MILESTONE 2 (HACKING CHÉO SANDBOX & AST BYPASS)
* **Mục tiêu tuần (Sprint Goal):** Hoàn thiện phân hệ Auth & Bulk Import, vượt qua bài thử thách tấn công Sandbox và thử thách vượt mặt thuật toán AST từ nhóm đối thủ.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Đấu nối giao diện Login với API Auth thật của TV5 (loại bỏ MSW ở phần đăng nhập).
    * Chuẩn bị kịch bản demo: Tạo tài khoản, đăng nhập Google SSO FPT, import danh sách lớp học.
  * **TV 2 (Sandbox - Phòng thủ):**
    * Đóng gói Sandbox Runner thành một service ổn định sẵn sàng nhận mã nguồn kiểm thử từ bên ngoài.
    * Soạn sẵn 3 đoạn mã độc (Infinite loop, Fork bomb, Disk filler) để mang đi tấn công Sandbox của nhóm đối thủ trong buổi P2P.
    * Giám sát tài nguyên máy chủ bằng `docker stats` trong suốt quá trình nhóm bạn tấn công vào Sandbox mình.
  * **TV 3 (GenAI - Tấn công):**
    * Lấy bài code mẫu từ đề thi của nhóm đối thủ, dùng Prompt GenAI ngụy trang cấp độ cao nhất (thay đổi toàn bộ logic luồng điều khiển nhưng giữ nguyên input/output).
    * Đại diện nhóm mang bài code ngụy trang này nộp vào hệ thống của nhóm đối thủ để kiểm tra khả năng phát hiện của họ.
  * **TV 4 (AST - Phòng thủ & Thực nghiệm):**
    * Chạy ma trận so sánh (Similarity Matrix) trên tập bài nộp của nhóm đối thủ trong buổi P2P.
    * Chứng minh tỷ lệ phát hiện tương đồng đối với code ngụy trang đạt $\ge 80\%$.
    * Ghi nhận dữ liệu thực nghiệm đầu tiên: Bảng so sánh giữa phát hiện bằng text thông thường vs phát hiện bằng AST + Winnowing.
  * **TV 5 (Infra & DevOps):**
    * Viết worker kết nối BullMQ với Sandbox của TV2 (chạy thử nghiệm local pipeline: Nộp bài qua API $\to$ Redis $\to$ Worker gọi Sandbox $\to$ Lưu kết quả vào DB).
    * Giữ ổn định server local/test, theo dõi log hệ thống.

* **🎯 CỘT MỐC ĐÁNH GIÁ P2P MILESTONE 2 (Cuối tuần 5 - 20%):**
  * **Thử thách 1 (Sandbox Penetration Test):** Nhóm đối thủ nộp mã độc vào Sandbox của TV2. Tiêu chí đạt: Sandbox không bị sập, không chiếm quá 512MB RAM, không đọc được file môi trường host.
  * **Thử thách 2 (AST Plagiarism Bypass):** Nhóm đối thủ nộp code đã qua AI ngụy trang. Tiêu chí đạt: Thuật toán của TV4 phát hiện độ tương đồng $\ge 80\%$.

---

### GIAI ĐOẠN 3: TÍCH HỢP TOÀN HỆ THỐNG, WEBSOCKETS & UAT SĂN LỖI
#### 🎯 CỘT MỐC: MILESTONE 3 (TUẦN 6 – TUẦN 8) • TRỌNG SỐ: 25%

---

#### TUẦN 6: GHÉP NỐI PIPELINE BẤT ĐỒNG BỘ (ASSEMBLY PIPELINE)
* **Mục tiêu tuần (Sprint Goal):** Kết nối thông suốt chuỗi giá trị từ Web $\to$ Redis $\to$ Sandbox $\to$ AST $\to$ Database.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Bỏ hoàn toàn MSW, kết nối API nộp bài thật với Backend của TV5.
    * Xây dựng giao diện hiển thị Ma trận tương đồng đạo văn (dạng bảng nhiệt Heatmap hoặc lưới so sánh giữa các sinh viên).
  * **TV 2 (Sandbox):**
    * Chuyển giao hoàn toàn Sandbox Runner cho TV5 tích hợp vào BullMQ Worker.
    * Tối ưu tốc độ: Xây dựng cơ chế dọn dẹp thư mục tạm và xóa container tự động ngay sau khi có kết quả để tránh nghẽn đĩa cứng.
    * Viết Unit Tests cho toàn bộ các hàm kiểm tra kết quả testcases (độ bao phủ $\ge 80\%$).
  * **TV 3 (GenAI):**
    * Xây dựng module **Semantic Code Review**:
      * Nhận mã nguồn bài nộp sinh viên và barem điểm.
      * Gọi LLM đánh giá các tiêu chí định tính: Clean Code (đặt tên, tách hàm), nguyên lý SOLID, phát hiện code smells.
      * Trả về điểm định tính và nhận xét chi tiết từng dòng code.
    * Xây dựng module **Giải nghĩa lỗi biên dịch (Compilation Error Explainer)**: Dịch các thông báo lỗi biên dịch phức tạp từ compiler thành hướng dẫn sửa lỗi dễ hiểu.
  * **TV 4 (AST & Research Lead):**
    * Chuyển giao AST Engine cho TV5 tích hợp vào Worker chạy ngầm sau khi bài nộp đã chấm testcase xong.
    * Lập trình tính toán **Similarity Matrix**: So sánh vân tay số của bài nộp mới với tất cả các bài nộp khác trong cùng kỳ thi bằng độ đo Jaccard Index trên tập fingerprints:
      $$J(A, B) = \frac{|F(A) \cap F(B)|}{|F(A) \cup F(B)|}$$
    * Viết bản nháp phần *Methodology* của bài báo IEEE.
  * **TV 5 (Infra & DevOps):**
    * Đấu nối hoàn chỉnh Worker trong BullMQ:
      $$\text{Job} \to \text{TV2 Sandbox (chấm testcases)} \to \text{Cập nhật DB} \to \text{Dispatch sang TV4 AST (so khớp đạo văn)} \to \text{Cập nhật DB}.$$
    * Thiết lập máy chủ WebSocket (Socket.io) trên Backend để sẵn sàng phát tín hiệu trạng thái nộp bài.

* **Giao thức phối hợp (Sync & Deliverables):**
  * Nộp thử 1 bài zip qua giao diện Web của TV1 và kiểm tra xem CSDL có nhận được cả điểm testcases của TV2 và điểm đạo văn của TV4 hay không.

---

#### TUẦN 7: TÍCH HỢP WEBSOCKETS REALTIME, GENAI REVIEW & CỔNG KHIẾU NẠI
* **Mục tiêu tuần (Sprint Goal):** Hoàn thiện hiển thị thời gian thực qua WebSockets, gắn kết GenAI review và xây dựng cổng khiếu nại (Appeals).

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Tích hợp `socket.io-client` ở Frontend: Nhận sự kiện từ server và hiển thị thanh trạng thái thời gian thực (`Đang chờ` $\to$ `Đang biên dịch` $\to$ `Đang chấm testcases` $\to$ `Kiểm tra đạo văn` $\to$ `Hoàn thành`).
    * Xây dựng giao diện xem chi tiết bài nộp: Hiển thị nhận xét Clean Code của AI và vùng code bị tô màu trùng lặp (highlight matched code).
    * Xây dựng **Cổng khiếu nại (Appeals UI)**: Cho phép sinh viên tạo ticket thắc mắc điểm; giảng viên xem và phản hồi trực tiếp.
  * **TV 2 (Sandbox):**
    * Kiểm tra khả năng chịu lỗi của Sandbox khi nộp nhiều file zip đồng thời.
    * Bổ sung cơ chế timeout tổng thể cho toàn bộ bài thi để tránh tình trạng treo worker.
    * Soạn tài liệu hướng dẫn cấu hình Sandbox cho phần triển khai cloud.
  * **TV 3 (GenAI):**
    * Kết nối module Semantic Review và Giải nghĩa lỗi biên dịch vào luồng xử lý chính.
    * Thử nghiệm đo lường: Thời gian phản hồi trung bình (latency) của LLM và chi phí token trên mỗi bài nộp.
    * Viết Unit Tests kiểm tra tính toàn vẹn của JSON trả về từ LLM (bảo đảm không bị lỗi cú pháp JSON parse).
  * **TV 4 (AST & Research Lead):**
    * Hoàn thiện module trích xuất các đoạn mã nguồn trùng lặp cụ thể (start_line, end_line) từ các cặp fingerprint trùng nhau để phục vụ tính năng highlight trên UI của TV1.
    * Thu thập số liệu thực nghiệm: Đo độ nhạy (Sensitivity) của thuật toán AST khi đối đầu với các mức độ ngụy trang AI khác nhau.
    * Soạn thảo phần *Experimental Setup & Metrics* trong bài báo IEEE.
  * **TV 5 (Infra & DevOps):**
    * Phát các sự kiện WebSocket tại từng bước xử lý của Worker: `SUBMISSION_QUEUED`, `COMPILING`, `RUNNING_TESTS`, `CHECKING_PLAGIARISM`, `FINISHED`.
    * Triển khai toàn bộ hệ thống lên môi trường thực tế (Cloud VPS / Azure / Render) bằng Docker Compose.
    * Cài đặt công cụ quản lý bug (Plane hoặc Jira) để chuẩn bị cho đợt săn lỗi P2P ở Tuần 8.

* **Giao thức phối hợp (Sync & Deliverables):**
  * Kiểm thử toàn bộ hệ thống đã deploy trên Cloud: Đảm bảo có đường link public ổn định để nhóm khác truy cập.

---

#### TUẦN 8: KIỂM THỬ UAT CHÉO (BUG HUNTING P2P), FIX DEFECTS & ĐẠT TEST COVERAGE $\ge 80\%$
* **Mục tiêu tuần (Sprint Goal):** Tiếp nhận và sửa chữa triệt để các lỗi logic do nhóm khác phát hiện; đảm bảo Unit Test toàn dự án $\ge 80\%$; bảo vệ thành công Milestone 3.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Cử 1 thành viên cùng TV3 đóng vai "Giảng viên" và "Sinh viên" truy cập vào hệ thống đã deploy của nhóm khác để kiểm thử chấp nhận người dùng (UAT).
    * Tìm kiếm và log các lỗi logic giao diện, lỗi hiển thị sai điểm số của nhóm đối thủ lên Jira/Plane của họ.
    * Sửa chữa toàn bộ các bug liên quan đến giao diện và luồng khiếu nại do nhóm đối thủ log trên hệ thống của mình.
  * **TV 2 (Sandbox):**
    * Đảm bảo Unit Test của module Sandbox đạt độ bao phủ $\ge 80\%$.
    * Trực tiếp fix các lỗi liên quan đến việc chấm sai kết quả testcases (ví dụ: lỗi trôi dòng `\r\n` giữa Windows và Linux).
  * **TV 3 (GenAI):**
    * Tinh chỉnh prompt để đảm bảo kết quả nhận xét Clean Code không bị "ảo giác" (hallucination).
    * Viết Unit Tests cho module GenAI đảm bảo độ bao phủ $\ge 80\%$.
  * **TV 4 (AST & Research Lead):**
    * Tối ưu hóa thuật toán Winnowing để chạy nhanh trên tập dữ liệu lớn của cả lớp (giảm thời gian tính toán ma trận xuống dưới 5 giây).
    * Đảm bảo Unit Test cho module AST đạt độ bao phủ $\ge 80\%$.
    * Hoàn thiện bản nháp đầu tiên của toàn bộ bài báo khoa học IEEE (gửi cả nhóm review).
  * **TV 5 (Infra & DevOps):**
    * Cấu hình công cụ đo lường độ bao phủ kiểm thử (Jest / Pytest Coverage, SonarQube hoặc Codecov) trên GitHub Actions: **Chặn merge PR nếu độ bao phủ tổng thể dưới 80%**.
    * Trực tiếp fix các lỗi liên quan đến treo hàng đợi Redis, nghẽn kết nối WebSocket hoặc sai lệch Transaction CSDL.

* **🎯 CỘT MỐC ĐÁNH GIÁ P2P MILESTONE 3 (Cuối tuần 8 - 25%):**
  * **Đánh giá P2P (UAT Defect Logging):** Nhóm bạn sẽ kiểm thử hệ thống deploy thực tế của bạn. Điểm số sẽ bị trừ nếu tồn tại các bug nghiêm trọng (treo queue, tính sai điểm barem, lỗi giao diện).
  * **Đánh giá của Giảng viên:** Nghiệm thu hệ thống chạy ổn định trên môi trường Cloud thực tế và nghiệm thu chỉ số test coverage $\ge 80\%$.

---

### GIAI ĐOẠN 4: STRESS TESTING, BÁO CÁO KHOA HỌC IEEE & BẢO VỆ CUỐI KỲ
#### 🎯 CỘT MỐC: FINAL DEFENSE (TUẦN 9 – TUẦN 10) • TRỌNG SỐ: 40%

---

#### TUẦN 9: STRESS TESTING VỚI K6, TỐI ƯU HÓA HỆ THỐNG & HOÀN THIỆN PAPER IEEE
* **Mục tiêu tuần (Sprint Goal):** Thực hiện kiểm thử chịu tải (100 requests đồng thời), tối ưu hóa database/cache để độ trễ phản hồi $< 100\text{ms}$, và hoàn thiện bài báo khoa học 6-8 trang chuẩn IEEE.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Tối ưu hóa hiệu năng giao diện: Áp dụng code splitting, lazy loading, nén assets để điểm Lighthouse $\ge 90$.
    * Cùng TV4 viết phần: **Section I: Introduction** và **Section VI: Conclusion** của bài báo IEEE.
    * Lên khung sườn slide bảo vệ đồ án cuối kỳ.
  * **TV 2 (Sandbox):**
    * Đo lường các chỉ số hiệu năng Sandbox: Thời gian trung bình để khởi tạo container, lượng RAM/CPU tiêu thụ thực tế.
    * Viết phần: **Mô tả thực nghiệm Sandbox & Môi trường thực thi cô lập** đưa vào Section III & V của bài báo IEEE.
  * **TV 3 (GenAI):**
    * Thu thập thống kê chi phí API, độ trễ sinh đề và độ chính xác của rubric.
    * Viết phần: **Section IV.B: Generative AI Obfuscation Techniques & Semantic Code Review** trong bài báo IEEE.
  * **TV 4 (AST & Research Lead - Chủ trì Paper):**
    * **Hoàn thiện bản chính thức của Báo cáo khoa học IEEE (6 - 8 trang):**
      * Hoàn thiện biểu đồ thực nghiệm so sánh độ nhạy (Precision/Recall) giữa: (1) So khớp chuỗi thô (Levenshtein), (2) Winnowing trên text, và (3) AST + Winnowing trên code bị ngụy trang bằng AI.
      * Viết phần **Section II: Related Work** và **Section IV.A: AST Normalization & Winnowing Fingerprinting**.
      * Định dạng đúng chuẩn template LaTeX / Word của IEEE Conference.
  * **TV 5 (Infra & DevOps):**
    * Viết kịch bản đo tải bằng **k6**: Giả lập kịch bản **100 sinh viên nộp bài đồng thời trong vòng 60 giây**.
    * Tối ưu hóa Database: Đánh chỉ mục (Indexes) trên các trường tra cứu thường xuyên (`submission_id`, `exam_id`, `hash_value`).
    * Cấu hình Redis Caching cho các API xem kết quả thi và bảng xếp hạng để đảm bảo độ trễ API $< 100\text{ms}$.
    * Xuất biểu đồ đo tải k6 để bàn giao cho TV4 đưa vào Section V của bài báo IEEE.

* **Giao thức phối hợp (Sync & Deliverables):**
  * Cuối tuần 9: Toàn bộ 5 thành viên cùng ngồi đọc duyệt từng từ trong bài báo IEEE trước khi xuất bản bản PDF chính thức.

---

#### TUẦN 10: TỔNG DUYỆT BẢO VỆ ĐỒ ÁN (FINAL DEFENSE) TRƯỚC HỘI ĐỒNG
* **Mục tiêu tuần (Sprint Goal):** Xuất báo cáo đóng góp Git minh bạch, tổng duyệt kịch bản Live Demo và bảo vệ xuất sắc đồ án trước Hội đồng Giảng viên.

* **Nhiệm vụ cụ thể từng thành viên:**
  * **TV 1 (Frontend & Lead):**
    * Hoàn thiện bộ slide trình chiếu chuyên nghiệp (giới thiệu bài toán, kiến trúc, kết quả, live demo).
    * Điều phối phiên bảo vệ: Phân chia thời lượng nói cho từng thành viên trong nhóm (mỗi người trình bày đúng phân hệ mình phụ trách).
  * **TV 2 (Sandbox):**
    * Chuẩn bị kịch bản demo trực tiếp: Nộp 1 bài code hợp lệ $\to$ chấm điểm testcase thành công; nộp 1 bài chứa fork-bomb $\to$ hệ thống tự ngắt an toàn và báo lỗi timeout mà không ảnh hưởng server.
  * **TV 3 (GenAI):**
    * Chuẩn bị kịch bản demo: Giảng viên bấm nút sinh đề bài bằng AI trong 10 giây; xem kết quả AI review Clean Code và giải thích lỗi biên dịch.
  * **TV 4 (AST & Research Lead):**
    * In ấn hoặc chuẩn bị bản mềm bài báo khoa học IEEE nộp cho Hội đồng Giảng viên.
    * Chuẩn bị kịch bản demo: Mở giao diện ma trận đạo văn, trình chiếu 2 đoạn code đã bị AI đổi tên biến/đảo hàm nhưng thuật toán vẫn highlight chính xác các đoạn tương đồng.
    * Sẵn sàng phản biện chuyên sâu về mặt giải thuật và cơ sở toán học với các thầy cô hội đồng.
  * **TV 5 (Infra & DevOps):**
    * Chạy script Git Analytics tự động: Xuất báo cáo phân bổ Commits, Pull Requests và Lines of Code (LOC) của 5 thành viên (chứng minh tất cả đều vượt xa ngưỡng tối thiểu 5% đóng góp).
    * Đảm bảo server Cloud và database hoạt động 100% không có sự cố (zero-downtime) trong suốt buổi bảo vệ.

* **🎯 CỘT MỐC ĐÁNH GIÁ FINAL DEFENSE (Tuần 10 - 40%):**
  * **Hội đồng chấm Slide & Demo (25%):** Cả 5 thành viên phối hợp demo live hệ thống thực tế trên Cloud và trả lời câu hỏi phản biện.
  * **Bài báo khoa học RBL chuẩn IEEE (15%):** Nộp bài báo 6 - 8 trang hoàn chỉnh, trình bày kết quả thực nghiệm khoa học độc đáo của đề tài.

---

## IV. BẢNG PHÂN BỔ NỘI DUNG BÀI BÁO KHOA HỌC IEEE (6 – 8 TRANG)

Để bài báo khoa học đạt chất lượng cao nhất mà không dồn gánh nặng lên một người, từng phần được phân bổ trực tiếp cho người nắm giữ công nghệ đó:

| Phần trong Paper | Số trang dự kiến | Nội dung trọng tâm | Thành viên phụ trách chính | Nguồn dữ liệu thực nghiệm |
| :--- | :---: | :--- | :--- | :--- |
| **Title, Abstract & Keywords** | 0.5 trang | Tóm tắt bài toán phát hiện đạo văn AI bằng AST & Winnowing | **TV 4** + **TV 1** | Tổng quan toàn bộ đề tài |
| **I. Introduction** | 1.0 trang | Thách thức của LLM đối với giáo dục lập trình; Hạn chế của MOSS/JPlag | **TV 1** (Lead) | Khảo sát thực tế |
| **II. Related Work** | 1.0 trang | Nghiên cứu về Cây cú pháp trừu tượng, Thuật toán Winnowing & Fingerprinting | **TV 4** (Research Lead) | Bài báo Schleimer 2003, các nghiên cứu AST |
| **III. Proposed System Architecture** | 1.0 trang | Kiến trúc đa phân hệ: Pipeline bất đồng bộ với BullMQ và Docker Sandbox | **TV 5** (Infra) + **TV 2** (Sandbox) | Sơ đồ kiến trúc & Docker specs |
| **IV. Methodology** | 1.5 trang | • IV.A: AST Normalization & K-gram Winnowing<br>• IV.B: Kỹ thuật ngụy trang code bằng GenAI | • **TV 4** (Thuật toán)<br>• **TV 3** (Dataset ngụy trang) | Công thức toán băm & Prompt sinh biến thể code |
| **V. Experimental Results & Discussion** | 2.0 trang | • Độ nhạy phát hiện code ngụy trang (Precision/Recall)<br>• Hiệu năng cô lập của Sandbox dưới mã độc<br>• Khả năng chịu tải đồng thời (k6 Benchmark) | • **TV 4** (Độ chính xác thuật toán)<br>• **TV 2** (Benchmark Sandbox)<br>• **TV 5** (Biểu đồ đo tải k6) | Thực nghiệm trên 50 mã nguồn mẫu và đo tải 100 reqs |
| **VI. Conclusion & Future Work** | 0.5 trang | Đánh giá đóng góp của đề tài và hướng phát triển | **TV 4** + **TV 1** | Kết luận chung |

---

## V. CƠ CHẾ THEO DÕI ĐÓNG GÓP & CHỐNG "FREE-RIDING"

Tuân thủ nghiêm ngặt quy định học phần SWP391-RBL: **Sinh viên đóng góp $< 5\%$ khối lượng sẽ bị trừ từ 50% đến 100% điểm Milestone**:
1. **Theo dõi qua Pull Requests (PR):** Mọi dòng code phải đi qua PR trên GitHub, bắt buộc có ít nhất 1 thành viên khác review và approve trước khi merge vào nhánh `develop`.
2. **Commit Message chuẩn hóa:** Áp dụng Conventional Commits (ví dụ: `feat(sandbox): add memory limit 512m`, `feat(ast): implement k-gram winnowing`, `fix(auth): handle token expiration`).
3. **Báo cáo Git Analytics hàng tuần:** Cuối mỗi tuần, TV5 trích xuất dữ liệu đóng góp từ Git CLI để cả nhóm cùng đối chiếu độ cân bằng. Nếu thành viên nào gặp khó khăn dẫn đến commit thấp, nhóm sẽ hỗ trợ tái phân bổ ngay trong tuần tiếp theo.

---
*Kế hoạch này là tài liệu vận hành chính thức cho nhóm phát triển AITA-Intelligent trong suốt 10 tuần.*
