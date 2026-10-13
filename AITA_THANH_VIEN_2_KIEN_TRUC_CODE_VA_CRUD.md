# KỊCH BẢN THUYẾT TRÌNH CHI TIẾT — THÀNH VIÊN 2
## DỰ ÁN: HỆ THỐNG ĐÁNH GIÁ VÀ CHẤM ĐIỂM TỰ ĐỘNG THÔNG MINH (AITA - INTELLIGENT)
### PHẦN TRÌNH BÀY: KIẾN TRÚC CODEBASE VÀ CÁC THAO TÁC NGHIỆP VỤ CRUD (CODE ARCHITECTURE & CRUD)

---

## 📌 THÔNG TIN TỔNG QUAN
* **Thành viên phụ trách:** Thành viên 2
* **Chủ đề:** Kiến trúc mã nguồn nhiều lớp (Multi-tier Layered Architecture) & Thao tác CRUD Lớp học / Đề thi
* **Vị trí trong luồng thuyết trình:** Trình bày thứ 2 (Ngay sau Thành viên 1 - *Workflow 0: Đăng nhập & Phân quyền*, và trước Thành viên 3 - *Database & Chuẩn hóa 12 bảng*)
* **Thời lượng đề xuất:** 6 – 8 phút
* **Trọng số Rubric đóng góp:** Nằm trong cấu phần **Codebase & Database (30%)** và **Workflow Implementation (50%)** của Milestone 2.

---

## 🗺️ BẢN ĐỒ LIÊN KẾT GIỮA CÁC THÀNH VIÊN TRONG NHÓM
```
[Thành viên 1] ──> Xác thực người dùng (Workflow 0) ──> Cấp JWT cookie (Access/Refresh token)
       │
       ▼
[Thành viên 2 - BẠN ĐANG Ở ĐÂY]
 ├── Kiến trúc nhiều lớp: React ➔ Express Controller ➔ Service ➔ Repository (Prisma) ➔ PostgreSQL
 ├── Middleware: Xác thực token & Kiểm tra quyền sở hữu tài nguyên (Ownership & RBAC)
 ├── CRUD Lớp học: Nghiệp vụ Restrict Delete bảo vệ toàn vẹn dữ liệu
 ├── CRUD Đề thi: Tạo đề kèm Test Cases trong 1 Transaction, kiểm soát vòng đời bài thi
 └── Phân lập kiến trúc: API đồng bộ (Express) vs Worker bất đồng bộ (BullMQ + Docker)
       │
       ▼
[Thành viên 3] ──> Đi sâu vào 12 Tables Database, quan hệ 1-N, N-N, Composite Keys & Chuẩn hóa
       │
       ▼
[Thành viên 4] ──> Demo Workflow 1: Giảng viên chuẩn bị lớp, Excel Import & Tạo đề
       │
       ▼
[Thành viên 5] ──> Demo Workflow 2: Sinh viên nộp ZIP, BullMQ Queue, Docker Worker & Chấm bài
```

---

# PHẦN 1: TỔNG QUAN KIẾN TRÚC NHIỀU LỚP (LAYERED ARCHITECTURE)

## 1. Sơ đồ luồng dữ liệu tổng thể (Architectural Flow)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG TRÌNH DIỄN (FRONTEND)                      │
│                  React (Vite) + Tailwind CSS + Axios                   │
│   Giao diện phân quyền: Student Portal | Lecturer Studio | Admin Console│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Request (Credentials: include)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     TẦNG ĐIỀU PHỐI (EXPRESS CONTROLLER)                │
│ 1. Trích xuất cookie: access_token, refresh_token                      │
│ 2. Middleware authenticate(): Giải mã JWT, gán req.user                │
│ 3. Middleware requireRole(): Phân quyền vai trò (STUDENT, LECTURER...) │
│ 4. Middleware authorizeResource(): Kiểm tra quyền sở hữu lớp/đề thi   │
│ 5. Request Validation: Kiểm tra dữ liệu đầu vào (Zod/Joi schema)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Gọi hàm xử lý (Clean parameters)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      TẦNG NGHIỆP VỤ (SERVICE LAYER)                    │
│ 1. Business Logic: Kiểm tra điều kiện nộp, thời hạn đề, format file    │
│ 2. Import Service: Parse Excel, validate sinh viên, sinh preview token │
│ 3. Score Service: Tính toán điểm số, che giấu test case ẩn             │
│ 4. Transaction Management: Điều phối giao dịch qua prisma.$transaction │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Data Queries (Typed models)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    TẦNG TRUY XUẤT DỮ LIỆU (REPOSITORY / PRISMA)         │
│ 1. Prisma ORM: Trừu tượng hóa truy vấn, Type-Safety tuyệt đối          │
│ 2. Tối ưu truy vấn: Tránh N+1 query bằng select/include chọn lọc       │
│ 3. Batch Operations: createMany, upsert trong transaction              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Queries (PostgreSQL protocol)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     CƠ SỞ DỮ LIỆU (POSTGRESQL - 12 TABLES)              │
│    Ràng buộc khóa chính, khóa ngoại, ON DELETE RESTRICT / CASCADE     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Trách nhiệm chi tiết của từng tầng (Separation of Concerns)

