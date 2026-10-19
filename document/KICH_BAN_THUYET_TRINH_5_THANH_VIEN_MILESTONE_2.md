# KỊCH BẢN THUYẾT TRÌNH BẢO VỆ MILESTONE 2 — TOÀN DIỆN 5 THÀNH VIÊN
## DỰ ÁN: HỆ THỐNG ĐÁNH GIÁ & CHẤM ĐIỂM TỰ ĐỘNG THÔNG MINH (AITA - INTELLIGENT)

---

## 🧭 BẢN ĐỒ PHÂN BỔ 5 THÀNH VIÊN & ÁNH XẠ RUBRIC ĐÁNH GIÁ

| TV | Chủ đề trình bày | Phạm vi nghiệp vụ & Kỹ thuật | Trọng số Rubric |
| :---: | :--- | :--- | :---: |
| **TV 1** | **Workflow 0: Đăng nhập & Phân quyền** | Register (chỉ STUDENT), Login Email/Password & Google OAuth, JWT HTTP-only Cookie (Access/Refresh token), RBAC & Quyền sở hữu lớp/đề. Demo nhánh từ chối đăng nhập / không đủ quyền. | **Workflow Implementation (50%)** |
| **TV 2** | **Kiến trúc Codebase & Nghiệp vụ CRUD** | Kiến trúc đa tầng: React Frontend ➔ Express Controller ➔ Service ➔ Repository (Prisma) ➔ PostgreSQL. Phân lập API đồng bộ vs BullMQ/Docker Worker. CRUD Lớp học (Restricted Delete) & Đề thi (Transaction). | **Codebase & Database (30%)** |
| **TV 3** | **Database Design & Chuẩn hóa 12 Bảng** | 12 model cốt lõi (3 cụm: Auth/Lớp, Đề/Chấm bài, RBL/AI), Khóa chính ghép (`class_enrollments`, `submission_files`), Ràng buộc Unique (`submissions`), Foreign Key & Quy tắc `ON DELETE RESTRICT/CASCADE`. | **Codebase & Database (30%)** |
| **TV 4** | **Workflow 1: Quản lý lớp, Import & Tạo đề** | Tạo lớp, Roster Import Excel (mapping cột, token 2 bước, ghi danh batch), Tạo đề thi, Markdown, Test case công khai/ẩn. **Demo 2 Exception files:** `01-excel-invalid-row.xlsx` và `02-excel-ineligible-account.xlsx`. | **Workflow Implementation (50%)** |
| **TV 5** | **Workflow 2: Nộp bài, Docker Sandbox & Trả điểm** | Nộp file ZIP, băm SHA-256, BullMQ Queue, Docker Sandbox runner, lưu kết quả, chính sách ẩn điểm trước khi đề đóng. **Demo 2 Exception files:** `03-submission-compile-error.zip` và `04-submission-timeout.zip`. | **Workflow Implementation (50%)** |

---

# 👤 THÀNH VIÊN 1: WORKFLOW 0 — ĐĂNG NHẬP, PHIÊN & PHÂN QUYỀN

### 1. Mục tiêu trình bày:
* Làm rõ **Workflow 0** là cánh cổng xác thực và bảo vệ an ninh trước khi người dùng bước vào Workflow 1 và 2.
* Giải thích cơ chế bảo mật phiên không lưu token trong `localStorage` mà dùng **HTTP-only Cookie** chống XSS.
* Giải thích ma trận phân quyền: **RBAC theo Role** (`STUDENT`, `LECTURER`, `ADMIN`) kết hợp **Resource Ownership Guard** (quyền sở hữu lớp học/đề thi).

### 2. File mã nguồn cần mở khi thầy cô hỏi:
* Controller: `apps/backend/src/modules/auth/auth.controller.ts`
* Service: `apps/backend/src/modules/auth/auth.service.ts`
* Middleware: `apps/backend/src/shared/auth.middleware.ts` và `apps/backend/src/modules/classes/class-access.ts`

