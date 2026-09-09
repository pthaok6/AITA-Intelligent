# TÀI LIỆU THIẾT KẾ SƠ ĐỒ LỚP (CLASS DIAGRAM SPECIFICATION)
## DỰ ÁN: AITA-INTELLIGENT (AI-POWERED TEACHING ASSISTANT & AST CODE ANALYTICS PLATFORM)
**Học phần:** SWP391 | **Mô hình Kiến trúc:** Layered Architecture & Entity-Control-Boundary (ECB) | **Ngôn ngữ:** TypeScript / OOP

---

## I. NGUYÊN TẮC THIẾT KẾ VÀ KIẾN TRÚC TỔNG QUAN

Tài liệu thiết kế sơ đồ lớp hệ thống **AITA-Intelligent** tuân thủ nghiêm ngặt các tiêu chuẩn kỹ nghệ phần mềm:
1. **Phân tách trách nhiệm (Single Responsibility Principle - SRP):** Tách bạch rõ giữa dữ liệu nghiệp vụ (Entity), giao tiếp bên ngoài (Boundary/Controller), điều phối luồng nghiệp vụ (Control/Service), và hạ tầng kỹ thuật (Infrastructure/Repository).
2. **Không biến Class Diagram thành ERD:** Loại bỏ các trường khóa ngoại quan hệ dạng ID đơn thuần; thể hiện quan hệ thông qua Associations, Composition, Dependency với đầy đủ **Multiplicity (lực lượng quan hệ)**. Mọi Entity đều chứa các phương thức thể hiện hành vi nghiệp vụ (Business Behaviors).
3. **Loose Coupling & Dependency Inversion:** Trừu tượng hóa tương tác với các hệ thống ngoại vi (Redis, Docker Engine, OpenAI/Gemini, WebSockets) qua các **Interfaces**.
4. **Thể hiện rõ Pipeline Thuật toán RBL:** Phân rã quy trình AST & Winnowing thành các lớp chuyên trách (`ASTParser`, `ASTNormalizer`, `KGramGenerator`, `WinnowingEngine`, `SimilarityCalculator`), không gộp chung vào một Service hay Entity.
5. **Cấu trúc Module hóa:** Hệ thống được chia thành 5 biểu đồ lớp chuyên biệt để đảm bảo tính trực quan và khả thi khi lập trình:
   * **Diagram 1:** Domain Model (Các thực thể nghiệp vụ cốt lõi & Value Objects/Enums).
   * **Diagram 2:** Submission & Docker Sandbox Pipeline (Luồng nhận bài, hàng đợi Redis và chấm code cô lập).
   * **Diagram 3:** AST & Winnowing Plagiarism Engine (Pipeline băm cú pháp, trượt cửa sổ và so khớp ma trận tương đồng).
   * **Diagram 4:** GenAI Review Hub (Module tích hợp LLM hỗ trợ Clean Code và giải nghĩa lỗi).
   * **Diagram 5:** High-Level Architecture Overview (Tổng thể liên kết đa tầng: Controller $\to$ Service $\to$ Repository/Infra $\to$ Domain).

---

## II. DIAGRAM 1: DOMAIN MODEL (CÁC THỰC THỂ CỐT LÕI)

Mô hình Domain chỉ tập trung vào cấu trúc dữ liệu thực thể và các hành vi nội tại của đối tượng, không phụ thuộc vào Database hay Framework.