### Tầng 1: React Frontend (Client-side)
* **Công nghệ:** React 18, Vite, React Router, Axios/Fetch API.
* **Đặc điểm:** Single Page Application (SPA).
* **Cơ chế an toàn:** 
  * Không lưu token trực tiếp trong `localStorage` để chống tấn công XSS; toàn bộ phiên xác thực dùng HTTP-only Cookie (`credentials: 'include'`).
  * Giao diện render theo vai trò người dùng: Giảng viên thấy màn hình quản lý lớp học, nút tạo đề, cấu hình test case, import Excel; Sinh viên chỉ thấy danh sách lớp mình ghi danh và các đề thi đang mở.

### Tầng 2: Express Controller & Middleware (Routing & Defense Layer)
* **Nhiệm vụ cốt lõi:** Là "cổng gác" tiếp nhận mọi HTTP request từ internet.
* **Quy trình xử lý 4 bước nghiêm ngặt:**
  1. **Authentication Guard:** Kiểm tra sự tồn tại và tính hợp lệ của JWT token trong HTTP Cookie. Nếu không hợp lệ hoặc hết hạn, trả về `401 Unauthorized`.
  2. **Role-Based Access Control (RBAC):** Kiểm tra vai trò người dùng (`STUDENT`, `LECTURER`, `ADMIN`). Nếu sinh viên cố gắng gọi API tạo đề thi `POST /api/exams`, middleware chặn ngay lập tức với lỗi `403 Forbidden`.
  3. **Resource Ownership Guard (Kiểm tra quyền sở hữu tài nguyên):** 
     * Ví dụ: Giảng viên A không được phép sửa đề thi hoặc xem danh sách sinh viên của Giảng viên B. Controller kiểm tra `class.lecturerId === req.user.id` trước khi chuyển giao request.
     * Sinh viên chỉ được nộp bài vào lớp nếu có bản ghi `class_enrollments` với trạng thái `ACTIVE`.
  4. **Data Validation:** Sử dụng thư viện validate schema (Zod/Joi) để kiểm tra định dạng dữ liệu (ví dụ: ngày giờ đề thi hợp lệ, tiêu đề không rỗng, file đính kèm đúng mime-type).
* **Nguyên tắc vàng:** Controller **KHÔNG** chứa thuật toán nghiệp vụ (không tính điểm, không parse file Excel, không viết query database). Controller chỉ nhận request, validate, gọi Service và đóng gói HTTP Response (`200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`).

### Tầng 3: Service Layer (Business Core)
* **Nhiệm vụ cốt lõi:** Chứa toàn bộ "trí thông minh" và quy tắc nghiệp vụ của hệ thống. Hoàn toàn tách biệt khỏi giao thức HTTP (không phụ thuộc vào `req`, `res`).
* **Các nghiệp vụ tiêu biểu xử lý tại Service:**
  * **Class Service:** Kiểm tra điều kiện đóng/mở lớp, kiểm tra ràng buộc xem lớp có đủ điều kiện để xóa hay không.
  * **Import Excel Service:** Đọc file `.xlsx`, mapping cột họ tên và email, kiểm tra email có tồn tại tài khoản `STUDENT` đang hoạt động trong DB không, sinh preview token có thời hạn, khóa commit nếu phát hiện tài khoản không hợp lệ.
  * **Exam Service:** Quản lý vòng đời đề thi (Draft ➔ Published ➔ Closed). Kiểm tra thời hạn làm bài (`openTime <= now <= closeTime`), kiểm tra số lần nộp bài (`attemptNumber`), tạo đề bài và bộ test case đi kèm.
  * **Grading & Result Service:** Ẩn kết quả chi tiết của test case ẩn đối với sinh viên khi đề chưa đóng, nhưng mở toàn bộ cho giảng viên theo thời gian thực.
* **Transaction Management:** Khi một thao tác nghiệp vụ cần cập nhật nhiều bảng cùng lúc, Service sẽ điều phối qua Database Transaction để đảm bảo tính toàn vẹn (ACID).

### Tầng 4: Repository Layer & Prisma ORM (Data Access Layer)
* **Nhiệm vụ cốt lõi:** Tương tác trực tiếp với PostgreSQL qua Prisma ORM.
* **Lợi ích kiến trúc:**
  * **Type-Safety:** Mọi thao tác truy vấn đều được kiểm tra kiểu dữ liệu tĩnh từ Prisma Schema, tránh triệt để lỗi runtime do sai tên cột hoặc sai kiểu dữ liệu.
  * **Trừu tượng hóa truy vấn:** Khi cần thay đổi cấu trúc bảng hoặc logic query, chỉ cần sửa tại Repository mà không làm ảnh hưởng đến tầng Service hay Controller.
  * **Transaction Support:** Đảm bảo toàn vẹn dữ liệu khi thực hiện các tác vụ phức tạp như ghi danh sinh viên hàng loạt (`batch enroll`) hoặc tạo đề thi cùng các test cases.