### 3. Lời thoại thuyết trình mẫu (4 – 5 phút):
> *"Kính chào quý thầy cô và hội đồng đánh giá. Em là [Tên TV1], mở đầu buổi thuyết trình của nhóm em xin trình bày về **Workflow 0: Đăng nhập, Quản lý phiên và Phân quyền truy cập** — nền tảng an ninh cốt lõi dẫn vào hai luồng nghiệp vụ chính của hệ thống AITA.*
>
> *Thưa thầy cô, về mặt quản lý tài khoản:*
> * *Hệ thống thiết kế luồng đăng ký mở chỉ cho phép tạo tài khoản vai trò **STUDENT** với email trường. Tài khoản **LECTURER** và **ADMIN** phải do Quản trị viên khởi tạo hoặc gán quyền để ngăn chặn việc người dùng tự ý nâng quyền.*
> * *Hệ thống hỗ trợ cả đăng nhập chuẩn bằng Email/Mật khẩu (mã hóa bcrypt) và Google OAuth.*
>
> *Về cơ chế bảo mật phiên (Session Security):*
> * *Khác với các ứng dụng thông thường lưu JWT trong `localStorage` dễ bị tấn công đánh cắp token qua lỗ hổng XSS, nhóm em áp dụng mô hình **Dual Token trong HTTP-only Cookie**:*
>   * `access_token` có thời hạn ngắn (15 phút) dùng để xác thực request.
>   * `refresh_token` (7 ngày) lưu trong bảng `auth_sessions`, cho phép thu hồi phiên từ xa khi người dùng đăng xuất.
>   * Cookie được gắn cờ `HttpOnly = true`, `SameSite = Strict`, mã JavaScript phía trình duyệt hoàn toàn không thể chạm tới token.*
>
> *Về cơ chế kiểm tra quyền truy cập (Authorization & Guarding):*
> * *Khi request gửi đến backend, chuỗi Middleware thực hiện kiểm tra 2 lớp:*
>   1. **Lớp 1 - Role Guard:** Chỉ người dùng có role tương ứng mới được gọi API (`LECTURER` tạo lớp/tạo đề, `STUDENT` nộp bài).
>   2. **Lớp 2 - Resource Ownership Guard:** Đây là điểm nhấn quan trọng: Giảng viên A không được sửa đề thi của Giảng viên B (`class.lecturerId === req.user.id`). Tương tự, Sinh viên chỉ được nộp bài vào đề thi nếu có trạng thái `ACTIVE` trong bảng `class_enrollments` của lớp đó và bài thi còn trong thời hạn làm bài.*
>
> *Để minh họa cho Workflow 0, lát nữa nhóm sẽ demo 2 nhánh từ chối: Đăng nhập sai mật khẩu $\rightarrow$ bị khóa; và Sinh viên cố tình truy cập link của lớp chưa được ghi danh $\rightarrow$ bị hệ thống chặn với mã lỗi 403 Forbidden.*
> *Sau đây, em xin chuyển sang phần trình bày của bạn [Tên TV2] về Kiến trúc Codebase và các thao tác CRUD."*

---

# 👤 THÀNH VIÊN 2: KIẾN TRÚC CODEBASE NHIỀU LỚP & THAO TÁC CRUD

### 1. Mục tiêu trình bày:
* Trình bày kiến trúc 4 tầng phân tách trách nhiệm (Separation of Concerns): `React ➔ Controller ➔ Service ➔ Repository (Prisma) ➔ PostgreSQL`.
* Phân tích sự đối ứng giữa **API Web đồng bộ (Express)** và **Tiến trình chấm bất đồng bộ (BullMQ Worker + Docker Sandbox)**.
* Trình bày chi tiết nghiệp vụ CRUD Lớp học (Đặc biệt: **Hạn chế xóa lớp - Restrict Deletion**) và CRUD Đề thi (**Transaction tạo đề kèm test cases**).

### 2. File mã nguồn cần mở:
* Class CRUD: `apps/backend/src/modules/classes/class.controller.ts` & `class.service.ts`
* Exam CRUD: `apps/backend/src/modules/exams/exam.controller.ts` & `exam.service.ts`
* Transaction test cases: `apps/backend/src/modules/exams/exam.repository.ts`

