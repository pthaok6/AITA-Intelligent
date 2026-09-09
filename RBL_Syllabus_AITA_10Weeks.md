# ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN: DỰ ÁN PHÁT TRIỂN PHẦN MỀM (SWP391 - PHIÊN BẢN RBL 10 TUẦN)
## TÊN DỰ ÁN SONG SONG: AITA-INTELLIGENT (AI-POWERED TEACHING ASSISTANT & AST CODE ANALYTICS PLATFORM)
**Mô hình Triển khai: 5 Nhóm phát triển độc lập cùng 1 Đề tài - Đánh giá Ngang hàng (Peer-to-Peer) - Thời gian: 10 Tuần**

---

## I. THÔNG TIN CHUNG VỀ HỌC PHẦN (COURSE GENERAL INFORMATION)
*   **Mã học phần:** SWP391 (Software Development Project)
*   **Số tín chỉ:** 3 tín chỉ (Bachelor Level)
*   **Phân bổ thời gian (Khung thời gian rút ngắn 10 tuần học thực tế):**
    *   Giờ lên lớp (Contact Hours): 45 giờ (4.5 giờ/tuần)
    *   Tự học, Nghiên cứu & Peer Review: 104 giờ (10.4 giờ/tuần)
    *   Bảo vệ đồ án cuối kỳ (Final Presentation): 1 giờ
*   **Điều kiện tiên quyết:** Đạt PRJ301, SWE201c hoặc SWE202c, và đạt môn LAB211.
*   **Bối cảnh Triển khai RBL (Research-Based Learning):**
    Cả lớp học được chia thành **5 nhóm** (mỗi nhóm từ 4-6 sinh viên). Thay vì làm các dự án khác nhau hoặc chia nhỏ hệ thống, **tất cả 5 nhóm sẽ cùng nhận một đề tài như nhau**: *Xây dựng Hệ thống Trợ lý Giảng dạy thông minh AITA-Intelligent*. 
    Mô hình này tạo ra sự cạnh tranh học thuật công bằng, đồng thời tối ưu hóa triệt để phương thức **Đánh giá ngang hàng (Peer-to-Peer - P2P Review)** theo phong cách **Đại học 42 (École 42)**: do tất cả các nhóm cùng giải quyết một bài toán công nghệ và thuật toán như nhau, sinh viên sẽ có sự hiểu biết cực kỳ sâu sắc để phản biện, "săn lỗi" (bug hunting) và đánh giá chéo mã nguồn của nhóm đối thủ một cách khách quan và chính xác nhất.

---

## II. TRIẾT LÝ GIÁO DỤC TÍCH HỢP (SWP391 + ÉCOLE 42 + RBL)

Để hoàn thành một khối lượng công việc khổng lồ trong **10 tuần**, học phần SWP391-RBL áp dụng ba trụ cột giáo dục thực chiến:

1.  **Học tập dựa trên Nghiên cứu (RBL) - Tiêu điểm AST & Winnowing:** 
    Sinh viên không làm các ứng dụng CRUD đơn thuần. Đề tài bắt buộc các nhóm nghiên cứu và giải quyết bài toán khoa học máy tính thực tế: **"Xây dựng công cụ phân tích mã nguồn tĩnh dựa trên Cây cú pháp trừu tượng (Abstract Syntax Tree - AST) kết hợp giải thuật Winnowing để chấm điểm định tính và phát hiện mã nguồn đạo văn được ngụy trang bằng AI"**. Sinh viên phải viết báo cáo nghiên cứu dạng bài báo khoa học chuẩn IEEE mô tả kết quả thực nghiệm này.
2.  **Đánh giá ngang hàng (Peer-to-Peer Evaluation) École 42:**
    *   *P2P Defense:* Tại các cột mốc Milestone, các nhóm sẽ bốc thăm để đánh giá chéo (Peer Review) lẫn nhau. Điểm Peer Review chiếm tỷ trọng lớn trong điểm thành phần của từng Milestone. Một nhóm chỉ được phép bảo vệ trước Giảng viên khi và chỉ khi đã được ít nhất 2 nhóm khác ký duyệt biên bản kiểm thử kỹ thuật (Technical Sign-off).
    *   *Interactive Bug Hunting:* Trong tuần tích hợp, các nhóm sẽ trực tiếp tấn công bảo mật chéo: nộp các đoạn code chứa mã độc (infinite loops, fork bombs, disk space exhaustion) vào Docker Sandbox của nhóm khác để kiểm tra độ an toàn hệ thống đối phương.