---

# PHẦN 2: CHI TIẾT NGHIỆP VỤ CRUD LỚP HỌC VÀ ĐỀ THI

## 1. CRUD Lớp học (Class Management)

| Thao tác | Quyền hạn | Quy tắc nghiệp vụ & Kiểm tra tính hợp lệ |
| :--- | :--- | :--- |
| **Create (Tạo lớp)** | `LECTURER`, `ADMIN` | Giảng viên nhập tên lớp, mã lớp, học kỳ. Hệ thống tự động gán `lecturerId = req.user.id`. |
| **Read (Xem lớp)** | Đa vai trò | Giảng viên chỉ thấy các lớp do mình quản lý; Sinh viên chỉ thấy các lớp mình có ghi danh `ACTIVE`; Admin xem được tất cả các lớp. |
| **Update (Sửa lớp)** | Chủ sở hữu lớp | Giảng viên cập nhật tên lớp, mô tả, trạng thái đóng/mở lớp. |
| **Delete (Xóa lớp)** | Chủ sở hữu lớp | **HẠN CHẾ NGHIỆP VỤ ĐẶC BIỆT (RESTRICTED DELETION):** Tuyệt đối không cho phép xóa vật lý (Hard delete) nếu lớp đang có sinh viên ghi danh hoặc có đề thi. |

### ⚠️ ĐIỂM NHẤN TRỌNG TÂM: Vì sao xóa lớp bị hạn chế? (Xử lý DB Restrict)
1. **Bảo vệ toàn vẹn dữ liệu (Data Integrity):**
   * Nếu một lớp học đã diễn ra, bên dưới nó có hàng chục sinh viên trong `class_enrollments`, nhiều đề thi trong `exams`, và hàng trăm bài nộp trong `submissions`.
   * Nếu dùng `ON DELETE CASCADE`, một cú click xóa lớp sẽ xóa sạch toàn bộ lịch sử nộp bài, điểm số và kết quả chấm của sinh viên. Đây là lỗi thiết kế hệ thống nghiêm trọng!
2. **Quy tắc cơ sở dữ liệu (Database Constraint):**
   * Quan hệ giữa `classes` và `exams`, cũng như giữa `classes` và `class_enrollments` được thiết lập với ràng buộc **`ON DELETE RESTRICT`**.
   * Khi lệnh xóa được gửi xuống, nếu còn bản ghi con tham chiếu tới `classId`, PostgreSQL sẽ bắn lỗi ràng buộc khóa ngoại (Foreign Key Violation).
3. **Xử lý tại Service Layer:**
   * Tầng Service chủ động kiểm tra trước:
     ```typescript
     const [enrollmentCount, examCount] = await Promise.all([
       classRepository.countEnrollments(classId),
       classRepository.countExams(classId)
     ]);
     
     if (enrollmentCount > 0 || examCount > 0) {
       throw new BusinessRuleError(
         "Không thể xóa lớp học vì đã có sinh viên ghi danh hoặc đề thi liên kết. Vui lòng chuyển trạng thái lớp sang ARCHIVED."
       );
     }
     ```
   * Hệ thống khuyến khích chuyển trạng thái lớp sang `ARCHIVED` (Lưu trữ / Soft delete) để bảo toàn dữ liệu phục vụ thanh tra, phúc khảo và đối soát điểm.

---

## 2. CRUD Đề thi (Exam Management)

| Thao tác | Quyền hạn | Quy tắc nghiệp vụ & Ràng buộc toàn vẹn |
| :--- | :--- | :--- |
| **Create (Tạo đề)** | Giảng viên sở hữu lớp | Giảng viên nhập: Tiêu đề đề bài, mô tả Markdown chi tiết, thời gian mở (`openTime`), thời gian đóng (`closeTime`), ngôn ngữ (`C`, `C++`, `Java`, `Python`), điểm tối đa. Đi kèm danh sách Test Cases (công khai / ẩn). Tạo toàn bộ trong **1 Transaction**. |
| **Read (Xem đề)** | Giảng viên & Sinh viên trong lớp | **Giảng viên:** Xem đầy đủ đề bài, đáp án, test case ẩn, bảng điểm theo thời gian thực.<br>**Sinh viên:** Chỉ xem được đề khi `openTime <= now <= closeTime`; chỉ thấy test case công khai; điểm số và kết quả chi tiết bị ẩn cho đến khi đề thi đóng (`now > closeTime`). |
| **Update (Sửa đề)** | Giảng viên sở hữu đề | **Ràng buộc nghiệp vụ quan trọng:** Nếu đề thi **đã có bài nộp** (`submissions.count > 0`), hệ thống sẽ **KHÓA** không cho phép chỉnh sửa bộ Test Cases hoặc đổi ngôn ngữ biên dịch. Điều này đảm bảo tính công bằng giữa các lần nộp bài của sinh viên. |
| **Delete (Xóa đề)** | Giảng viên sở hữu đề | Chỉ được xóa đề thi nếu chưa có bất kỳ bài nộp nào (`submissions.count === 0`). Nếu đã có bài nộp, thao tác xóa bị từ chối bởi ràng buộc Restrict. |