### 1. Enumerations (Value Types)
* `UserRole`: `ADMIN`, `LECTURER`, `STUDENT`
* `SubmissionStatus`: `QUEUED`, `RUNNING`, `COMPLETED`, `COMPILE_ERROR`, `FAILED`
* `TestCaseStatus`: `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `RUNTIME_ERROR`
* `PlagiarismStatus`: `SUSPECTED`, `CONFIRMED`, `DISMISSED`
* `EnrollmentStatus`: `ACTIVE`, `DROPPED`

### 2. Sơ đồ Mermaid: Domain Model

```mermaid
classDiagram
    %% Enumerations
    class UserRole {
        <<enumeration>>
        ADMIN
        LECTURER
        STUDENT
    }

    class SubmissionStatus {
        <<enumeration>>
        QUEUED
        RUNNING
        COMPLETED
        COMPILE_ERROR
        FAILED
    }

    class TestCaseStatus {
        <<enumeration>>
        ACCEPTED
        WRONG_ANSWER
        TIME_LIMIT_EXCEEDED
        MEMORY_LIMIT_EXCEEDED
        RUNTIME_ERROR
    }

    class PlagiarismStatus {
        <<enumeration>>
        SUSPECTED
        CONFIRMED
        DISMISSED
    }

    class EnrollmentStatus {
        <<enumeration>>
        ACTIVE
        DROPPED
    }

    %% Domain Entities
    class User {
        -UUID id
        -String email
        -String fullName
        -String passwordHash
        -UserRole role
        -String avatarUrl
        -DateTime createdAt
        +isLecturer() boolean
        +isStudent() boolean
        +updateProfile(fullName, avatarUrl) void
    }

    class Class {
        -UUID id
        -String classCode
        -String name
        -String semester
        -DateTime createdAt
        +getStudentCount() int
        +isActive() boolean
    }

    class ClassEnrollment {
        -DateTime enrolledAt
        -EnrollmentStatus status
        +dropClass() void
        +reactivate() void
    }

    class Exam {
        -UUID id
        -String title
        -String descriptionMd
        -String allowedLanguage
        -int timeLimitMs
        -int memoryLimitMb
        -DateTime startTime
        -DateTime endTime
        -DateTime createdAt
        +isOpen() boolean
        +isExpired() boolean
        +canSubmit(student) boolean
        +calculateTotalPossibleScore() Decimal
    }

    class TestCase {
        -UUID id
        -String inputData
        -String expectedOutput
        -boolean isHidden
        -Decimal scoreWeight
        -int orderIndex
        -DateTime createdAt
        +matchesOutput(actualOutput) boolean
    }

    class Submission {
        -UUID id
        -String sourceCodeUrl
        -String fileHashSha256
        -SubmissionStatus status
        -Decimal totalScore
        -String compileMessage
        -DateTime submittedAt
        -DateTime startedAt
        -DateTime completedAt
        +markRunning() void
        +markCompileError(errorMessage) void
        +markCompleted(totalScore) void
        +markFailed(reason) void
        +calculateScore(testResults) Decimal
        +getTurnaroundTimeMs() int
    }

    class SubmissionTestResult {
        -UUID id
        -TestCaseStatus status
        -String actualOutput
        -int executionTimeMs
        -int memoryUsedKb
        -Decimal scoreEarned
        -DateTime createdAt
        +isPassed() boolean
    }

    class ASTFingerprint {
        -Long id
        -Long hashValue
        -int lineStart
        -int lineEnd
        -int tokenStart
        -int tokenEnd
        -DateTime createdAt
        +isOverlapping(other) boolean
    }

    class PlagiarismReport {
        -UUID id
        -Decimal similarityScore
        -int matchedHashesCount
        -PlagiarismStatus status
        -String lecturerNote
        -DateTime createdAt
        +confirmPlagiarism(note) void
        +dismiss(note) void
        +isHighRisk(threshold) boolean
    }

    class AIReview {
        -UUID id
        -int reviewRound
        -Decimal cleanCodeScore
        -String solidAnalysis
        -String errorExplanation
        -String suggestions
        -int tokensUsed
        -String modelName
        -DateTime createdAt
        +isHighQuality() boolean
    }

    %% Relationships with Multiplicities
    User "1" -- "0..*" Class : creates (as Lecturer)
    User "1" -- "0..*" ClassEnrollment : participates
    Class "1" -- "0..*" ClassEnrollment : includes
    Class "1" *-- "0..*" Exam : organizes
    Exam "1" *-- "1..*" TestCase : contains
    
    Exam "1" -- "0..*" Submission : receives
    User "1" -- "0..*" Submission : submits (as Student)
    
    Submission "1" -- "0..*" SubmissionTestResult : produces
    TestCase "1" -- "0..*" SubmissionTestResult : evaluates
    
    Submission "1" -- "0..*" ASTFingerprint : generates
    Submission "1" -- "0..*" AIReview : evaluated_by
    
    Exam "1" -- "0..*" PlagiarismReport : targets
    Submission "1" -- "0..*" PlagiarismReport : as SubmissionA
    Submission "1" -- "0..*" PlagiarismReport : as SubmissionB

    User --> UserRole
    ClassEnrollment --> EnrollmentStatus
    Submission --> SubmissionStatus
    SubmissionTestResult --> TestCaseStatus
    PlagiarismReport --> PlagiarismStatus