3.  **Chấm điểm tự động (Moulinette-style Automated Testing):** 
    Mã nguồn của các nhóm phải được đẩy lên GitHub. Hệ thống CI/CD (GitHub Actions) sẽ tự động chạy bộ test suite chấm điểm kỹ thuật cơ bản trước khi chuyển qua bước đánh giá giao diện và kiến trúc của Giảng viên.

---

## III. CHUẨN ĐẦU RA HỌC PHẦN (COURSE LEARNING OUTCOMES - CLOs)
Sinh viên hoàn thành học phần SWP391-RBL 10 tuần sẽ đạt được các chuẩn đầu ra ABET sau:

*   **CLO1:** Phân tích, đặc tả và mô hình hóa các yêu cầu nghiệp vụ của hệ thống AITA dưới dạng tài liệu SRS chuẩn hóa (UML Use Cases, Activity Diagrams) bằng AI-assisted tools.
*   **CLO2:** Thiết kế kiến trúc hệ thống đa dịch vụ (Modular Monolith hoặc Microservices), sơ đồ lớp, thiết kế giao diện (UI/UX) và các luồng dữ liệu chuẩn hóa sử dụng Clean Architecture và mô hình OOP.
*   **CLO3:** Thiết kế mô hình cơ sở dữ liệu quan hệ (ERD), tối ưu hóa câu lệnh truy vấn (SQL Server/PostgreSQL), áp dụng Transaction để đảm bảo toàn vẹn dữ liệu khi bulk-import danh sách sinh viên.
*   **CLO4:** Phát triển API backend (Node.js/TypeScript/FastAPI), xây dựng Docker Sandbox cô lập bảo mật tài nguyên (512MB RAM, ngắt mạng ngoài) và lập trình giải thuật so khớp AST/Winnowing phát hiện đạo văn.
*   **CLO5:** Thể hiện tinh thần làm việc nhóm vượt trội, đạo đức nghề nghiệp, quản lý tiến độ bằng Kanban/Plane, ngăn chặn tình trạng "free-riding" bằng Git-Based Analytics.
*   **CLO6:** Thuyết trình báo cáo kỹ thuật rõ ràng và viết báo cáo nghiên cứu khoa học (RBL Paper) chuẩn IEEE mô tả thực nghiệm giải thuật AST.

---

## IV. BẢN ĐẶC TẢ HỆ THỐNG: CHƯƠNG TRÌNH PHÁT TRIỂN SONG SONG (PARALLEL DEVELOPMENT COMPASS)