### 🔒 Kỹ thuật Transaction khi tạo Đề thi:
Khi giảng viên bấm lưu đề thi, hệ thống phải thực hiện 2 thao tác ghi vào database:
1. Tạo bản ghi trong bảng `exams`.
2. Tạo danh sách các bản ghi trong bảng `test_cases` (có `examId` trỏ về đề vừa tạo).

```typescript
// Ví dụ xử lý trong ExamService / ExamRepository:
return await prisma.$transaction(async (tx) => {
  const newExam = await tx.exams.create({
    data: {
      classId,
      title,
      descriptionMarkdown,
      openTime,
      closeTime,
      allowedLanguage,
      maxScore
    }
  });

  const testCasesData = testCases.map(tc => ({
    examId: newExam.id,
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    isHidden: tc.isHidden,
    scoreWeight: tc.scoreWeight,
    timeLimitMs: tc.timeLimitMs
  }));

  await tx.test_cases.createMany({
    data: testCasesData
  });

  return newExam;
});
```
* **Lợi ích:** Đảm bảo tính nguyên tử (Atomicity). Nếu quá trình lưu test case bị lỗi mạng hoặc sai dữ liệu, toàn bộ giao dịch sẽ Rollback ngay lập tức, không để lại đề thi "rỗng" không có test case trong hệ thống.

---

# PHẦN 3: ĐỐI ỨNG KIẾN TRÚC ĐỒNG BỘ VÀ BẤT ĐỒNG BỘ (API VS WORKER)

Một điểm đắt giá để ghi điểm tuyệt đối trong rubric Milestone 2:

```
[Client: Sinh viên] ──(1. Nộp file ZIP)──> [Express Controller]
                                                    │
                                            (2. Lưu submission & SHA-256)
                                                    ▼
                                            [PostgreSQL Database] (Trạng thái: QUEUED)
                                                    │
                                            (3. Đẩy job chấm vào Queue)
                                                    ▼
                                            [Redis / BullMQ Queue]
                                                    │
                                   (4. Trả ngay HTTP 202 Cho Sinh Viên)
                                                    │
                                 ┌──────────────────┴──────────────────┐
                                 ▼                                     ▼
                      [Worker Process (Node.js)]              [Express rảnh tay phục vụ
                                 │                            các request khác]
                     (5. Khởi chạy Sandbox)
                                 ▼
                      [Docker Container Sandbox]
                      - Compile code sinh viên
                      - Chạy test cases độc lập
                      - Giới hạn CPU, RAM, Timeout
                                 │
                     (6. Cập nhật kết quả)
                                 ▼
                      [PostgreSQL Database]
                      (Status: PASSED / COMPILE_ERROR / TIME_LIMIT_EXCEEDED)
```

* **Vì sao không chấm bài ngay trong Express Controller?**
  * Quá trình biên dịch và chạy test cases tốn từ vài giây đến cả phút. Nếu thực hiện trực tiếp trong Controller, luồng xử lý Node.js Event Loop sẽ bị nghẽn (Blocking I/O), khiến hệ thống không thể nhận request của những người dùng khác.
  * Tách riêng **BullMQ Worker** chạy tiến trình độc lập giúp hệ thống chịu tải cao (High Concurrency), phản hồi tức thì cho sinh viên trạng thái `QUEUED` và đảm bảo an ninh tuyệt đối nhờ **Docker Sandbox**.

---

# PHẦN 4: LỜI THOẠI THUYẾT TRÌNH MẪU (SPEAKER SCRIPT CHI TIẾT TỪNG CÂU)

> 💡 **Hướng dẫn cho bạn:** Bạn có thể in phần này ra giấy hoặc nhìn vào màn hình để nói theo. Từng đoạn đều đã được căn chỉnh thời gian chuẩn 6 - 8 phút.

---

### [00:00 - 01:00] Đoạn mở đầu & Chuyển giao phần trình bày
> *"Kính chào quý thầy cô và hội đồng đánh giá. Tiếp nối phần trình bày của bạn [Tên TV1] về Workflow 0 — cơ chế đăng nhập và kiểm soát phiên, em là [Tên bạn], đại diện nhóm phụ trách **Phần 2: Kiến trúc mã nguồn và các thao tác nghiệp vụ CRUD**.*
>
> *Nếu như Workflow 0 là cánh cổng xác thực người dùng, thì phần kiến trúc mà em sắp trình bày chính là toàn bộ khung xương của hệ thống: từ việc phân tách trách nhiệm giữa các tầng code, cơ chế bảo vệ tài nguyên ở Middleware, cho đến logic nghiệp vụ bảo vệ tính toàn vẹn của dữ liệu trong các thao tác CRUD Lớp học và Đề thi."*

