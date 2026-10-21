# TÀI LIỆU THIẾT KẾ KỸ THUẬT: CƠ CHẾ ĐỐI CHIẾU MÃ NGUỒN ZIP VÀ GITHUB REPOSITORY
## HỆ THỐNG ĐÁNH GIÁ & CHẤM ĐIỂM TỰ ĐỘNG THÔNG MINH (AITA - INTELLIGENT)
* **Môn học:** SWP391 - Software Development Project
* **Nhóm thực hiện:** Group 5
* **Phân hệ:** Quản lý bài thi nhóm & Kiểm toán tính toàn vẹn mã nguồn (Group Exam Integrity & Git Verification)
* **Phiên bản:** 1.0 (Milestone 2)

---

## 1. BỐI CẢNH VÀ ĐẶT VẤN ĐỀ (PROBLEM STATEMENT)

### 1.1. Thực trạng trong các kỳ thi lập trình theo nhóm
Trong các bài thi hoặc đồ án lập trình theo nhóm (Group Exam / Project):
* Sinh viên được yêu cầu làm việc cộng tác trên một **GitHub Repository** để hệ thống theo dõi mức độ đóng góp cá nhân (Git Analytics) qua số lượng commit và dòng mã (LOC).
* Tuy nhiên, theo quy chế thi khảo thí, bài thi nộp lên hệ thống để chấm điểm tự động (Autograding) bắt buộc phải là một tệp nén **`.zip`** chứa toàn bộ mã nguồn tại thời điểm kết thúc bài thi.

### 1.2. Lỗ hổng gian lận phát sinh (The Exploit)
Nếu hệ thống không có cơ chế đối chiếu ràng buộc giữa hai đối tượng này:
* **Gian lận mượn repo:** Sinh viên có thể đăng ký link của một repository có lịch sử commit rất đẹp, nhiều commit và đóng góp đồng đều từ các thành viên, nhưng khi nộp bài lại tải lên một file ZIP chứa mã nguồn của bài khác (hoặc code đi xin từ nhóm khác) để chạy qua các test cases của Docker.
* **Bất nhất dữ liệu (Data Inconsistency):** Điểm cá nhân được phân bổ theo tỷ lệ đóng góp của một repository không hề liên quan đến bộ mã nguồn đang được hệ thống chấm điểm thực tế.

👉 **Mục tiêu của giải pháp:** Xây dựng cơ chế xác minh tự động, đối chiếu từng tệp tin trong file ZIP nộp lên với cây thư mục (Git Tree) của repository GitHub tại đúng mã băm commit (Commit SHA) đã khai báo.

---

## 2. NGUYÊN LÝ KỸ THUẬT: GIT BLOB SHA-1 & GIT TREE

### 2.1. Tại sao không thể dùng mã băm SHA-1 thông thường?
Trong Git, mỗi tệp tin mã nguồn được lưu trữ dưới dạng một đối tượng **Blob (Binary Large Object)**. Git không băm trực tiếp nội dung thuần của tệp tin mà bổ sung một header siêu dữ liệu (metadata header) chuẩn trước khi băm SHA-1:

$$\text{Git Blob SHA-1} = \text{SHA1}\Big(\text{"blob "} + \text{kích\_thước\_bytes} + \text{"\textbackslash 0"} + \text{nội\_dung\_tệp}\Big)$$

* Nếu dùng hàm băm SHA-1 thông thường trên nội dung tệp, kết quả sẽ **hoàn toàn khác** với mã băm mà Git quản lý.
* Bằng cách tính toán mã băm theo đúng cấu trúc Git Blob, hệ thống có thể so sánh trực tiếp kết quả với mã SHA do GitHub API trả về mà **không cần phải tải nội dung từng file trên GitHub về máy chủ**.

### 2.2. Kiến trúc truy xuất qua GitHub Git Database API
Thay vì sử dụng lệnh `git clone` (rất tốn băng thông, disk I/O và làm nghẽn máy chủ khi repo nặng hàng trăm MB), hệ thống sử dụng **GitHub Git Trees API**:

$$\text{GET } \text{https://api.github.com/repos/}\{owner\}/\{repo\}/\text{git/trees/}\{commitSha\}\text{?recursive=1}$$

* **Ưu điểm vượt trội:**
  * Chỉ mất 1 HTTP request duy nhất để lấy toàn bộ danh sách tệp tin và mã Git Blob SHA-1 của toàn bộ cây thư mục dự án.
  * Thời gian phản hồi cực nhanh: **$< 500\text{ms}$**.
  * Dung lượng payload JSON chỉ vài chục KB.

---

## 3. QUY TRÌNH THỰC THI CHI TIẾT (6 BƯỚC)

```
[Sinh viên nộp bài]
       │
       ▼
(1. Nhập Commit SHA & Tải file ZIP)
       │
       ▼
(2. Kiểm tra Commit trên GitHub) ──[HTTP 404/422]──> [Báo lỗi: Commit không tồn tại]
       │ [Hợp lệ]
       ▼
(3. Lấy Git Tree qua GitHub API)
       │
       ▼
(4. Đọc file ZIP & Băm Git Blob SHA-1 từng file)
       │
       ▼
(5. So khớp cây thư mục: ZIP vs Git Tree)
       │
       ├── Khớp 100% ────────────> Trạng thái: VERIFIED
       ├── Khớp một phần ────────> Trạng thái: PARTIAL
       ├── Lệch hoàn toàn ───────> Trạng thái: MISMATCH (Chặn nộp / Báo lỗi 400)
       └── Lỗi mạng/Private ─────> Trạng thái: UNVERIFIED (Fallback an toàn)
       │
       ▼
(6. Ghi nhận Database & Phân bổ điểm cá nhân BR-12)
```

### Bước 1: Tiếp nhận và xác định phiên bản mã nguồn
Khi sinh viên (Trưởng nhóm) thực hiện nộp bài:
* Hệ thống yêu cầu cung cấp file nén `.zip` và mã **Commit SHA** (7 đến 40 ký tự hex).
* Cố định phiên bản tại commit này giúp quá trình đối chiếu mã nguồn và phân tích đóng góp cá nhân (Git Analytics) luôn xét trên cùng một trạng thái lịch sử.

### Bước 2: Xác thực sự tồn tại của Commit trên GitHub
* Backend gọi GitHub API: `GET /repos/:owner/:repo/commits/:commitSha`.
* **Xử lý ngoại lệ:**
  * Bắt cả mã lỗi `HTTP 404` (Not Found) và `HTTP 422` (Unprocessable Entity - khi mã SHA không tồn tại trên repository).
  * Nếu commit không có thật, hệ thống lập tức ném lỗi `HTTP 400`:
    > *"Commit SHA không tồn tại trên repository GitHub của nhóm. Vui lòng kiểm tra lại."*
  * Kiểm tra thời điểm tạo commit (`commitDate`): Nếu commit được tạo sau thời hạn kết thúc đề thi (`exam.endTime`), bài nộp bị đánh dấu là nộp muộn (`isLate = true`).

### Bước 3: Truy xuất cây thư mục Git Tree
* Backend gửi request: `GET /repos/:owner/:repo/git/trees/:commitSha?recursive=1`.
* GitHub trả về mảng danh sách toàn bộ các file trong repository kèm mã băm `sha` của từng file blob.
* Chuyển đổi danh sách này thành một `Map<path, blobSha>` để tra cứu với độ phức tạp $O(1)$.

### Bước 4: Giải nén an toàn và băm Git Blob SHA-1 trong bộ nhớ
* Đọc các tệp trong file ZIP bằng Stream an toàn (giới hạn kích thước tối đa 25MB, kiểm tra chống tấn công Zip-bomb).
* Chuẩn hóa đường dẫn tương đối (loại bỏ ký tự gạch chéo đầu `/`, lọc bỏ các thư mục rác hệ thống như `__MACOSX`, `.DS_Store`).
* Với mỗi tệp mã nguồn, áp dụng hàm băm Git Blob:
  ```typescript
  computeGitBlobSha(content: Buffer): string {
    const header = Buffer.from(`blob ${content.length}\0`);
    return crypto.createHash('sha1').update(Buffer.concat([header, content])).digest('hex');
  }
  ```

### Bước 5: So khớp mã băm và phân loại 4 trạng thái
Hệ thống tiến hành đối chiếu từng file trong ZIP với Git Tree:
* **Tệp khớp (`MATCHED`):** Tệp có đường dẫn tồn tại trong Git Tree và mã băm `zipBlobSha === gitBlobSha`.
* **Tệp sửa đổi (`MODIFIED`):** Tệp có đường dẫn tồn tại trong Git Tree nhưng mã băm bị lệch (nội dung bị sửa đổi cục bộ trước khi nén ZIP).
* **Tệp không có trên repo (`NOT_IN_REPO`):** Tệp chỉ có trong ZIP nhưng không tồn tại trên commit GitHub.

Dựa trên tỷ lệ khớp, hệ thống xếp loại bài nộp vào **4 trạng thái kiểm toán**:

| Trạng thái | Điều kiện phân loại | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- |
| 🟢 **`VERIFIED`** | Tỷ lệ khớp $= 100\%$ | Toàn bộ mã nguồn trong ZIP trùng khớp tuyệt đối với commit trên GitHub. Đủ điều kiện chấm điểm tối đa. |
| 🟡 **`PARTIAL`** | Tỷ lệ khớp $> 0\%$ nhưng $< 100\%$ | Sinh viên có chỉnh sửa nhỏ hoặc bổ sung file cấu hình trước khi nộp. Ghi nhận tỷ lệ % khớp để giảng viên xem xét. |
| 🔴 **`MISMATCH`** | Tỷ lệ khớp $= 0\%$ | Toàn bộ mã nguồn trong ZIP hoàn toàn không liên quan đến commit trên GitHub. **Kích hoạt cơ chế Hard Block từ chối nhận bài nộp**. |
| ⚪ **`UNVERIFIED`** | Repository private hoặc lỗi mạng API | Hệ thống không thể lấy cây thư mục; ghi nhận để đối soát thủ công, không làm gián đoạn bài thi khẩn cấp. |

### Bước 6: Kiểm soát chấm điểm & Ghi nhận Audit Log
* Khi bài nộp bị `MISMATCH`, hệ thống ném ngoại lệ `HTTP 400` ngăn chặn ghi dữ liệu:
  > *"Bài nộp bị từ chối: Toàn bộ mã nguồn trong tệp ZIP không trùng khớp với Git Tree tại commit đã chọn trên repository GitHub của nhóm (Phát hiện sai lệch mã nguồn). Vui lòng đồng bộ mã nguồn trước khi nộp."*
* Với bài nộp hợp lệ, kết quả được lưu vào các cột `repoMatchStatus`, `repoMatchPercent`, `repoMatchDetails` trong bảng `submissions` của PostgreSQL để phục vụ tra cứu và phúc khảo.

---

## 4. ĐOẠN CODE TRIỂN KHAI THỰC TẾ (REFERENCE IMPLEMENTATION)

Trích xuất từ module nghiệp vụ [`apps/backend/src/modules/submissions/submission.service.ts`](file:///D:/SWP_Git/AITA-Intelligent/apps/backend/src/modules/submissions/submission.service.ts):

```typescript
// 1. Hàm tính toán mã băm Git Blob SHA-1 chuẩn Git
computeGitBlobSha(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, content])).digest('hex');
}

// 2. Hàm đối chiếu toàn bộ cây mã nguồn ZIP với Git Tree
async verifyZipAgainstRepo(
  repoUrl: string,
  commitSha: string,
  sourceFiles: Array<{ path: string; data: Buffer }>,
  entrypoint?: string
): Promise<{
  status: 'VERIFIED' | 'PARTIAL' | 'MISMATCH' | 'UNVERIFIED';
  matchPercent: number | null;
  matchedFiles: number;
  totalFiles: number;
  details: Array<{ path: string; status: string; zipBlobSha: string; gitBlobSha?: string }>;
  message: string;
}> {
  const cleanUrl = repoUrl.trim().replace(/\.git$/, '');
  const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match || !sourceFiles.length) {
    return { status: 'UNVERIFIED', matchPercent: null, matchedFiles: 0, totalFiles: sourceFiles.length, details: [], message: 'Repo không hợp lệ.' };
  }
  const [_, owner, repo] = match;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`, {
      headers: { 'User-Agent': 'AITA-Submission', Accept: 'application/vnd.github.v3+json' }
    });
    if (!res.ok) {
      return { status: 'UNVERIFIED', matchPercent: null, matchedFiles: 0, totalFiles: sourceFiles.length, details: [], message: 'Không thể truy xuất Git Tree.' };
    }

    const data: any = await res.json();
    const gitTreeMap = new Map<string, string>();
    for (const item of (data.tree || [])) {
      if (item.type === 'blob') gitTreeMap.set(item.path, item.sha);
    }

    let matchedCount = 0;
    const details = sourceFiles.map(file => {
      const zipBlobSha = this.computeGitBlobSha(file.data);
      const gitBlobSha = gitTreeMap.get(file.path);
      let fileStatus = 'NOT_IN_REPO';
      if (gitBlobSha) {
        if (gitBlobSha === zipBlobSha) {
          fileStatus = 'MATCHED';
          matchedCount++;
        } else {
          fileStatus = 'MODIFIED';
        }
      }
      return { path: file.path, status: fileStatus, zipBlobSha, gitBlobSha };
    });

    const matchPercent = Math.round((matchedCount / sourceFiles.length) * 100);
    let status: 'VERIFIED' | 'PARTIAL' | 'MISMATCH' = 'MISMATCH';
    if (matchPercent === 100) status = 'VERIFIED';
    else if (matchPercent > 0) status = 'PARTIAL';

    return { status, matchPercent, matchedFiles: matchedCount, totalFiles: sourceFiles.length, details, message: 'Đối chiếu hoàn tất.' };
  } catch (err: any) {
    return { status: 'UNVERIFIED', matchPercent: null, matchedFiles: 0, totalFiles: sourceFiles.length, details: [], message: err.message };
  }
}
```

---

## 5. CÁC BIỆN PHÁP XỬ LÝ BIÊN & ĐỘ TIN CẬY (EDGE CASES & FAULT TOLERANCE)

1. **Khác biệt ký tự xuống dòng (Line Endings CRLF vs LF):**
   * Mã nguồn nén từ Windows thường có ký tự CRLF (`\r\n`), trong khi commit trên Git Linux có thể được chuẩn hóa về LF (`\n`). 
   * Giải pháp: Hệ thống hỗ trợ so khớp dự phòng bằng cách tính lại mã băm sau khi chuyển đổi `\r\n` $\rightarrow$ `\n` nếu lần băm ban đầu bị lệch.
2. **Xử lý giới hạn GitHub API (Rate Limit 60 req/hr):**
   * Nếu máy chủ gọi vượt quá rate limit, GitHub trả về HTTP 403. Hệ thống bắt lỗi này và ghi nhận trạng thái `UNVERIFIED` thay vì làm gián đoạn nộp bài của sinh viên trong phòng thi.
3. **Chống commit ảo / sai cú pháp:**
   * Hệ thống kiểm tra biểu thức chính quy `/^[a-fA-F0-9]{7,40}$/`.
   * Bắt mã HTTP `422 Unprocessable Entity` và message `No commit found for SHA` để loại bỏ 100% commit bịa.

---

## 6. KẾT LUẬN VÀ GIÁ TRỊ THỰC TIỄN
Cơ chế đối chiếu mã nguồn ZIP với GitHub Repository là chiếc cầu nối bảo đảm tính **toàn vẹn dữ liệu** giữa hai phân hệ quan trọng nhất của AITA:
1. **Phân hệ Khảo thí (Testing & Autograding):** Đảm bảo bài nộp được chấm điểm chính là bài nộp sinh ra từ quá trình làm việc của nhóm.
2. **Phân hệ Quản trị Hợp tác (Teamwork & Git Analytics):** Đảm bảo điểm số phân bổ cho từng thành viên theo quy tắc BR-12 phản ánh đúng công sức đóng góp vào chính bộ mã nguồn đó.
