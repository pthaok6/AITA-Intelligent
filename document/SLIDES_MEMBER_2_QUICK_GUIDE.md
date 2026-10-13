# BẢNG NỘI DUNG SLIDE THUYẾT TRÌNH (DÀNH CHO POWERPOINT / CANVA)
## THÀNH VIÊN 2: KIẾN TRÚC CODEBASE & THAO TÁC CRUD
**Dự án:** AITA - Intelligent (Automated Intelligent Assessment Platform)

---

### 🖥️ SLIDE 1: TIÊU ĐỀ
* **Tiêu đề lớn:** PHẦN 2: KIẾN TRÚC CODEBASE & THAO TÁC NGHIỆP VỤ CRUD
* **Phụ đề:** Thiết kế nhiều lớp (Layered Architecture) & Kiểm soát toàn vẹn dữ liệu
* **Người trình bày:** Thành viên 2
* **Nội dung chính:**
  1. Kiến trúc hệ thống nhiều tầng (Multi-tier Architecture)
  2. Phân tách trách nhiệm: Controller ➔ Service ➔ Repository
  3. Cơ chế kiểm soát quyền & phòng thủ tại Middleware
  4. Nghiệp vụ CRUD Lớp học & Ràng buộc hạn chế xóa (Restrict)
  5. Nghiệp vụ CRUD Đề thi & Kiểm soát giao dịch (Transactions)

---

### 🖥️ SLIDE 2: TỔNG QUAN KIẾN TRÚC NHIỀU TẦNG (LAYERED ARCHITECTURE)
* **Tiêu đề:** KIẾN TRÚC HỆ THỐNG PHÂN TẦNG (LAYERED ARCHITECTURE)
* **Hình ảnh / Diagram trung tâm:**
  `React Frontend` ➔ `Express Controller` ➔ `Service Layer` ➔ `Repository / Prisma` ➔ `PostgreSQL`
* **Các điểm chính (Bullet points):**
  * **Frontend (React/Vite):** Single Page Application, giao diện phân vai trò (Student / Lecturer / Admin), xác thực qua HTTP-only cookie.
  * **Controller (Express):** Cổng tiếp nhận HTTP, điều phối request, thực thi chuỗi middleware bảo mật, validate schema đầu vào.
  * **Service Layer:** Trái tim nghiệp vụ, chứa toàn bộ business logic (validate import, tính điểm, kiểm tra thời hạn làm bài).
  * **Repository Layer (Prisma ORM):** Trừu tượng hóa tương tác cơ sở dữ liệu, đảm bảo Type-Safety và quản lý Database Transactions.
  * **PostgreSQL (12 Models):** Lưu trữ quan hệ dữ liệu với ràng buộc khóa ngoại chặt chẽ.
* **Ghi chú thuyết trình:** Nhấn mạnh tính độc lập giữa các tầng (Separation of Concerns).

---

### 🖥️ SLIDE 3: TẦNG CONTROLLER & CHUỖI MIDDLEWARE BẢO VỆ
* **Tiêu đề:** TẦNG CONTROLLER: ĐIỀU PHỐI & PHÂN QUYỀN ĐA LỚP
* **Nội dung:**
  * **Chuỗi kiểm soát 4 bước tại Controller:**
    1. `authenticate`: Giải mã JWT từ HTTP-only cookie (`access_token`), gán `req.user`.
    2. `requireRole`: Kiểm tra vai trò người dùng (RBAC: `STUDENT`, `LECTURER`, `ADMIN`).
    3. `authorizeResource`: Kiểm tra quyền sở hữu tài nguyên (Giảng viên chỉ quản lý lớp/đề của mình; Sinh viên phải có ghi danh `ACTIVE`).
    4. `validateSchema`: Kiểm tra cấu trúc dữ liệu đầu vào (Zod/Joi schema).
  * **Nguyên tắc thiết kế:** Controller không chứa logic tính toán nghiệp vụ hay câu lệnh SQL.

---

### 🖥️ SLIDE 4: TẦNG SERVICE & REPOSITORY (PRISMA ORM)
* **Tiêu đề:** TẦNG SERVICE (NGHIỆP VỤ) & REPOSITORY (TRUY XUẤT DỮ LIỆU)
* **Nội dung:**
  * **Service Layer - Xử lý nghiệp vụ cốt lõi:**
    * Độc lập hoàn toàn khỏi Express framework (dễ viết Unit Test).
    * Phân tích và sinh preview token cho file Excel import sinh viên.
    * Đếm số lần nộp (`attemptNumber`), kiểm tra thời hạn đề thi (`openTime <= now <= closeTime`).
    * Tính toán điểm số và che giấu test case ẩn cho sinh viên khi chưa đóng đề.
  * **Repository & Prisma ORM - Quản lý truy xuất:**
    * Type-safety 100% từ Prisma Schema, chống lỗi runtime.
    * Quản lý giao dịch nguyên tử (`prisma.$transaction`) đảm bảo tính toàn vẹn (ACID).