### 3. Lời thoại thuyết trình mẫu (5 – 6 phút):
> *"Kính chào thầy cô, em là [Tên TV2]. Tiếp nối phần xác thực, em xin trình bày về **Kiến trúc Codebase và Nghiệp vụ CRUD**.*
>
> *Để hệ thống đạt độ ổn định cao, dễ kiểm thử và bảo trì, backend AITA tuân thủ chặt chẽ mô hình **Kiến trúc 4 lớp (Layered Architecture)**:*
> 1. **Controller Layer:** Tiếp nhận HTTP request, chạy chuỗi Middleware xác thực JWT/Role/Ownership, validate schema đầu vào, và đóng gói HTTP Response. Controller tuyệt đối không chứa logic nghiệp vụ hay câu truy vấn DB.
> 2. **Service Layer:** Trái tim của ứng dụng, chứa toàn bộ Business Logic: kiểm tra điều kiện xóa lớp, tính toán điểm số, che giấu test case ẩn, điều phối transaction. Service độc lập hoàn toàn với `req`/`res` của Express, giúp viết Unit Test cực kỳ thuận tiện.
> 3. **Repository Layer:** Sử dụng **Prisma ORM**, đảm bảo an toàn kiểu dữ liệu tĩnh (Type-Safety), ngăn chặn triệt để SQL Injection, tối ưu câu lệnh truy vấn và điều phối giao dịch nguyên tử (`prisma.$transaction`).
> 4. **Infrastructure Layer:** Quản lý kết nối PostgreSQL, Redis Queue, Storage tệp nộp và Docker Sandbox.
>
> *Đặc biệt, hệ thống phân lập kiến trúc:**
> * Express API chỉ tiếp nhận nộp bài, lưu DB trạng thái `QUEUED` và phản hồi tức thì trong vài milliseconds cho sinh viên.
> * Việc biên dịch mã nguồn và chạy test case ngốn CPU được giao cho **Worker Process độc lập** chạy nền qua hàng đợi **BullMQ trên Redis**, giúp hệ sinh thái không bao giờ bị nghẽn Event Loop.*
>
> *Về các thao tác CRUD cốt lõi:*
> * **CRUD Lớp học & Ràng buộc Xóa (Restrict Delete):** Giảng viên có toàn quyền Tạo, Xem, Sửa lớp do mình quản lý. Tuy nhiên, ở thao tác **Xóa lớp**, hệ thống áp dụng quy tắc **Bảo vệ toàn vẹn dữ liệu**: Nếu lớp đã có sinh viên ghi danh hoặc đã có đề thi, hệ thống cấu hình `ON DELETE RESTRICT` ở database và chặn ở Service. Không thể xóa vật lý (Hard delete) để tránh mất sạch dữ liệu bài nộp và điểm số của sinh viên, mà hướng dẫn chuyển sang trạng thái `ARCHIVED`.*
> * **CRUD Đề thi & Tính nguyên tử (Atomicity):** Khi tạo đề thi, Đề bài và danh sách Test Cases được tạo trong **1 Transaction duy nhất**. Nếu lưu test case lỗi, toàn bộ đề thi sẽ rollback, không bao giờ để lại đề thi rỗng. Khi đề đã có sinh viên nộp bài, hệ thống sẽ KHÓA chức năng sửa test case và ngôn ngữ để đảm bảo tính công bằng kỳ thi.*
>
> *Sau đây, em xin nhường lời cho bạn [Tên TV3] trình bày chi tiết về Thiết kế và Chuẩn hóa Cơ sở dữ liệu."*

---

# 👤 THÀNH VIÊN 3: DATABASE DESIGN & CHUẨN HÓA 12 BẢNG

### 1. Mục tiêu trình bày:
* Trình bày cấu trúc 12 bảng cốt lõi trong PostgreSQL, chia thành 3 nhóm chức năng logic.
* Nhấn mạnh các thiết kế chuẩn hóa: Khóa chính ghép (`Composite Primary Keys`), Ràng buộc duy nhất (`Unique Constraints`), Khóa ngoại và quan tắc toàn vẹn tham chiếu.
* Giải thích lý do chuẩn hóa: Không nhét JSON vào bảng lớn, tách bảng riêng để tối ưu truy vấn và bảo vệ lịch sử thi cử.

### 2. File mã nguồn cần mở:
* Schema: `apps/backend/prisma/schema.prisma`
* Migration logs: `apps/backend/prisma/migrations/`

### 3. Sơ đồ 12 Bảng & Quan hệ:
```
[users] 1──N [auth_sessions]
  │
  ├── 1──N [classes] (as lecturer)
  │           │
  │           ├── 1──N [exams]
  │           │          │
  │           │          ├── 1──N [test_cases]
  │           │          └── 1──N [submissions] ──┬── 1──N [submission_files]
  │           │                                   ├── 1──N [submission_test_results]
  │           │                                   ├── 1──N [ast_fingerprints]
  │           │                                   ├── 1──N [plagiarism_reports]
  │           │                                   └── 1──N [ai_reviews]
  │           │
  └── 1──N [class_enrollments] N──1 [classes]
```