---

### [01:00 - 03:00] Trình bày Kiến trúc nhiều lớp (Layered Architecture)
> *"Thưa thầy cô, để hệ thống đạt tính mở rộng cao, dễ kiểm thử và tuân thủ nguyên tắc Single Responsibility, nhóm em xây dựng backend theo mô hình **Kiến trúc nhiều lớp (Layered Architecture)** gồm:*
>
> 1. *Đầu tiên là **Tầng Giao diện (React Frontend)**: Xây dựng bằng React và Vite, chia thành 3 phân hệ giao diện độc lập cho Sinh viên, Giảng viên và Quản trị viên. Frontend hoàn toàn không lưu token trong `localStorage` để chống tấn công XSS, mà sử dụng cơ chế HTTP-only cookie gửi kèm theo mỗi request.*
>
> 2. *Thứ hai là **Tầng Điều phối (Express Controller & Middleware)**: Đây là lớp phòng thủ đầu tiên của backend. Controller đóng vai trò điều phối luồng:
>    * Nó tiếp nhận HTTP request và ngay lập tức chạy qua chuỗi Middleware: giải mã JWT token trong cookie, kiểm tra Role của người dùng (`STUDENT`, `LECTURER`, `ADMIN`), và đặc biệt là kiểm tra quyền sở hữu tài nguyên (Resource Ownership Guard). Ví dụ: Giảng viên chỉ được thao tác trên lớp học do chính mình tạo ra.
>    * Sau khi xác thực và validate dữ liệu đầu vào thành công, Controller chuyển giao dữ liệu sạch xuống tầng Service. Controller tuyệt đối không can thiệp vào logic tính toán nghiệp vụ hay câu lệnh truy vấn database.*
>
> 3. *Thứ ba là **Tầng Nghiệp vụ (Service Layer)**: Đây là trái tim của ứng dụng, nơi tập trung toàn bộ business rules. Các logic phức tạp như: phân tích file Excel import sinh viên, tính điểm bài thi, che giấu test case ẩn, hay kiểm tra điều kiện nộp bài đều được xử lý tập trung tại đây. Service hoàn toàn độc lập với Express, giúp code dễ dàng viết Unit Test mà không cần mock request/response.*
>
> 4. *Thứ tư là **Tầng Truy xuất Dữ liệu (Repository Layer với Prisma ORM)**: Tầng này giao tiếp trực tiếp với cơ sở dữ liệu PostgreSQL. Bằng việc sử dụng Prisma ORM, toàn bộ câu lệnh truy vấn đều được đảm bảo Type-Safety tuyệt đối, ngăn chặn triệt để nguy cơ SQL Injection và kiểm soát chặt chẽ các Database Transaction."*

---

### [03:00 - 05:30] Trình bày Thao tác CRUD Lớp học & Ràng buộc Xóa (Restrict Delete)
> *"Tiếp theo, em xin đi sâu vào các thao tác nghiệp vụ CRUD trên hai thực thể cốt lõi nhất của hệ thống: **Lớp học (Classes)** và **Đề thi (Exams)**.*
>
> *Đối với **Lớp học**:*
> * *Giảng viên có toàn quyền Tạo, Xem danh sách lớp mình dạy, và Cập nhật thông tin lớp.*
> * *Tuy nhiên, ở thao tác **Xóa lớp (Delete)**, nhóm em áp dụng một quy tắc nghiệp vụ sống còn: **Hạn chế xóa lớp học nếu lớp đã có dữ liệu liên quan (Restricted Deletion)**.*
> * *Thưa thầy cô, trong môi trường giáo dục, khi một lớp học đã có sinh viên ghi danh và đã có các bài thi chứa bài nộp, việc thực hiện xóa vật lý (Hard delete với Cascade) sẽ xóa sạch toàn bộ lịch sử học tập và điểm số của sinh viên. Do đó, ở tầng Database, nhóm em cấu hình ràng buộc khóa ngoại là `ON DELETE RESTRICT`.*
> * *Đồng thời tại tầng Service, trước khi thực hiện xóa, hệ thống luôn kiểm tra xem lớp có sinh viên active hoặc có đề thi hay không. Nếu có, hệ thống lập tức từ chối và hướng dẫn giảng viên chuyển trạng thái lớp sang `ARCHIVED` (Lưu trữ). Điều này bảo vệ 100% tính toàn vẹn dữ liệu và phục vụ công tác thanh tra, phúc khảo sau này."*

---