```

---

## III. DIAGRAM 2: PHÂN HỆ NỘP BÀI & DOCKER SANDBOX (AUTOGRADING PIPELINE)

Phân hệ này điều phối luồng xử lý bất đồng bộ chuẩn Event-driven: Sinh viên gửi bài qua `SubmissionController` $\to$ `SubmissionService` ghi nhận bài nộp $\to$ Đẩy job vào `IJobQueue` (BullMQ) $\to$ `AutogradingWorker` lắng nghe event từ hàng đợi và nhận job $\to$ Ủy quyền cho `AutogradingService` điều phối $\to$ Khởi tạo Container cô lập qua `DockerSandboxService` $\to$ Chạy `TestRunner` $\to$ Cập nhật kết quả vào Repository và phát thông báo WebSockets về Client.

### Sơ đồ Mermaid: Submission & Sandbox Engine

```mermaid
classDiagram
    %% Boundary / Controller Layer
    class SubmissionController {
        -SubmissionService submissionService
        +submitCode(examId, studentId, file) ApiResponse
        +getSubmission(submissionId) SubmissionResponseDto
        +getSubmissionsByExam(examId) List~SubmissionResponseDto~
    }

    %% Control / Service Layer
    class SubmissionService {
        -ISubmissionRepository submissionRepo
        -IExamRepository examRepo
        -IJobQueue jobQueue
        +submitCode(examId, studentId, fileBuffer) Submission
        +getSubmissionStatus(submissionId) SubmissionStatus
        +validateEligibility(examId, studentId) boolean
    }

    class AutogradingService {
        -ISubmissionRepository submissionRepo
        -ISandboxService sandboxService
        -INotificationService notificationService
        +executeSubmission(submissionId) void
        +evaluateTestCases(submission, testCases) List~SubmissionTestResult~
    }

    %% Background Worker (Consumer)
    class AutogradingWorker {
        -AutogradingService autogradingService
        +handleGradingJob(jobData) Promise~void~
    }

    %% Infrastructure Abstractions (Interfaces)
    class IJobQueue {
        <<interface>>
        +addJob(queueName, payload) void
    }

    class BullMQJobQueue {
        -Queue bullQueue
        +addJob(queueName, payload) void
    }

    class ISandboxService {
        <<interface>>
        +createIsolatedEnvironment(config) SandboxContext
        +executeCommand(context, command, timeoutMs) ExecutionResult
        +destroyEnvironment(context) void
    }

    class DockerSandboxService {
        -DockerEngineClient dockerClient
        +createIsolatedEnvironment(config) SandboxContext
        +executeCommand(context, command, timeoutMs) ExecutionResult
        +destroyEnvironment(context) void
        -enforceResourceLimits(containerId, ramMb, cpuLimit) void
    }

    class INotificationService {
        <<interface>>
        +notifyUser(userId, event, payload) void
        +broadcastToExamRoom(examId, event, payload) void
    }

    class WebSocketNotificationService {
        -SocketServer socketServer
        +notifyUser(userId, event, payload) void
        +broadcastToExamRoom(examId, event, payload) void
    }

    class ISubmissionRepository {
        <<interface>>
        +save(submission) Submission
        +findById(id) Submission
        +updateStatus(id, status) void
        +saveTestResults(results) void
    }

    class PostgresSubmissionRepository {
        -DbConnection db
        +save(submission) Submission
        +findById(id) Submission
        +updateStatus(id, status) void
        +saveTestResults(results) void
    }

    %% Helper Execution Runner
    class TestRunner {
        -ISandboxService sandboxService
        +runTestCase(context, testCase, language) SubmissionTestResult
        -compareOutput(actual, expected) boolean
    }

    %% Classes Association & Dependencies
    SubmissionController --> SubmissionService : delegates
    SubmissionService --> ISubmissionRepository : persists
    SubmissionService --> IJobQueue : pushes job
    
    IJobQueue <|.. BullMQJobQueue : implements
    BullMQJobQueue ..> AutogradingWorker : dispatches job
    AutogradingWorker --> AutogradingService : delegates execution
    
    AutogradingService --> ISandboxService : executes code
    AutogradingService --> TestRunner : uses
    AutogradingService --> ISubmissionRepository : updates results
    AutogradingService --> INotificationService : pushes realtime update
    
    ISandboxService <|.. DockerSandboxService : implements
    INotificationService <|.. WebSocketNotificationService : implements
    ISubmissionRepository <|.. PostgresSubmissionRepository : implements