### 4. Lời thoại thuyết trình mẫu (5 – 6 phút):
> *"Kính chào thầy cô, em là [Tên TV3]. Em xin trình bày về **Thiết kế Cơ sở dữ liệu và Chuẩn hóa 12 Bảng** trong PostgreSQL qua Prisma ORM.*
>
> *Cơ sở dữ liệu của AITA được chuẩn hóa đạt chuẩn 3NF, gồm **12 model cốt lõi** chia làm 3 cụm nghiệp vụ:*
> 1. **Cụm 1: Quản lý Người dùng & Lớp học (4 bảng):**
>    * `users`: Lưu định danh, họ tên, email trường, vai trò (`STUDENT`, `LECTURER`, `ADMIN`).
>    * `auth_sessions`: Quản lý phiên refresh token, trạng thái thu hồi phiên.
>    * `classes`: Thông tin lớp học, mã lớp, học kỳ, liên kết `lecturerId`.
>    * `class_enrollments`: **Bảng quan hệ Nhiều - Nhiều (N - N)** giữa Sinh viên và Lớp học, lưu trạng thái ghi danh (`ACTIVE`, `DROPPED`).
> 2. **Cụm 2: Quản lý Đề thi & Chấm bài tự động (5 bảng):**
>    * `exams`: Thông tin đề thi, thời gian mở/đóng, ngôn ngữ cho phép, cấu hình điểm.
>    * `test_cases`: Bộ test case gồm input, expected output, cờ `isHidden`, trọng số điểm.
>    * `submissions`: Lịch sử nộp bài của sinh viên, mã băm SHA-256, số lần nộp (`attemptNumber`), trạng thái tổng (`QUEUED`, `COMPLETED`, `COMPILE_ERROR`).
>    * `submission_files`: Lưu manifest chi tiết từng tệp tin bên trong file ZIP đã nộp.
>    * `submission_test_results`: Chi tiết kết quả thực thi từng test case (thời gian chạy ms, RAM kb, actual output, status `ACCEPTED`/`RUNTIME_ERROR`/`TIME_LIMIT_EXCEEDED`).
> 3. **Cụm 3: Phát hiện Tương đồng & Đánh giá AI (3 bảng):**
>    * `ast_fingerprints`: Lưu các đoạn băm cấu trúc cây cú pháp trừu tượng (AST Winnowing) để soi đạo văn.
>    * `plagiarism_reports`: Báo cáo so khớp tỷ lệ trùng lặp giữa hai bài nộp.
>    * `ai_reviews`: Nhận xét và chấm điểm phong cách Clean Code từ mô hình AI.
>
> *Các điểm nhấn thiết kế kỹ thuật đắt giá:*
> * **Khóa chính ghép (Composite Primary Key):**
>   * `class_enrollments` dùng `@@id([classId, studentId])`: Đảm bảo một sinh viên không thể ghi danh trùng lặp 2 lần vào cùng một lớp.
>   * `submission_files` dùng `@@id([submissionId, path])`: Đảm bảo mỗi đường dẫn tệp trong một bài nộp là duy nhất.
> * **Ràng buộc duy nhất (Unique Constraint):**
>   * Bảng `submissions` có `@@unique([examId, studentId, attemptNumber])`: Kiểm soát chặt chẽ số thứ tự lần nộp bài của sinh viên trong một đề thi.
> * **Nguyên tắc Chuẩn hóa Dữ liệu:** Nhóm tuyệt đối không nhét danh sách file trong ZIP hoặc kết quả của 20 test cases vào một cột dạng `JSON` trong bảng `submissions`. Việc tách thành các bảng con riêng biệt `submission_files` và `submission_test_results` giúp tối ưu hóa indexing, dễ dàng truy vấn thống kê testcase nào sinh viên hay sai nhất mà không phải parse JSON phức tạp.*
>
> *Tiếp theo, em xin mời bạn [Tên TV4] demo thực tế Workflow 1: Chuẩn bị lớp, Import sinh viên và Tạo đề thi."*

---

# 👤 THÀNH VIÊN 4: WORKFLOW 1 — CHUẨN BỊ LỚP, IMPORT EXCEL & TẠO ĐỀ

### 1. Mục tiêu trình bày:
* Trực tiếp thao tác giao diện Giảng viên: Tạo lớp học mới, xem danh sách.
* Demo quy trình **Import Excel 2 bước an toàn (Preview ➔ Commit)**.
* **Điểm nhấn ăn trọn điểm Rubric:** Demo 2 Exception paths import Excel:
  * `01-excel-invalid-row.xlsx`: Dữ liệu dòng lỗi (email sai định dạng). Preview báo lỗi từng dòng, không cấp `previewToken`, khóa nút Xác nhận.
  * `02-excel-ineligible-account.xlsx`: Email tài khoản không đủ điều kiện (ví dụ tài khoản LECTURER). Preview đánh dấu lỗi vai trò, khóa commit.