### [05:30 - 07:00] Trình bày Thao tác CRUD Đề thi & Tính toàn vẹn vòng đời thi cử
> *"Đối với **Đề thi (Exams)**:*
> * *Khi giảng viên tạo một đề thi mới, hệ thống hỗ trợ mô tả bằng định dạng Markdown, thiết lập thời gian mở/đóng, ngôn ngữ lập trình cho phép, và bộ Test Cases gồm cả test case công khai lẫn test case ẩn.*
> * *Để đảm bảo tính toàn vẹn, thao tác tạo đề thi và tạo danh sách test case được bọc trong một **Database Transaction** (`prisma.$transaction`). Nếu quá trình lưu test case gặp sự cố, toàn bộ đề thi sẽ được rollback ngay, không để lại bản ghi rác.*
> * *Về phân quyền xem (Read): Giảng viên có thể xem trọn vẹn đề và bảng điểm bất kỳ lúc nào. Nhưng đối với sinh viên, hệ thống chỉ cho phép xem đề trong khoảng thời gian hiệu lực, chỉ xem được test case công khai, và điểm số của sinh viên chỉ được hiển thị sau khi đề thi chính thức đóng.*
> * *Đặc biệt, về thao tác **Cập nhật đề thi (Update)**: Nếu đề thi **đã có bài nộp từ sinh viên**, hệ thống sẽ khóa chức năng chỉnh sửa cấu hình test case và ngôn ngữ lập trình. Ràng buộc này đảm bảo tính công bằng tuyệt đối trong kỳ thi, tránh trường hợp bài nộp trước và bài nộp sau bị chấm theo hai tiêu chí khác nhau.*
>
> *Ngoài ra, để chuẩn bị cho phần chấm bài của bạn [Tên TV5], em xin nhấn mạnh rằng tầng API của nhóm em chỉ đóng vai trò tiếp nhận bài nộp, lưu mã băm SHA-256 và đẩy job vào Redis BullMQ, sau đó trả ngay kết quả `202 Accepted` cho sinh viên. Việc chấm bài được tách hẳn sang một **Worker độc lập chạy Docker sandbox**, đảm bảo không bao giờ làm nghẽn luồng xử lý của hệ thống web.*
>
> *Trên đây là toàn bộ bức tranh về Kiến trúc Code và các ràng buộc CRUD của dự án. Sau đây, em xin nhường lời cho bạn [Tên TV3] để phân tích chi tiết thiết kế 12 bảng trong cơ sở dữ liệu PostgreSQL. Em xin cảm ơn thầy cô đã lắng nghe!"*

---

# PHẦN 5: BỘ 10 CÂU HỎI PHẢN BIỆN CỦA GIẢNG VIÊN & CÂU TRẢ LỜI CHUẨN 10/10

### ❓ Câu hỏi 1: Tại sao nhóm lại chia thành 3 tầng Controller - Service - Repository mà không viết thẳng truy vấn DB trong Controller cho nhanh?
> **Trả lời:**
> *"Dạ thưa thầy/cô, việc phân tách 3 tầng tuân thủ nguyên lý **Separation of Concerns (SoC)** và **Single Responsibility Principle (SRP)**:
> 1. **Dễ kiểm thử (Testability):** Tầng Service chứa toàn bộ logic nghiệp vụ mà không phụ thuộc vào `req`/`res` của Express, giúp nhóm dễ dàng viết Unit Test tự động cho các hàm tính điểm, validate import.
> 2. **Dễ bảo trì và mở rộng:** Nếu sau này nhóm đổi từ Express sang NestJS hoặc đổi từ Prisma sang TypeORM, nhóm chỉ cần viết lại tầng Controller hoặc Repository mà không phải đụng vào tầng nghiệp vụ cốt lõi (Service).
> 3. **Tái sử dụng code:** Một hàm trong Service hoặc Repository có thể được gọi bởi nhiều controller khác nhau hoặc được gọi bởi background worker."*

---

### ❓ Câu hỏi 2: Cơ chế kiểm tra quyền truy cập tài nguyên (Resource Ownership) được thực hiện ở đâu và như thế nào?
> **Trả lời:**
> *"Dạ thưa thầy/cô, cơ chế này được thực hiện qua chuỗi Middleware chuyên biệt tại tầng Controller, kết hợp với truy vấn xác thực từ Service/Repository:
> 1. Trước hết, middleware `authenticate` xác thực JWT từ cookie và gắn thông tin `req.user` vào request.
> 2. Sau đó, middleware `authorizeClassOwner` sẽ lấy `classId` từ URL params, truy vấn kiểm tra xem `class.lecturerId === req.user.id` hay không. Nếu không trùng khớp, hệ thống chặn ngay và trả về HTTP `403 Forbidden` trước khi request kịp chạm vào logic nghiệp vụ của Service.
> 3. Tương tự, với sinh viên nộp bài, middleware sẽ kiểm tra sinh viên có bản ghi `ACTIVE` trong bảng `class_enrollments` của lớp đó hay không."*

---