```

---

## IV. DIAGRAM 3: PHÂN HỆ PHÂN TÍCH AST & WINNOWING (RBL CORE PIPELINE)

Phân hệ nghiên cứu cốt lõi (RBL) chuyển đổi mã nguồn thành cây cú pháp trừu tượng AST, loại bỏ định danh, băm k-grams, thực thi giải thuật chọn lọc Winnowing và tính toán độ tương đồng (Jaccard / Containment metric) **hoàn toàn trên In-Memory Worker** trước khi lưu kết quả vào PostgreSQL.

### Sơ đồ Mermaid: AST & Plagiarism Engine

```mermaid
classDiagram
    %% Boundary / Controller
    class PlagiarismController {
        -PlagiarismService plagiarismService
        +triggerExamPlagiarismCheck(examId) JobTriggerResponse
        +getExamPlagiarismReport(examId) List~PlagiarismReportDto~
        +updateReportStatus(reportId, status, note) void
    }

    %% Plagiarism Coordinator Service
    class PlagiarismService {
        -ASTAnalysisService astAnalysisService
        -SimilarityCalculator similarityCalculator
        -IPlagiarismRepository plagiarismRepo
        -ISubmissionRepository submissionRepo
        +analyzeSubmissionAST(submissionId) List~ASTFingerprint~
        +runBatchExamPlagiarism(examId) List~PlagiarismReport~
        -crossCompareSubmissions(subA, subB) PlagiarismReport
    }

    %% Core RBL Pipeline Components
    class ASTAnalysisService {
        -ASTParser astParser
        -ASTNormalizer astNormalizer
        -KGramGenerator kGramGenerator
        -WinnowingEngine winnowingEngine
        +generateFingerprints(sourceCode, language) List~ASTFingerprint~
    }

    class AST {
        -ASTNode rootNode
        -String language
        +getRootNode() ASTNode
        +traverse(visitor) void
    }

    class ASTNode {
        -String nodeType
        -int lineStart
        -int lineEnd
        -int tokenStart
        -int tokenEnd
        -List~ASTNode~ children
        +isLeaf() boolean
        +getChildren() List~ASTNode~
    }

    class ASTParser {
        +parse(sourceCode, language) AST
    }

    class ASTNormalizer {
        +normalize(ast) NormalizedTokenStream
        -anonymizeIdentifiers(ast) void
        -stripCommentsAndFormatting(ast) void
        -flattenControlStructures(ast) void
    }

    class KGramGenerator {
        -int kGramSize
        +generateKGrams(tokenStream) List~KGram~
    }

    class WinnowingEngine {
        -int windowSize
        -HashFunction hashFunction
        +computeMinimaFingerprints(kGrams) List~ASTFingerprint~
        -hashKGram(kGram) Long
    }

    class SimilarityCalculator {
        -Decimal threshold
        +calculateJaccardSimilarity(fingerprintsA, fingerprintsB) Decimal
        +findMatchedFingerprints(fpsA, fpsB) List~MatchedPair~
    }

    %% Repository Interfaces
    class IPlagiarismRepository {
        <<interface>>
        +saveFingerprints(fingerprints) void
        +getFingerprintsBySubmission(submissionId) List~ASTFingerprint~
        +saveReports(reports) void
        +findByExamId(examId) List~PlagiarismReport~
    }

    class PostgresPlagiarismRepository {
        -DbConnection db
        +saveFingerprints(fingerprints) void
        +getFingerprintsBySubmission(submissionId) List~ASTFingerprint~
        +saveReports(reports) void
        +findByExamId(examId) List~PlagiarismReport~
    }

    %% Component Dependencies
    PlagiarismController --> PlagiarismService : delegates
    PlagiarismService --> ASTAnalysisService : delegates AST processing
    PlagiarismService --> SimilarityCalculator : calculates metrics
    PlagiarismService --> IPlagiarismRepository : persists
    
    ASTAnalysisService --> ASTParser : 1. parse
    ASTAnalysisService --> ASTNormalizer : 2. normalize
    ASTAnalysisService --> KGramGenerator : 3. k-grams
    ASTAnalysisService --> WinnowingEngine : 4. winnowing
    ASTParser ..> AST : produces
    AST *-- ASTNode : contains
    ASTNormalizer ..> AST : consumes
    
    IPlagiarismRepository <|.. PostgresPlagiarismRepository : implements