Cả 5 nhóm sẽ cùng phát triển **5 hệ thống AITA độc lập** với cấu trúc chức năng giống nhau bao gồm các phân hệ sau:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AITA-INTELLIGENT SYSTEM                         │
├────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌─────────────────────┐  ┌──────────────┐  │
│  │     Phân hệ 1         │  │      Phân hệ 2      │  │  Phân hệ 3   │  │
│  │   Student/Lecturer    │  │   Docker Autograde  │  │  GenAI Core  │  │
│  │     Portal & Auth     │  │    Sandbox Engine   │  │  Review Hub  │  │
│  └───────────┬───────────┘  └──────────┬──────────┘  └──────┬───────┘  │
│              │                         │                    │          │
│              └───────────────┬─────────┴────────────────────┘          │
│                              ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Phân hệ 4 (RBL Core): AST Plagiarism & Code Analytics Engine     │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Phân hệ 5: Redis Background Queue & Git Teamwork Analytics       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Các phân hệ cốt lõi bắt buộc phải có trong mỗi hệ thống của 5 nhóm:
1.  **Portal & Auth Subsystem:** Giao diện Web (React/Vite/Tailwind) & Mobile (React Native) cho học viên và giảng viên. Đăng nhập JWT (HttpOnly Cookie) kết hợp Google SSO miền FPT (`@fpt.edu.vn`/`@fe.edu.vn`). Dashboard báo cáo thống kê, xem kết quả và nộp bài.
2.  **Docker Autograding Sandbox:** Trái tim kỹ thuật của hệ thống. File code bài nộp sinh viên (`.zip`) sẽ được đưa vào các container Docker cô lập (ví dụ: `.NET 8.0 SDK` hoặc `Java JDK 17`), giới hạn tài nguyên nghiêm ngặt (tối đa 512MB RAM, CPU Shares, ngắt mạng ngoài) để thực thi test cases (StdIn/StdOut) an toàn, chống fork bombs và malicious scripts.
3.  **GenAI Core & Review Hub:** Tích hợp API OpenAI GPT-4o / Gemini với cơ chế xoay vòng key. Hỗ trợ giảng viên sinh đề bài tự động, sinh rubric/barem điểm và test cases. AI hỗ trợ chấm điểm định tính (Clean Code, SOLID, kiến trúc layer) và giải nghĩa lỗi biên dịch bằng ngôn ngữ tự nhiên.
4.  **AST Plagiarism Detection (Trọng tâm RBL):** Chuyển đổi mã nguồn sinh viên nộp thành cây cú pháp trừu tượng (AST JSON). Loại bỏ hoàn toàn các ngụy trang bề mặt (đổi tên biến, hàm, comments, trật tự dòng lệnh). Áp dụng thuật toán Winnowing trên k-grams để tạo vân tay số (fingerprint), thiết lập ma trận tương đồng (Similarity Matrix) giữa toàn bộ các bài nộp trong lớp để phát hiện gian lận.
5.  **Redis Queue & Teamwork Analytics:** Sử dụng hàng đợi Redis (BullMQ) để điều phối không block luồng xử lý chính khi thực hiện batch-grading cho cả lớp. Tích hợp Git CLI Parser phân tích đóng góp thực tế (commits, LOC, PRs) của từng thành viên để loại bỏ nạn "free-riding".

---

## V. LỘ TRÌNH TRIỂN KHAI CHI TIẾT 10 TUẦN (10-WEEK INTENSIVE RBL SCHEDULE)

*Lộ trình học tập tăng tốc, yêu cầu sự kỷ luật và cường độ làm việc rất cao từ sinh viên để hoàn thành đồ án SWP391 thực chiến.*

### TUẦN 1 - 2: PHÂN TÍCH THIẾT KẾ & ĐỀ XUẤT NGHIÊN CỨU (MILESTONE 1)
*   **Hoạt động học tập trên lớp (9 giờ):**
    *   Giảng viên giới thiệu khung học phần SWP391-RBL, đề tài AITA-Intelligent và bộ dữ liệu mã nguồn mẫu.
    *   Seminar chuyên đề: "Lý thuyết Cây cú pháp trừu tượng (AST) và Giải thuật băm Winnowing trong phát hiện trùng lặp mã nguồn".
    *   Thảo luận nhóm chéo về cách thiết kế cơ sở dữ liệu quan hệ (ERD) tích hợp cả kết quả chấm Sandbox và cấu trúc chấm điểm AST.
*   **Nhiệm vụ tự học & Nghiên cứu của các Nhóm (20 giờ):**
    *   **Phân tích yêu cầu:** Thiết lập tài liệu SRS chứa các UML Use Cases, sơ đồ Activity Diagram mô tả luồng nộp bài và chạy kiểm tra đạo văn tự động.
    *   **Thiết kế hệ thống:** Vẽ Database ERD (chứa các bảng Users, Classes, Exams, Submissions, ASTFingerprints, RuleScores, CriterionScores).
    *   **Môi trường dự án:** Thiết lập GitHub Monorepo chung cho nhóm. Khởi tạo khung Frontend (Vite/React) và Backend (Node.js/Prisma hoặc Python/FastAPI).
    *   **Nghiên cứu RBL:** Viết bản đề xuất nghiên cứu (Research Proposal) về giải thuật so khớp AST và Winnowing.
*   **Cột mốc Đánh giá Milestone 1 (Cuối tuần 2 - Trọng số 15%):**
    *   **Cơ chế đánh giá P2P (École 42):** 
        *   Nhóm 1 review tài liệu SRS & DB ERD của Nhóm 2. Nhóm 2 review Nhóm 3... (xoay vòng).
        *   Các nhóm sử dụng checklist tiêu chuẩn để chấm chéo cấu trúc Database: kiểm tra chuẩn hóa 3NF, sự đầy đủ của các khóa ngoại (FK), transation integrity và logic nghiệp vụ.
    *   **Đánh giá của Giảng viên:** Các nhóm thuyết trình slide thiết kế kiến trúc, DB Schema và nộp tài liệu SRS/SDD.