### ❓ Câu hỏi 3: Tại sao nhóm không sử dụng Cascade Delete cho Lớp học để khi xóa lớp thì tự động xóa hết dữ liệu bên dưới cho gọn?
> **Trả lời:**
> *"Dạ thưa thầy/cô, trong một hệ thống giáo dục và khảo thí, dữ liệu bài thi (`exams`), bài nộp (`submissions`) và điểm số của sinh viên là dữ liệu có giá trị pháp lý và giá trị đào tạo rất cao.
> Nếu nhóm cấu hình `ON DELETE CASCADE`, một thao tác bấm nhầm xóa lớp từ phía giảng viên sẽ làm mất vĩnh viễn toàn bộ bài làm và điểm số của hàng trăm sinh viên mà không thể khôi phục được.
> Vì vậy, nhóm chọn thiết kế **`ON DELETE RESTRICT`** ở tầng database kết hợp validation ở tầng Service: chỉ cho phép xóa lớp khi lớp hoàn toàn rỗng. Khi lớp đã có dữ liệu, giảng viên chỉ có thể chuyển sang trạng thái `ARCHIVED` (Lưu trữ) để vừa ẩn khỏi giao diện hoạt động, vừa bảo toàn toàn bộ dữ liệu lịch sử."*

---

### ❓ Câu hỏi 4: Khi tạo Đề thi có chứa danh sách Test Cases, nếu lưu đề thành công nhưng lưu test cases bị lỗi thì hệ thống xử lý ra sao?
> **Trả lời:**
> *"Dạ thưa thầy/cô, nhóm xử lý trường hợp này bằng **Database Transaction** thông qua `prisma.$transaction`.
> Cụ thể, việc tạo bản ghi trong bảng `exams` và hàng loạt bản ghi trong bảng `test_cases` được thực thi trong cùng một giao dịch nguyên tử (Atomic Transaction). Nếu có bất kỳ lỗi nào xảy ra khi chèn test case (ví dụ: vi phạm ràng buộc dữ liệu, mất kết nối mạng), Prisma sẽ tự động phát tín hiệu `ROLLBACK`, hủy bỏ toàn bộ thao tác và hoàn trả trạng thái database như ban đầu. Hệ thống đảm bảo không bao giờ sinh ra một đề thi mồ côi không có test case."*

---

### ❓ Câu hỏi 5: Tại sao sinh viên lại không được xem điểm ngay sau khi hệ thống chấm xong mà phải đợi đề thi đóng?
> **Trả lời:**
> *"Dạ thưa thầy/cô, đây là quy tắc nghiệp vụ chống gian lận trong thi cử:
> 1. Nếu sinh viên biết điểm ngay khi nộp lần đầu (trong khi đề vẫn đang mở), sinh viên có thể dùng kết quả đó để phán đoán test case ẩn và chỉnh sửa bài nộp để gian lận, hoặc chia sẻ thông tin cho các bạn khác trong lớp.
> 2. Giảng viên thì luôn luôn xem được kết quả và bảng điểm theo thời gian thực để theo dõi tiến độ phòng thi.
> 3. Tầng Service của nhóm kiểm tra: Nếu người gọi API là `STUDENT` và thời điểm hiện tại `now <= exam.closeTime`, trường điểm số và chi tiết test results sẽ bị che đi (masking), chỉ trả về trạng thái bài nộp đã được chấm hay chưa."*

---

### ❓ Câu hỏi 6: Nếu một đề thi đang mở và đã có 5 sinh viên nộp bài, giảng viên có được phép sửa đổi test cases ẩn không?
> **Trả lời:**
> *"Dạ thưa thầy/cô, hệ thống **tuyệt đối không cho phép** sửa đổi test case hoặc đổi ngôn ngữ thi khi đề thi đã có ít nhất 1 bài nộp (`submissions.count > 0`).
> Tầng Service kiểm tra số lượng submission của đề thi: nếu lớn hơn 0, request cập nhật test case sẽ bị từ chối với lỗi nghiệp vụ. Điều này đảm bảo nguyên tắc công bằng: tất cả sinh viên cùng nộp vào một đề thi đều phải được đánh giá trên cùng một bộ tiêu chuẩn và cùng một bộ test case duy nhất."*

---

### ❓ Câu hỏi 7: Sự khác biệt giữa tầng xử lý API của Express và Worker chấm bài là gì? Vì sao không để Express tự chấm?
> **Trả lời:**
> *"Dạ thưa thầy/cô:
> * **Express Controller** là kiến trúc hướng sự kiện đơn luồng (Single-threaded Event Loop), chuyên xử lý các request HTTP I/O nhẹ, thời gian phản hồi chỉ vài phần trăm giây (milliseconds).
> * Trong khi đó, việc chấm một bài thi lập trình đòi hỏi: giải nén file ZIP, khởi tạo Docker sandbox, biên dịch mã nguồn (`gcc`/`javac`) và chạy chương trình với nhiều bộ test cases. Quá trình này ngốn rất nhiều CPU và có thể kéo dài từ 5 đến 30 giây.
> * Nếu để Express trực tiếp biên dịch và chạy Docker, toàn bộ Event Loop sẽ bị block, máy chủ web sẽ bị treo và không thể tiếp nhận request đăng nhập, xem đề của các người dùng khác.
> * Vì vậy, nhóm tách hẳn việc chấm bài thành một **Worker Process độc lập**, giao tiếp qua hàng đợi **BullMQ trên Redis**. Express chỉ lưu bài nộp ở trạng thái `QUEUED` rồi trả ngay phản hồi cho sinh viên, đảm bảo server web luôn luôn mượt mà."*