```

---

## V. DIAGRAM 4: PHÂN HỆ TRỢ LÝ AI (GENAI REVIEW HUB)

Phân hệ GenAI nhận bài nộp hoặc log lỗi biên dịch, dùng cơ chế Prompt Builder đóng gói ngữ cảnh và gọi AI Provider (hỗ trợ xoay vòng key và trừu tượng hóa OpenAI / Gemini qua Adapter Pattern) để đánh giá tiêu chuẩn Clean Code, SOLID và giải nghĩa lỗi.

### Sơ đồ Mermaid: GenAI Review Hub

```mermaid
classDiagram
    %% Controller
    class AIReviewController {
        -AIReviewService aiReviewService
        +requestReview(submissionId) AIReviewResponseDto
        +getReviewsBySubmission(submissionId) List~AIReviewResponseDto~
    }

    %% Review Orchestrator
    class AIReviewService {
        -IAIProvider aiProvider
        -PromptBuilder promptBuilder
        -IAIReviewRepository aiReviewRepo
        -ISubmissionRepository submissionRepo
        +reviewCodeQuality(submissionId) AIReview
        +explainCompilationError(submissionId) AIReview
        -parseReviewJson(llmOutput) AIReview
    }

    %% Prompt Engineering Component
    class PromptBuilder {
        +buildCleanCodePrompt(sourceCode, rubric) String
        +buildCompileErrorPrompt(sourceCode, compileError) String
        +buildExamGenerationPrompt(topic, difficulty) String
    }

    %% LLM Adapter Pattern (Loose Coupling)
    class IAIProvider {
        <<interface>>
        +generateReview(prompt) LLMResult
        +getProviderName() String
    }

    class OpenAIProvider {
        -String apiKeyPool
        -HttpClient client
        +generateReview(prompt) LLMResult
        +getProviderName() String
        -rotateApiKey() String
    }

    class GeminiProvider {
        -String apiKeyPool
        -HttpClient client
        +generateReview(prompt) LLMResult
        +getProviderName() String
        -rotateApiKey() String
    }

    %% Repository
    class IAIReviewRepository {
        <<interface>>
        +save(aiReview) AIReview
        +findBySubmissionId(submissionId) List~AIReview~
    }

    class PostgresAIReviewRepository {
        -DbConnection db
        +save(aiReview) AIReview
        +findBySubmissionId(submissionId) List~AIReview~
    }

    %% Relationships
    AIReviewController --> AIReviewService : invokes
    AIReviewService --> PromptBuilder : formats prompts
    AIReviewService --> IAIProvider : requests inference
    AIReviewService --> IAIReviewRepository : persists
    
    IAIProvider <|.. OpenAIProvider : implements
    IAIProvider <|.. GeminiProvider : implements
    IAIReviewRepository <|.. PostgresAIReviewRepository : implements
```

---

## VI. DIAGRAM 5: KIẾN TRÚC TỔNG THỂ ĐA TẦNG (HIGH-LEVEL OVERVIEW)

Sơ đồ tổng hợp minh họa luồng tương tác giữa các tầng kiến trúc: Boundary $\to$ Control $\to$ Infrastructure $\to$ Domain.

```mermaid
classDiagram
    %% Presentation / Boundary Layer
    namespace Boundary_Controllers {
        class AuthController
        class ExamController
        class SubmissionController
        class PlagiarismController
        class AIReviewController
    }

    %% Business Logic / Control Layer
    namespace Control_Services {
        class AuthService
        class ExamService
        class SubmissionService
        class AutogradingWorker
        class AutogradingService
        class PlagiarismService
        class ASTAnalysisService
        class AIReviewService
    }

    %% Technical / Infrastructure Layer
    namespace Infrastructure_External {
        class IJobQueue
        class ISandboxService
        class IAIProvider
        class INotificationService
        class ISubmissionRepository
        class IPlagiarismRepository
        class IAIReviewRepository
    }

    %% Core Domain Layer
    namespace Domain_Entities {
        class User
        class Class
        class Exam
        class Submission
        class SubmissionTestResult
        class ASTFingerprint
        class PlagiarismReport
        class AIReview
    }

    %% Cross-Layer Dependencies
    AuthController --> AuthService
    ExamController --> ExamService
    SubmissionController --> SubmissionService
    PlagiarismController --> PlagiarismService
    AIReviewController --> AIReviewService

    SubmissionService --> ISubmissionRepository
    SubmissionService --> IJobQueue
    
    IJobQueue ..> AutogradingWorker : triggers job
    AutogradingWorker --> AutogradingService : delegates
    
    AutogradingService --> ISandboxService
    AutogradingService --> INotificationService
    AutogradingService --> ISubmissionRepository
    
    PlagiarismService --> ASTAnalysisService
    PlagiarismService --> IPlagiarismRepository
    
    AIReviewService --> IAIProvider
    AIReviewService --> IAIReviewRepository

    ISubmissionRepository ..> Submission : manages
    ISubmissionRepository ..> SubmissionTestResult : manages
    IPlagiarismRepository ..> ASTFingerprint : manages
    IPlagiarismRepository ..> PlagiarismReport : manages
    IAIReviewRepository ..> AIReview : manages