### TUẦN 3 - 5: PHÁT TRIỂN CORE WORKFLOW & THỰC NGHIỆM SANDBOX & AST (MILESTONE 2)
*   **Hoạt động học tập trên lớp (13.5 giờ):**
    *   Seminar công nghệ: "Xây dựng môi trường thực thi mã nguồn cô lập an toàn bằng Docker Engine SDK".
    *   Thực hành Lab: Tích hợp LangChain/OpenAI API trong Node.js/Python và xử lý các kịch bản ngoại lệ (Compilation failures, timeouts).
    *   Seminar nghiên cứu: "Thuật toán băm Winnowing trên cây cú pháp AST và cách biểu diễn đồ thị cú pháp bằng NetworkX".
*   **Nhiệm vụ tự học & Nghiên cứu của các Nhóm (32 giờ):**
    *   **Mã hóa Phân hệ 1 & 5:** Hoàn thiện luồng Auth JWT & Google SSO. Xây dựng tính năng bulk import sinh viên từ Excel sử dụng SQL Transaction. Cấu hình Redis Queue (BullMQ) để nhận bài nộp.
    *   **Mã hóa Phân hệ 2 (Sandbox):** Viết module tương tác Docker API. Nhận file `.zip` bài nộp, giải nén, băm SHA-256 xác thực, khởi tạo Container chạy compiler của ngôn ngữ lập trình, thu nhận kết quả từ StdOut/StdErr và log lại.
    *   **Mã hóa Phân hệ 4 (RBL Core):** Lập trình AST Parser (sử dụng Python `ast` module cho mã nguồn Python, hoặc Roslyn cho C#). Lập trình thuật toán Winnowing: băm k-grams từ chuỗi token, lấy vân tay số (fingerprint) của từng file code và lưu trữ vào DB.
*   **Cột mốc Đánh giá Milestone 2 (Cuối tuần 5 - Trọng số 20%):**
    *   **Cơ chế đánh giá P2P (École 42) - Interactive Sandbox & AST Testing:**
        *   Các nhóm tiến hành bốc thăm chạy thử chéo hệ thống API của nhau.
        *   **Tấn công Sandbox (Sandbox Penetration Test):** Nhóm đối thủ sẽ nộp thử các file mã nguồn chứa các đoạn code độc hại (ví dụ: vòng lặp vô hạn, fork bomb, ghi đè file hệ thống của host) vào cổng nộp bài của nhóm bạn để kiểm tra xem Docker Sandbox của nhóm bạn có thực sự an toàn và cô lập tài nguyên thành công dưới 512MB RAM và ngắt kết nối mạng hoàn toàn hay không.
        *   **Thử thách AST Plagiarism Bypass:** Nhóm đối thủ sẽ lấy một đoạn code mẫu, sử dụng Generative AI để ngụy trang (đổi tên toàn bộ biến, tên hàm, thay đổi comments, đảo vị trí một vài hàm) rồi nộp lên để kiểm định xem thuật toán AST Plagiarism của nhóm bạn có phát hiện được tỷ lệ trùng lặp thực tế trên 80% hay không.
    *   **Đánh giá của Giảng viên:** Chấm điểm kiểm thử bảo mật và hiệu năng thực tế dựa trên kết quả P2P Testing.

### TUẦN 6 - 8: TÍCH HỢP HỆ THỐNG, SEMANTIC REVIEW & APP CHẤM ĐIỂM HOÀN CHỈNH (MILESTONE 3)
*   **Hoạt động học tập trên lớp (13.5 giờ):**
    *   Thực hành Lab: Viết tích hợp end-to-end các hệ thống phân tán sử dụng WebSockets để cập nhật trạng thái chấm bài thời gian thực.
    *   Seminar chuyên đề: "Prompt Engineering nâng cao: Chain-of-Thought và Few-Shot Learning áp dụng trong Semantic Code Review".
    *   Hướng dẫn viết báo cáo nghiên cứu khoa học theo cấu trúc chuẩn IEEE.
*   **Nhiệm vụ tự học & Nghiên cứu của các Nhóm (32 giờ):**
    *   **Tích hợp Phân hệ 3 (GenAI):** Hoàn thiện tính năng AI soạn đề bài, AI tự sinh barem điểm. Tích hợp Semantic Code Review chấm điểm Clean Code và giải nghĩa lỗi biên dịch.
    *   **Tích hợp Toàn diện (End-to-End Integration):** Kết nối luồng hoàn chỉnh: Sinh viên nộp bài -> Đóng gói gửi Redis Queue -> Docker Sandbox chấm test cases -> AST kiểm tra đạo văn -> LLM chấm Clean Code -> Trả kết quả về Web Front-end thời gian thực qua WebSockets.
    *   **Appeals & Analytics:** Hoàn thiện cổng khiếu nại điểm cho sinh viên và hộp thư giải quyết của giảng viên. Tích hợp module phân tích đóng góp Git commit để chấm điểm cá nhân.
    *   **Kiểm thử chất lượng:** Đạt độ bao phủ kiểm thử Unit Test tối thiểu **80%** trên toàn bộ mã nguồn backend và frontend.
*   **Cột mốc Đánh giá Milestone 3 (Cuối tuần 8 - Trọng số 25%):**
    *   **Cơ chế đánh giá P2P (École 42) - UAT & Defect Logging:**
        *   Mỗi nhóm cử ra 2 thành viên đóng vai trò là "Giảng viên" và "Sinh viên" truy cập vào hệ thống đã được deploy thực tế của nhóm khác để thực hiện kiểm thử chấp nhận người dùng (UAT).
        *   Mọi lỗi logic giao diện, lỗi tính toán điểm sai lệch so với barem, hay lỗi treo hàng đợi đều được ghi nhận trực tiếp thành các Defects trên hệ thống quản lý công việc (Jira/Plane) của nhóm bạn. Điểm số Milestone 3 của nhóm bạn sẽ bị trừ tỷ lệ thuận với số lượng Bugs nghiêm trọng bị phát hiện bởi nhóm đối thủ.
    *   **Đánh giá của Giảng viên:** Nghiệm thu hệ thống hoạt động ổn định trên môi trường deploy thực tế (Azure/AWS/Vercel).

### TUẦN 9 - 10: STRESS TESTING, VIẾT BÁO CÁO KHOA HỌC IEEE & BẢO VỆ CUỐI KỲ (FINAL DEFENSE)
*   **Hoạt động học tập trên lớp (9 giờ):**
    *   Tối ưu hóa hệ thống: Stress testing hàng đợi Redis bằng k6 hoặc JMeter dưới tải 100 requests đồng thời.
    *   Review và sửa lỗi báo cáo nghiên cứu khoa học RBL của các nhóm. Biện tập kỹ thuật thuyết trình đồ án trước Hội đồng.
*   **Nhiệm vụ tự học & Nghiên cứu của các Nhóm (20 giờ):**
    *   **Hoàn thiện Báo cáo Khoa học (IEEE Paper):** Cả nhóm phối hợp viết bài báo khoa học dài 6-8 trang bằng tiếng Anh hoặc tiếng Việt theo đúng định dạng IEEE. Nội dung bài báo bắt buộc phải có phần: *Thực nghiệm so sánh độ nhạy và thời gian xử lý giữa giải thuật so khớp cây AST (Tree Edit Distance) và giải thuật vân tay số Winnowing truyền thống khi đối phó với mã nguồn bị ngụy trang bằng GenAI*.
    *   **Stress Testing:** Tối ưu hóa database indexes, cấu hình caching Redis cho các API kết quả để giảm thiểu độ trễ phản hồi của client xuống dưới 100ms.
    *   **Hoàn thiện tài liệu:** Nộp kèm mã nguồn sạch (đã kiểm tra linting ESLint/Prettier, Flake8), tài liệu hướng dẫn sử dụng (User Manual) đầy đủ.
*   **Bảo vệ Đồ án Cuối kỳ (Tuần 10 - Trọng số 40%):**
    *   **Hội đồng chấm điểm:** Các nhóm thuyết trình slide, demo trực tiếp toàn bộ luồng hệ thống hoạt động thực tế trên máy chủ, trả lời câu hỏi phản biện kỹ thuật sâu từ Hội đồng Giảng viên.
    *   **Nộp bài báo khoa học RBL:** Bài báo khoa học chuẩn IEEE là điều kiện bắt buộc để chấm điểm tối đa cho cột mốc cuối kỳ này.

---

## VI. PHƯƠNG THỨC ĐÁNH GIÁ VÀ THANG ĐIỂM CHI TIẾT (EVALUATION MATRIX)

Học phần SWP391-RBL 10 tuần giữ nguyên thang điểm 10, điểm đạt tối thiểu \(\ge\) 5.0 và bám sát các cột mốc đánh giá của Syllabus gốc nhưng được tích hợp triệt để cơ chế chấm điểm ngang hàng (P2P):

### 1. Phân bổ Điểm số và Trọng số:
*   **Milestone 1 (Tuần 2 - 15%):** Đánh giá chéo P2P (5%) + Hội đồng chấm (10%).
*   **Milestone 2 (Tuần 5 - 20%):** Đánh giá chéo P2P (chạy thử chéo, tấn công Sandbox và thử thách AST Plagiarism) (10%) + Hội đồng chấm (10%).
*   **Milestone 3 (Tuần 8 - 25%):** Đánh giá chéo P2P (UAT bug-hunting chéo ghi nhận lỗi) (10%) + Hội đồng chấm (15%).
*   **Final Defense (Tuần 10 - 40%):** Hội đồng chấm Slide & Demo (25%) + Bài báo khoa học RBL chuẩn IEEE (15%).

### 2. Tiêu chí Đánh giá Chất lượng Kỹ thuật & Nghiên cứu:
*   **Chất lượng Code & Độ bao phủ kiểm thử (CI/CD Gates):** Mã nguồn bắt buộc phải vượt qua các bài kiểm linting nghiêm ngặt và đạt độ bao phủ Unit Test tối thiểu **80%** trên các module cốt lõi mới được chấp nhận chấm điểm Milestone 3 và Final.
*   **Bảo mật Sandbox:** Nếu Docker Sandbox của một nhóm bị nhóm đối thủ "hack" thành công (ví dụ: đối thủ nộp một file code mà Sandbox cho phép đọc file môi trường `.env` chứa API keys của host, hoặc làm sập server chính), nhóm đó sẽ bị trừ **50% số điểm kỹ thuật** của Milestone 2.
*   **Đánh giá Đóng góp Cá nhân (Chống Free-riding):** Nhóm 5 của từng nhóm sẽ chịu trách nhiệm tích hợp công cụ Git Analytics. Giảng viên sẽ đối chiếu trực tiếp tỷ lệ code đóng góp (LOC - Lines of Code, commits và số lượng PRs được chấp nhận) của từng sinh viên. **Sinh viên có tỷ lệ đóng góp thực tế dưới 5% tổng khối lượng của cả nhóm mà không có lý do chính đáng sẽ bị trừ từ 50% đến 100% điểm số của Milestone đó.**

---

## VII. TÀI NGUYÊN HỌC TẬP VÀ NGHIÊN CỨU ĐỀ XUẤT (LEARNING RESOURCES)
1.  **Main Material:** *Prompt Engineering for Developers* - DeepLearning.AI & OpenAI (Tối ưu hóa Semantic Review cho Nhóm 3).
2.  **Software Engineering:** *Software Engineering (10th Edition)* - Ian Sommerville (Cung cấp tài liệu SOPs chuẩn thiết kế SDLC).
3.  **Compiler & AST:** *Language Implementation Patterns* - Terence Parr (Hỗ trợ sinh viên Nhóm 4 tìm hiểu cấu trúc ngữ pháp và AST).
4.  **Sandbox Security:** *Docker Engine API & Linux Security Hardening Guides*.
5.  **Winnowing Algorithm:** Bài báo khoa học gốc: *"Winnowing: An Algorithm for Document Fingerprinting"* - Schleimer et al., ACM SIGMOD 2003.

---
**Đề cương học phần SWP391-RBL (Khung 10 tuần tăng tốc) đã được phê duyệt và chính thức áp dụng cho các lớp dự án SE.**
**Giám đốc Chương trình Đào tạo Kỹ thuật Phần mềm.**
*(Đã ký)*