---

### ❓ Câu hỏi 8: Repository Pattern kết hợp với Prisma ORM mang lại lợi ích gì so với việc viết trực tiếp `prisma.class.findMany()` trong Service?
> **Trả lời:**
> *"Dạ thưa thầy/cô:
> 1. **Tách biệt tầng dữ liệu:** Giúp Service hoàn toàn tập trung vào nghiệp vụ logic (Business logic) mà không cần bận tâm đến cú pháp cụ thể của thư viện ORM.
> 2. **Tối ưu hóa và tái sử dụng câu truy vấn:** Trong Repository, nhóm có thể viết sẵn các phương thức tối ưu hóa có sẵn `select` và `include` các trường cần thiết, tránh việc nhiều service viết lại các câu query dài dòng gây lỗi dư thừa dữ liệu (Over-fetching).
> 3. **Dễ dàng Mocking khi viết Unit Test:** Khi viết unit test cho Service, nhóm có thể dễ dàng mock các hàm của Repository mà không cần phải giả lập một Prisma Client phức tạp hoặc cần database thật."*

---

### ❓ Câu hỏi 9: Token xác thực được lưu ở đâu? Tại sao nhóm không lưu trong `localStorage`?
> **Trả lời:**
> *"Dạ thưa thầy/cô, toàn bộ `access_token` và `refresh_token` được nhóm lưu trữ trong **HTTP-only Cookie** với các cờ bảo mật: `HttpOnly = true`, `SameSite = Strict`, và `Secure = true` (khi chạy production HTTPS).
> Nhóm không lưu trong `localStorage` vì dữ liệu trong `localStorage` có thể bị truy cập dễ dàng bởi bất kỳ mã JavaScript nào chạy trên trình duyệt. Nếu trang web vô tình dính lỗi XSS (Cross-Site Scripting), kẻ tấn công có thể đánh cắp toàn bộ token để mạo danh người dùng. Với HTTP-only Cookie, mã JavaScript hoàn toàn không thể đọc được token, giúp hệ thống an toàn tuyệt đối trước nguy cơ này."*

---

### ❓ Câu hỏi 10: Nếu Redis gặp sự cố sập nguồn ngay khi sinh viên nộp bài, bài thi đó có bị mất không? Hệ thống phục hồi ra sao?
> **Trả lời:**
> *"Dạ thưa thầy/cô, bài thi của sinh viên **hoàn toàn không bị mất**!
> Lý do là vì quy trình nộp bài của nhóm được thiết kế theo nguyên tắc **Database-First**:
> 1. Khi nhận file ZIP từ sinh viên, hệ thống lưu file vào storage an toàn, tính toán mã băm SHA-256, và ghi bản ghi vào bảng `submissions` trong PostgreSQL ở trạng thái `QUEUED` trước.
> 2. Sau khi ghi nhận thành công trong cơ sở dữ liệu, hệ thống mới tiến hành đẩy job vào Redis/BullMQ.
> 3. Nếu Redis bị sập tại thời điểm enqueue, bản ghi trong PostgreSQL vẫn tồn tại ở trạng thái `QUEUED`. Worker chấm bài của nhóm có một cơ chế kiểm tra định kỳ (Reconciliation cron job): tự động quét trong PostgreSQL các submission bị kẹt ở trạng thái `QUEUED` quá lâu mà chưa có kết quả để tự động nạp lại vào hàng đợi chấm bài khi Redis hoạt động trở lại."*

---

## 🎯 CHECKLIST CHUẨN BỊ CHO BUỔI THUYẾT TRÌNH (DÀNH CHO THÀNH VIÊN 2)
- [ ] Đọc kỹ và thuộc lòng lời thoại thuyết trình mẫu trong Phần 4 (nói to rõ ràng, tự tin, phát âm chuẩn các thuật ngữ: *Controller, Service, Repository, Prisma, Transaction, Restrict, BullMQ, Docker Sandbox*).
- [ ] Mở sẵn VS Code với các thư mục:
  - `controllers/`: Chỉ cho thầy cô thấy controller nhận request, gọi middleware và không viết logic nặng.
  - `middlewares/`: Chỉ middleware kiểm tra quyền sở hữu (`authorizeClassOwner`).
  - `services/`: Chỉ hàm kiểm tra điều kiện xóa lớp (`countEnrollments > 0 ? throw Error`).
  - `repositories/`: Chỉ hàm tạo đề thi dùng `prisma.$transaction`.
- [ ] Ôn kỹ 10 câu hỏi phản biện ở Phần 5 để sẵn sàng trả lời ngay khi giảng viên vừa dứt lời.