* Tạo đề bài thi với mô tả Markdown và thiết lập bộ Test Cases công khai / ẩn.

### 2. Các file demo exception chuẩn bị sẵn:
* `examples/studentImport/01-excel-invalid-row.xlsx`
* `examples/studentImport/02-excel-ineligible-account.xlsx`
* File import chuẩn: `danh_sach_sinh_vien_import.xlsx`

### 3. Lời thoại thuyết trình & Thao tác Demo (5 – 6 phút):
> *"Kính chào thầy cô, em là [Tên TV4], phụ trách trình bày và thao tác **Workflow 1: Chuẩn bị lớp học, Import sinh viên và Tạo đề thi**.*
>
> *[THAO TÁC 1: ĐĂNG NHẬP & TẠO LỚP]*
> * *Em đăng nhập bằng tài khoản Giảng viên: `lecturer.test@fpt.edu.vn`. Trên Dashboard, em bấm 'Tạo lớp học mới', nhập mã lớp `SWP391-SE1701`, học kỳ `Fall 2026`. Lớp học lập tức xuất hiện trong danh sách do chính em làm chủ sở hữu.*
>
> *[THAO TÁC 2: DEMO IMPORT EXCEL & 2 NHÁNH NGOẠI LỆ (EXCEPTION PATHS)]*
> * *Hệ thống AITA áp dụng quy trình import 2 bước cực kỳ an toàn: Xem trước (Preview) để kiểm tra hợp lệ trước khi ghi thật (Commit Transaction) vào database.*
> * *Trước hết, em xin demo **Nhánh ngoại lệ 1** với file `01-excel-invalid-row.xlsx`:*
>   * *Khi em tải file này lên, tầng Service phân tích cú pháp từng dòng. Ở dòng thứ 3, email sinh viên không hợp lệ (sai định dạng `@fpt.edu.vn`).*
>   * *Như thầy cô thấy trên màn hình: Hệ thống highlight màu đỏ chính xác dòng bị lỗi, hiển thị lý do cụ thể, và **hoàn toàn không sinh previewToken**. Vì không có token hợp lệ, nút 'Xác nhận Import' bị vô hiệu hóa, ngăn chặn việc rác dữ liệu lọt vào hệ thống.*
> * *Tiếp theo, em demo **Nhánh ngoại lệ 2** với file `02-excel-ineligible-account.xlsx`:*
>   * *File này có email đúng định dạng, nhưng tài khoản tương ứng trong hệ thống lại có vai trò là `LECTURER`, không phải là `STUDENT`. Hệ thống kiểm tra điều kiện ghi danh và cảnh báo ngay: 'Tài khoản không đủ điều kiện ghi danh vào lớp học', nút Commit tiếp tục bị khóa.*
> * *Bây giờ, em tải lên file chuẩn `danh_sach_sinh_vien_import.xlsx`:*
>   * *Hệ thống báo toàn bộ danh sách hợp lệ, cấp `previewToken`, nút Xác nhận sáng lên. Khi em bấm 'Xác nhận', tầng Repository thực thi một Batch Insert trong Transaction, ghi danh toàn bộ sinh viên vào bảng `class_enrollments` chỉ trong tích tắc.*
>
> *[THAO TÁC 3: TẠO ĐỀ THI & BỘ TEST CASES]*
> * *Tại lớp vừa tạo, em bấm 'Tạo đề thi mới': nhập tiêu đề, hỗ trợ định dạng Markdown có xem trước trực quan (Live Preview).*
> * *Em cấu hình ngôn ngữ `PYTHON`, thời gian làm bài, và thêm 2 Test Cases:*
>   * *Test Case 1 (Công khai): Input `5 10`, Output `15` (cho sinh viên test thử).*
>   * *Test Case 2 (Ẩn): Input `100 200`, Output `300` (để chấm điểm thực tế).*
> * *Khi em bấm 'Lưu đề thi', toàn bộ đề và test cases được lưu nguyên tử vào database.*
>
> *Bây giờ lớp học và đề thi đã sẵn sàng, em xin nhường quyền cho bạn [Tên TV5] đóng vai Sinh viên để nộp bài và demo Workflow 2."*

