# TÀI LIỆU THUYẾT TRÌNH THÀNH VIÊN 2 — KIẾN TRÚC CODEBASE & CRUD
**Dự án:** AITA - Intelligent (Automated Intelligent Assessment & Testing Platform)  
**Học phần:** Software Engineering Project (Milestone 2)  
**Phần trình bày:** Thành viên 2 (Kiến trúc code và CRUD)  

---

## 1. Mục tiêu & Vị trí trong nhóm
Thành viên 2 trình bày sau Thành viên 1 (Workflow 0 - Đăng nhập & phân quyền) và trước Thành viên 3 (Database & 12 bảng).
* **Mục tiêu:** Trình bày rõ ràng kiến trúc phân tầng (React -> Express Controller -> Service -> Repository/Prisma -> PostgreSQL), làm nổi bật cơ chế bảo vệ phân quyền ở tầng Controller/Middleware, phân tích các thao tác CRUD Lớp học và Đề thi với các ràng buộc nghiệp vụ (đặc biệt là hạn chế xóa lớp khi có dữ liệu phụ thuộc), và chỉ ra sự tách biệt giữa API đồng bộ và Worker bất đồng bộ (BullMQ + Docker).
* **Đóng góp vào Rubric:** Chiếm trọng số trong tiêu chí **Codebase & Database (30%)** và **Workflow Implementation (50%)**.

---

## 2. Kiến trúc phân tầng (Layered Architecture)
1. **Frontend (React/Vite):** Single Page Application, giao diện tách biệt theo Role (Student, Lecturer, Admin). Token lưu trong HTTP-only Cookie (`credentials: 'include'`), không lưu localStorage để chống XSS.
2. **Controller (Express):** Tiếp nhận HTTP request, chạy middleware xác thực (JWT Cookie), kiểm tra vai trò (RBAC), kiểm tra quyền sở hữu tài nguyên (Resource Ownership Guard), validate input schema (Zod/Joi), gọi Service và trả HTTP Response. Không chứa logic nghiệp vụ hay truy vấn SQL thô.
3. **Service:** Xử lý nghiệp vụ (Business logic): preview/commit import Excel, kiểm tra thời hạn đề thi, số lần nộp bài (`attemptNumber`), tính điểm, che giấu test case ẩn cho sinh viên khi đề chưa đóng, điều phối Database Transaction.
4. **Repository (Prisma ORM):** Tương tác với PostgreSQL, Type-safety hoàn toàn, trừu tượng hóa truy vấn, quản lý transaction (`prisma.$transaction`).
5. **Worker (BullMQ + Redis + Docker):** Tiến trình độc lập chấm bài bất đồng bộ, cách ly mã nguồn sinh viên trong Docker container, tránh nghẽn luồng Event Loop của Express.

---

## 3. Thao tác CRUD & Ràng buộc nghiệp vụ
### A. Lớp học (Classes):
* **Create:** Giảng viên tạo lớp (`lecturerId = req.user.id`).
* **Read:** Giảng viên xem lớp mình dạy, sinh viên xem lớp mình ghi danh `ACTIVE`.
* **Update:** Giảng viên cập nhật tên, mô tả, trạng thái lớp.
* **Delete (Hạn chế xóa - Restrict Deletion):**
  - Tuyệt đối không xóa vật lý (Hard delete) nếu lớp đã có sinh viên ghi danh hoặc đã có đề thi/bài nộp.
  - Cấu hình database: `ON DELETE RESTRICT`.
  - Tầng Service kiểm tra: `if (enrollmentCount > 0 || examCount > 0) throw new BusinessRuleError(...)`.
  - Giải pháp khuyến nghị: Chuyển trạng thái lớp sang `ARCHIVED` để bảo tồn lịch sử học tập và điểm số.

### B. Đề thi (Exams):
* **Create:** Giảng viên tạo đề thi (Markdown mô tả, thời gian mở/đóng, ngôn ngữ, điểm) và danh sách test cases (công khai / ẩn) đồng thời trong một Database Transaction (`prisma.$transaction`).
* **Read:** Giảng viên xem toàn bộ và xem điểm ngay lập tức; Sinh viên chỉ xem đề khi trong hạn và chỉ xem điểm sau khi đề đóng.
* **Update:** Khóa cập nhật test case và ngôn ngữ thi nếu đề thi đã có ít nhất 1 bài nộp (`submissions.count > 0`), đảm bảo tính công bằng.
* **Delete:** Hạn chế xóa nếu đề thi đã có bài nộp.

---

## 4. Tóm tắt kịch bản nói (Speaker Checklist)
1. Chào hội đồng và kết nối từ phần trình bày của TV1.
2. Nêu sơ đồ luồng dữ liệu 4 tầng backend + frontend + worker.
3. Giải thích trách nhiệm từng tầng (Controller nhận & kiểm quyền, Service xử lý nghiệp vụ, Repository thao tác dữ liệu).
4. Phân tích CRUD lớp học và nhấn mạnh lý do kỹ thuật vì sao hạn chế xóa lớp (Restrict vs Cascade, bảo vệ toàn vẹn lịch sử điểm số).
5. Phân tích CRUD đề thi (Transaction tạo đề + test case, khóa sửa test case khi đã có bài nộp).
6. Nêu bật sự phân tách giữa Express API và Worker Docker sandbox.
7. Chuyển giao phần trình bày cho TV3 đi sâu vào thiết kế 12 bảng database.