---

### 🖥️ SLIDE 5: THAO TÁC CRUD LỚP HỌC (CLASSES) & RÀNG BUỘC HẠN CHẾ XÓA
* **Tiêu đề:** CRUD LỚP HỌC: QUY TẮC BẢO VỆ TOÀN VẸN DỮ LIỆU (RESTRICT DELETION)
* **Nội dung:**
  * **Create / Read / Update:** Giảng viên tạo lớp, quản lý danh sách lớp của mình, cập nhật thông tin.
  * **Delete - ĐIỂM NHẤN NGHIỆP VỤ (RESTRICTED DELETION):**
    * ⚠️ **Tuyệt đối không xóa vật lý (Hard delete)** nếu lớp đã có sinh viên ghi danh (`class_enrollments`) hoặc có đề thi (`exams`).
    * **Tại sao không dùng Cascade Delete?** Tránh làm mất vĩnh viễn dữ liệu điểm số, bài nộp của sinh viên.
    * **Cơ chế triển khai:** Khóa ngoại `ON DELETE RESTRICT` tại PostgreSQL + Kiểm tra nghiệp vụ tại Service Layer (`countEnrollments > 0 ? reject`).
    * **Giải pháp chuẩn:** Khuyến nghị chuyển trạng thái lớp sang `ARCHIVED` (Lưu trữ).

---

### 🖥️ SLIDE 6: THAO TÁC CRUD ĐỀ THI (EXAMS) & KIỂM SOÁT VÒNG ĐỜI
* **Tiêu đề:** CRUD ĐỀ THI: TRANSACTION TẠO ĐỀ & TÍNH CÔNG BẰNG TRONG KỲ THI
* **Nội dung:**
  * **Create (Tạo đề thi):**
    * Giảng viên nhập mô tả Markdown, thời gian mở/đóng, ngôn ngữ, test cases công khai & ẩn.
    * Tạo `Exam` + `TestCases` đồng thời trong **1 Database Transaction** (Tránh tạo đề mồ côi không có test case).
  * **Read (Xem đề thi):**
    * Giảng viên xem toàn bộ đề và bảng điểm theo thời gian thực.
    * Sinh viên chỉ xem đề khi trong hạn; chỉ xem test case công khai; điểm số bị ẩn cho đến khi đề thi đóng.
  * **Update (Sửa đề thi):**
    * 🔒 **Ràng buộc:** Khóa cập nhật test case và ngôn ngữ thi nếu đề thi đã có ít nhất 1 bài nộp (`submissions.count > 0`), đảm bảo sự công bằng cho tất cả thí sinh.

---

### 🖥️ SLIDE 7: PHÂN LẬP KIẾN TRÚC: API ĐỒNG BỘ VS WORKER CHẤM BÀI
* **Tiêu đề:** PHÂN TÁCH KIẾN TRÚC: EXPRESS API VS BULLMQ DOCKER WORKER
* **Nội dung:**
  * **Express API (Đồng bộ):** Nhận file ZIP, kiểm tra điều kiện, lưu mã băm SHA-256, chuyển trạng thái `QUEUED`, đẩy job vào Redis queue và trả kết quả `202 Accepted` ngay lập tức.
  * **Worker Process (Bất đồng bộ):** Một tiến trình riêng biệt lấy job từ Redis, giải nén ZIP và biên dịch/chạy trong **Docker Sandbox** (cô lập tài nguyên CPU, RAM, thời gian chạy).
  * **Ưu điểm:** Máy chủ web không bị nghẽn (Non-blocking I/O), chịu tải cao, mã nguồn sinh viên không thể gây hại cho hệ thống chủ.

---

### 🖥️ SLIDE 8: TỔNG KẾT & CHUYỂN TIẾP
* **Tiêu đề:** TỔNG KẾT PHẦN 2 & KẾT NỐI SANG DATABASE
* **Tóm tắt:**
  * Kiến trúc nhiều lớp rõ ràng: bảo mật ở Controller, nghiệp vụ ở Service, dữ liệu ở Repository.
  * Quy tắc CRUD chặt chẽ: Restrict Delete lớp học, Transaction tạo đề thi, bảo vệ tính công bằng kỳ thi.
  * Phân lập API và Worker đảm bảo hiệu năng và an ninh.
* **Chuyển tiếp:** Mời Thành viên 3 trình bày chi tiết về **Database Schema & Chuẩn hóa 12 bảng**.