---

# 👤 THÀNH VIÊN 5: WORKFLOW 2 — NỘP BÀI, DOCKER SANDBOX & TRẢ ĐIỂM

### 1. Mục tiêu trình bày:
* Đóng vai Sinh viên: Đăng nhập, kiểm tra thời hạn, chọn file ZIP nộp bài.
* Giải thích luồng ngầm: Lưu ZIP ➔ Băm SHA-256 ➔ Enqueue BullMQ Redis ➔ Docker Sandbox Runner chấm độc lập.
* **Điểm nhấn ăn trọn điểm Rubric:** Demo 2 Exception paths nộp bài:
  * `03-submission-compile-error.zip`: Lỗi cú pháp, trạng thái `COMPILE_ERROR`, điểm 0.
  * `04-submission-timeout.zip`: Vòng lặp vô hạn, trạng thái `TIME_LIMIT_EXCEEDED`.
* Demo luồng nộp bài thành công (Happy path) và cơ chế **Chống gian lận: Ẩn điểm trước khi đề đóng**.

### 2. Các file demo exception chuẩn bị sẵn:
* `03-submission-compile-error.zip`
* `04-submission-timeout.zip`
* File bài nộp chuẩn 10 điểm: `bst-submission-10pts.zip`

### 3. Lời thoại thuyết trình & Thao tác Demo (5 – 6 phút):
> *"Kính chào thầy cô, em là [Tên TV5], em xin khép lại buổi thuyết trình với phần gay cấn và cốt lõi nhất của hệ thống: **Workflow 2: Nộp bài, Xử lý hàng đợi BullMQ, Docker Sandbox và Trả kết quả**.*
>
> *[THAO TÁC 1: SINH VIÊN NỘP BÀI & CƠ CHẾ BẢO MẬT]*
> * *Em đăng nhập bằng tài khoản Sinh viên `student.test@fpt.edu.vn` vừa được bạn [Tên TV4] ghi danh vào lớp. Em mở đề thi và chuẩn bị nộp bài dạng file ZIP.*
> * *Khi em bấm nộp bài, hệ thống thực thi 3 cơ chế kiểm tra an toàn:*
>   1. Kiểm tra giới hạn dung lượng ZIP (tối đa 25MB) và kiểm tra file nén an toàn chống Zip-bomb.
>   2. Băm mã **SHA-256** của toàn bộ file ZIP. Nếu em nộp lại file có nội dung giống hệt lần nộp trước, quy tắc **BR-07** sẽ chặn ngay lập tức chống trùng lặp.
>   3. Lưu bài nộp vào PostgreSQL với trạng thái `QUEUED`, sinh ra bản ghi xác thực (Receipt) và đẩy job vào Redis/BullMQ. Em nhận ngay phản hồi chỉ sau 100ms mà không phải ngồi đợi Docker chấm.*
>
> *[THAO TÁC 2: DEMO 2 NHÁNH NGOẠI LỆ (EXCEPTION PATHS CHẤM BÀI)]*
> * *Bây giờ, em xin demo **Ngoại lệ 1: Lỗi biên dịch** với file `03-submission-compile-error.zip`:*
>   * *File này cố tình chứa lỗi cú pháp `SyntaxError`.*
>   * *Worker lấy job, khởi chạy container Docker `aita-runner-python`, phát hiện lỗi biên dịch $\rightarrow$ Cập nhật trạng thái bài nộp là **`COMPILE_ERROR`**, điểm số 0, và trích xuất đúng dòng thông báo lỗi từ compiler cho sinh viên biết.*
> * *Tiếp theo, em demo **Ngoại lệ 2: Lỗi chạy quá thời gian (Timeout)** với file `04-submission-timeout.zip`:*
>   * *File này chứa một vòng lặp vô hạn `while True`.*
>   * *Trong Docker Sandbox, Worker đặt giới hạn cứng CPU `timeLimitMs = 2000ms`. Quá thời gian quy định, container bị ngắt ngay lập tức, test case tương ứng mang trạng thái **`TIME_LIMIT_EXCEEDED`**, bảo vệ tài nguyên máy chủ không bao giờ bị treo hay tràn bộ nhớ.*
>
> *[THAO TÁC 3: DEMO NỘP BÀI CHUẨN & CHÍNH SÁCH ẨN ĐIỂM (SCORE MASKING)]*
> * *Cuối cùng, em nộp file chuẩn `bst-submission-10pts.zip`:*
>   * *Chỉ sau 2 giây, Docker chạy qua 100% test cases, trạng thái chuyển sang **`COMPLETED`**.*
>   * *Và thưa thầy cô, xin hãy quan sát màn hình Sinh viên của em: Điểm số hiện thông báo: **'Đã ghi nhận bài nộp. Điểm số và kết quả chi tiết các test case sẽ được công bố sau khi đề thi kết thúc'**.*
>   * *Đây là quy tắc nghiệp vụ chống gian lận trong thi cử: Nếu sinh viên biết điểm ngay, họ sẽ thử nghiệm biên test case ẩn hoặc chia sẻ cho các bạn khác.*
>   * *Nhưng khi em chuyển sang màn hình của Giảng viên [Tên TV4] và bấm Refresh $\rightarrow$ Giảng viên lập tức thấy bài nộp của em đạt **10/10 điểm** trọn vẹn theo thời gian thực!*
>
> *Toàn bộ quy trình diễn ra trơn tru, khép kín và an toàn tuyệt đối. Nhóm em đã hoàn thành 100% yêu cầu của Milestone 2. Em xin chân thành cảm ơn quý thầy cô đã lắng nghe!"*

