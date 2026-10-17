# TÀI LIỆU TÍNH NĂNG: ĐỐI SOÁT AST VÀ TRUNG TÂM GIÁM ĐỊNH ĐẠO VĂN
**Người thực hiện:** H.Hưng (`hhung`)  
**Dự án:** AITA - Intelligent (Automated Intelligent Testing & Assessment Platform)  
**Thời gian hoàn thành:** 17/10/2026  

---

## 📌 1. Tổng quan tính năng (Feature Overview)

Tính năng **AST & Plagiarism Detection** là một trong những phân hệ cốt lõi của đồ án AITA, giải quyết bài toán chống gian lận trong các kỳ thi lập trình:
* Thay vì so sánh chuỗi văn bản thông thường (vốn dễ bị qua mặt bằng cách đổi tên biến, thêm khoảng trắng hay comment), hệ thống trích xuất **Cây Cú pháp Trừu tượng (Abstract Syntax Tree - AST)** của mã nguồn.
* Sử dụng giải thuật băm chọn lọc **Winnowing Algorithm** để sinh ra tập hợp dấu vân tay (**k-gram AST Fingerprints**) nhỏ gọn nhưng bảo toàn tính đặc trưng cú pháp.
* Cung cấp **Trung tâm Giám định Đạo văn (Plagiarism Investigation Center)** cho Giảng viên:
  - Xem thống kê tổng quan (Tổng số cặp, Nghi vấn cao ≥ 75%, Đã xác nhận, Đã bỏ qua).
  - Lọc và tìm kiếm sinh viên theo % tương đồng và trạng thái.
  - Nút **"Quét lại toàn bộ bài thi" (Scan All Submissions)** để tự động phân tích và đối soát chéo toàn bộ bài nộp trong đề.
  - **Giao diện So sánh Song song (Side-by-side Dual Code Diff Viewer)**: Tô màu làm nổi bật chính xác các dòng mã nguồn trùng lặp giữa 2 sinh viên.
  - Giảng viên trực tiếp đưa ra quyết định: **Xác nhận gian lận (`CONFIRMED`)**, **Bỏ qua / Hợp lệ (`DISMISSED`)**, hoặc **Đang nghi vấn (`SUSPECTED`)**, kèm ô nhập ghi chú nhận xét (`lecturerNote`).

---

## ⚙️ 2. Kiến trúc & Giải thuật Kỹ thuật (Technical Architecture)

### A. Giải thuật AST & Winnowing (`apps/backend/src/modules/rbl/winnowing.ts`)
1. **Phân tích Cú pháp AST (AST Tokenization):**
   - Mã nguồn được phân tích thành chuỗi token cú pháp (loại bỏ comment, docstring, chuẩn hóa tên biến/hàm thành token định danh chung `ID`).
   - Kết quả: Hai hàm code khác nhau về tên biến nhưng cùng cấu trúc thuật toán sẽ sinh ra chuỗi token AST giống hệt nhau 100%.
2. **K-gram Hashing:**
   - Tạo các cửa sổ trượt độ dài $k$ token ($k=5$). Mỗi $k$-gram được băm bằng SHA-256 tạo ra mã băm 63-bit BigInt tương thích PostgreSQL.
3. **Thuật toán Winnowing (Rightmost Minima):**
   - Duyệt cửa sổ trượt kích thước $w$ ($w=4$) trên mảng các mã băm, chọn phần tử nhỏ nhất bên phải nhất để đảm bảo phát hiện mọi đoạn trùng lặp có độ dài tối thiểu $t = w + k - 1$.
4. **Độ tương đồng (Jaccard Index):**
   $$\text{Similarity}(A, B) = \frac{|Fingerprints(A) \cap Fingerprints(B)|}{\min(|Fingerprints(A)|, |Fingerprints(B)|)} \times 100\%$$

---

## 📡 3. Danh sách API Endpoints mới

| Phương thức | Đường dẫn API | Quyền hạn | Chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/exams/:examId/plagiarism` | Giảng viên / Admin | Lấy danh sách toàn bộ báo cáo đạo văn của đề thi |
| `POST` | `/api/exams/:examId/plagiarism/scan` | Giảng viên / Admin | Kích hoạt quét AST và đối soát toàn bộ bài nộp của lớp |
| `GET` | `/api/exams/:examId/plagiarism/:reportId` | Giảng viên / Admin | Lấy chi tiết so sánh side-by-side (code 2 bên, dòng trùng) |
| `PATCH` | `/api/exams/:examId/plagiarism/:reportId` | Giảng viên / Admin | Cập nhật quyết định (`CONFIRMED`, `DISMISSED`) & ghi chú |
| `POST` | `/api/submissions/:id/ast-analyze` | Giảng viên / Admin | Kích hoạt phân tích AST thủ công cho 1 bài nộp |

---

## 🖥️ 4. Thành phần Giao diện Frontend (UI Components)

1. **`PlagiarismInvestigationModal.tsx`**:
   - Modal hiển thị song song 2 cột mã nguồn giữa Sinh viên A và Sinh viên B.
   - Tô nền đỏ nhạt và viền đỏ nổi bật các dòng trùng lặp (`highlightedLinesA`, `highlightedLinesB`).
   - Thống kê tỷ lệ %, số k-gram hashes trùng, thời gian nộp bài của từng sinh viên.
   - Bảng điều khiển quyết định của Giảng viên (Xác nhận gian lận, Bỏ qua, Ghi chú nhận xét).
2. **Nâng cấp `ExamSubmissionsPage.tsx`**:
   - Thẻ thống kê nhanh (Metric Cards).
   - Thanh công cụ tìm kiếm và lọc trạng thái / ngưỡng tương đồng.
   - Nút chạy quét tự động kèm thông báo kết quả.
   - Nút "So sánh chi tiết" mở modal giám định.

---

## 🧪 5. Kiểm thử Tự động (Unit Tests)

Đã bổ sung bộ test `apps/backend/tests/ast-plagiarism.test.cjs` kiểm chứng:
1. Thuật toán Rightmost Minima hoạt động chính xác trên cửa sổ trượt.
2. Winnowing sinh ra tập fingerprint nhất quán từ chuỗi AST tokens.
3. Độ tương đồng đạt 100% khi cấu trúc AST trùng khớp hoàn toàn.
4. Bất biến trước việc đổi tên biến/hàm (Variable Renaming Invariance).