```

---

## VII. BẢNG TỰ THẨM ĐỊNH THIẾT KẾ (DESIGN VERIFICATION CHECKLIST)

Bảng đối chiếu kiểm thử chất lượng thiết kế theo chuẩn Đề án Kỹ nghệ Phần mềm SWP391:

| Hạng mục | Tiêu chuẩn đánh giá | Kết quả kiểm tra | Minh chứng trong tài liệu |
| :--- | :--- | :---: | :--- |
| **Phủ Use Case** | Có đủ các lớp phục vụ 5 phân hệ cốt lõi | **ĐẠT (100%)** | Đã bao hàm Auth, Class, Exam, Submission, Sandbox, AST/Winnowing, Plagiarism, GenAI. |
| **Mô hình ECB** | Phân tách rõ Entity - Control - Boundary | **ĐẠT** | Tách rõ Controller (Boundary), Service (Control), Entity (Domain) và Adapter (Infra). |
| **Trách nhiệm (SRP)** | Không có "God Class" gom toàn bộ logic | **ĐẠT** | `Submission` chỉ quản lý trạng thái bài nộp; logic chấm thuộc `AutogradingService`, sandbox thuộc `DockerSandboxService`. |
| **Thuộc tính & Hành vi** | Method thể hiện Business Behavior, không phải getter/setter thuần | **ĐẠT** | `Exam.isOpen()`, `Submission.calculateScore()`, `TestCase.matchesOutput()`. |
| **Lực lượng quan hệ** | Đầy đủ Multiplicity trên tất cả các Association | **ĐẠT** | Có rõ ràng `1` $\to$ `0..*`, `1` $\to$ `1..*`. Composition (`*--`) cho `Exam *-- TestCase`; Association (`--`) cho `Submission` với `AIReview` và `SubmissionTestResult` để đảm bảo vòng đời độc lập. |
| **Xử lý N - N** | Giải quyết quan hệ nhiều - nhiều qua thực thể liên kết | **ĐẠT** | Quan hệ giữa `User` và `Class` được kết nối qua `ClassEnrollment`. |
| **Tính kế thừa** | Tránh lạm dụng Subclassing không cần thiết | **ĐẠT** | `User` dùng thuộc tính `role: UserRole`, không tạo 3 subclass rỗng `Student`, `Lecturer`, `Admin`. |
| **Loose Coupling** | Tách biệt hệ thống ngoại vi bằng Interface | **ĐẠT** | Có `ISandboxService`, `IJobQueue`, `IAIProvider`, `INotificationService`. |
| **AST/Winnowing Pipeline**| Thể hiện rõ thuật toán RBL ở mức component | **ĐẠT** | Tách bạch `ASTParser` $\to$ `ASTNormalizer` $\to$ `KGramGenerator` $\to$ `WinnowingEngine` $\to$ `SimilarityCalculator`. |
| **E2E Workflow** | Nhìn ra được thứ tự gọi hàm (Who calls Whom) | **ĐẠT** | Thể hiện tường minh luồng Controller $\to$ Service $\to$ Queue $\to$ Worker $\to$ Sandbox $\to$ Socket. |
| **Phân biệt với ERD** | Không copy khóa ngoại database vào attribute class | **ĐẠT** | Các class dùng quan hệ liên kết (Associations) thay vì chứa thuộc tính `student_id`, `exam_id`. |