---

# ❓ BỘ 15 CÂU HỎI PHẢN BIỆN CỦA HỘI ĐỒNG & CÂU TRẢ LỜI CHUẨN 10/10

### Dành cho Thành viên 1 (Workflow 0 - Auth & RBAC):
1. **Hỏi:** Tại sao không lưu JWT token trong `localStorage` cho đơn giản?
   * **Đáp:** Lưu `localStorage` dễ bị tấn công mã độc XSS đánh cắp token. Nhóm dùng **HTTP-only Cookie** (`SameSite=Strict`, `HttpOnly=true`) để trình duyệt tự gửi kèm request, JavaScript hoàn toàn không thể can thiệp.
2. **Hỏi:** Làm sao thu hồi phiên đăng nhập (Revoke Token) khi người dùng đổi mật khẩu hoặc đăng xuất?
   * **Đáp:** Nhóm lưu phiên refresh token trong bảng `auth_sessions`. Khi đăng xuất hoặc thu hồi, backend xóa bản ghi phiên trong DB, khiến refresh token bị vô hiệu hóa ngay lập tức.
3. **Hỏi:** Middleware kiểm tra quyền sở hữu lớp (Ownership) hoạt động như thế nào?
   * **Đáp:** Middleware `authorizeClassOwner` kiểm tra `class.lecturerId === req.user.id`. Nếu giảng viên cố tình gọi API sửa lớp của đồng nghiệp, hệ thống chặn ngay từ tầng controller với mã HTTP `403 Forbidden`.

### Dành cho Thành viên 2 (Codebase Architecture & CRUD):
4. **Hỏi:** Tại sao phải chia Controller, Service, Repository mà không viết thẳng SQL trong Controller?
   * **Đáp:** Tuân thủ nguyên lý Single Responsibility. Service chứa logic nghiệp vụ thuần túy độc lập với Express, giúp viết Unit Test tự động dễ dàng mà không cần mock request/response HTTP.
5. **Hỏi:** Tại sao khi xóa lớp học lại bị hạn chế (Restrict Deletion)?
   * **Đáp:** Một lớp học đã có sinh viên và đề thi chứa dữ liệu bài làm và điểm số hợp pháp. Nếu dùng Cascade Delete, bấm nhầm sẽ xóa sạch lịch sử học tập. Nhóm dùng `ON DELETE RESTRICT` để bảo toàn dữ liệu, khuyến khích chuyển trạng thái `ARCHIVED`.
6. **Hỏi:** Khi tạo đề thi kèm test cases, nếu lưu test case lỗi thì xử lý sao?
   * **Đáp:** Nhóm bọc trong một `prisma.$transaction`. Nếu có bất kỳ lỗi nào, toàn bộ giao dịch sẽ rollback nguyên tử, không bao giờ để lại đề thi rỗng không có test cases.

### Dành cho Thành viên 3 (Database & 12 Models):
7. **Hỏi:** Khóa chính ghép (Composite Primary Key) được dùng ở bảng nào và có tác dụng gì?
   * **Đáp:** Được dùng ở `class_enrollments(classId, studentId)` để chống sinh viên ghi danh 2 lần vào 1 lớp, và `submission_files(submissionId, path)` để định danh duy nhất từng file trong ZIP.
8. **Hỏi:** Tại sao kết quả test case không lưu thành mảng JSON trong `submissions`?
   * **Đáp:** Chuẩn hóa thành bảng riêng `submission_test_results` giúp đánh chỉ mục (indexing), tính toán thống kê test case nào sinh viên hay sai nhất với hiệu năng tối ưu thay vì phải scan và parse JSON.
9. **Hỏi:** Bảng `submissions` có ràng buộc duy nhất nào?
   * **Đáp:** Ràng buộc `@@unique([examId, studentId, attemptNumber])` đảm bảo số thứ tự các lần nộp bài của sinh viên trong một đề thi luôn tuần tự, không bị nhảy số hay trùng lặp.

### Dành cho Thành viên 4 (Workflow 1 - Lớp, Import & Đề thi):
10. **Hỏi:** Quy trình Import Excel 2 bước giải quyết vấn đề gì?
    * **Đáp:** Bước Preview đọc file, kiểm tra dữ liệu từng dòng và sinh `previewToken`. Chỉ khi toàn bộ dữ liệu hợp lệ mới cho phép bấm Commit để ghi DB trong 1 Transaction, tránh tình trạng import dở dang nửa chừng gây rác database.
11. **Hỏi:** Khi giảng viên xóa sinh viên khỏi lớp, dữ liệu bài nộp cũ của sinh viên đó có bị mất không?
    * **Đáp:** Không bị mất. Hệ thống chỉ xóa bản ghi trong `class_enrollments`. Tài khoản `users` và các `submissions` cũ vẫn được lưu trữ nguyên vẹn để phục vụ thanh tra, phúc khảo.
12. **Hỏi:** File `01-excel-invalid-row.xlsx` khác gì với `02-excel-ineligible-account.xlsx`?
    * **Đáp:** File 01 chứa dữ liệu sai format (cú pháp email). File 02 cú pháp email đúng nhưng kiểm tra nghiệp vụ DB thấy tài khoản không phải là STUDENT (ví dụ tài khoản LECTURER), cả hai đều bị khóa commit an toàn.

### Dành cho Thành viên 5 (Workflow 2 - Nộp bài, Docker & Trả điểm):
13. **Hỏi:** Nếu Redis bị sập đột ngột khi sinh viên nộp bài, bài thi có bị mất không?
    * **Đáp:** Không mất. Hệ thống theo nguyên tắc Database-First: Lưu file ZIP và ghi nhận bản ghi `submissions` trạng thái `QUEUED` vào PostgreSQL trước, sau đó mới đẩy job vào Redis. Worker có cron job quét định kỳ các bài `QUEUED` bị kẹt để nạp lại vào hàng đợi.
14. **Hỏi:** Docker Sandbox đảm bảo an ninh cho máy chủ chấm bài như thế nào?
    * **Đáp:** Mỗi lần chấm chạy trong một container cô lập hoàn toàn (cờ giới hạn bộ nhớ `-m`, CPU `--cpus`, không cấp quyền mạng `--network none`, tài khoản không đặc quyền `non-root`), ngăn chặn mã độc sinh viên can thiệp vào máy chủ.
15. **Hỏi:** Tại sao lại cần ẩn điểm của sinh viên trước khi đề đóng?
    * **Đáp:** Đây là quy tắc bảo mật thi cử. Tránh việc sinh viên nộp sớm biết điểm rồi suy đoán bộ test case ẩn để làm lại hoặc chia sẻ cho các bạn khác trong phòng thi. Giảng viên thì luôn xem được bảng điểm realtime.

---

### 🏁 CHECKLIST ĐỒNG ĐỘI CHO BUỔI THUYẾT TRÌNH (TẤT CẢ 5 THÀNH VIÊN)
- [ ] **Thành viên 1:** Mở sẵn trang Đăng nhập, chuẩn bị sẵn tài khoản giảng viên & sinh viên.
- [ ] **Thành viên 2:** Mở sẵn VS Code trỏ vào các thư mục `controllers/`, `services/`, `repositories/`.
- [ ] **Thành viên 3:** Mở sẵn file `schema.prisma` và mở DBeaver / pgAdmin hiển thị 12 bảng.
- [ ] **Thành viên 4:** Để sẵn 3 file Excel (`01-invalid`, `02-ineligible`, và file import chuẩn) trên Desktop.
- [ ] **Thành viên 5:** Để sẵn 3 file ZIP (`03-compile-error.zip`, `04-timeout.zip`, `bst-submission-10pts.zip`) trên Desktop.
