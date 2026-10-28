import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { MarkdownPreview } from '../../components/MarkdownPreview';

const toLocalInput = (date: Date = new Date()) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const POPULAR_TOPICS = [
  'Cây nhị phân tìm kiếm (BST)',
  'Thuật toán sắp xếp nhanh (QuickSort)',
  'Quy hoạch động Cái túi (0-1 Knapsack)',
  'Đồ thị Dijkstra / Đường đi ngắn nhất',
  'Ngăn xếp & Hàng đợi (Stack / Queue)',
  'Danh sách liên kết (Linked List)',
  'Kỹ thuật Hai con trỏ (Two Pointers)',
];
const CUSTOM_TOPIC_OPTION = '__CUSTOM_TOPIC__';

export const CreateExamPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [descriptionMd, setDescriptionMd] = useState('');
  const [allowedLanguage, setAllowedLanguage] = useState('PYTHON');
  const [examType, setExamType] = useState('INDIVIDUAL');
  const [maxTeamSize, setMaxTeamSize] = useState(5);
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(512);
  const [startTime, setStartTime] = useState(() => toLocalInput(new Date()));
  const [endTime, setEndTime] = useState(() => toLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));

  // Danh sách test case
  const [testCases, setTestCases] = useState<Array<{ inputData: string; expectedOutput: string; isHidden: boolean; scoreWeight: number }>>([
    { inputData: '3 5', expectedOutput: '8', isHidden: false, scoreWeight: 5.0 },
    { inputData: '10 20', expectedOutput: '30', isHidden: true, scoreWeight: 5.0 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // AI Generator States
  const [aiTopic, setAiTopic] = useState('Cây nhị phân tìm kiếm (BST)');
  const [aiDifficulty, setAiDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [aiTestCount, setAiTestCount] = useState(5);
  const [aiRequirements, setAiRequirements] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');
  const [aiStatus, setAiStatus] = useState<{ geminiAvailable: boolean; openaiAvailable: boolean } | null>(null);

  // Material / Slide Upload States for AI Analysis
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [parsingMaterial, setParsingMaterial] = useState(false);
  const [materialContent, setMaterialContent] = useState('');
  const [materialInfo, setMaterialInfo] = useState<{ filename: string; wordCount: number; slideOrPageCount?: number } | null>(null);
  const [showMaterialPreview, setShowMaterialPreview] = useState(false);
  const materialInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    apiRequest('/ai/config-status').then(res => {
      if (res.success && res.data) setAiStatus(res.data);
    });
  }, []);

  const addTestCaseRow = () => {
    setTestCases([...testCases, { inputData: '', expectedOutput: '', isHidden: false, scoreWeight: 2.0 }]);
  };

  const removeTestCaseRow = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (index: number, field: string, value: any) => {
    const updated = [...testCases];
    (updated[index] as any)[field] = value;
    setTestCases(updated);
  };

  const handleMaterialSelected = async (candidate: File | null) => {
    if (!candidate) return;
    if (candidate.size > 25 * 1024 * 1024) {
      setError('File tài liệu tối đa 25 MB.');
      return;
    }
    const allowed = /\.(pdf|pptx|docx|txt|md|markdown)$/i.test(candidate.name);
    if (!allowed) {
      setError('Chỉ hỗ trợ tệp slide bài giảng (.pptx, .pdf) hoặc tài liệu văn bản (.docx, .md, .txt).');
      return;
    }

    setMaterialFile(candidate);
    setParsingMaterial(true);
    setError('');
    setAiSuccessMessage('');

    try {
      const data = new FormData();
      data.append('materialFile', candidate);
      const res = await apiRequest('/ai/parse-material', {
        method: 'POST',
        body: data,
      });

      if (res.success && res.data) {
        setMaterialContent(res.data.text);
        setMaterialInfo({
          filename: res.data.filename,
          wordCount: res.data.wordCount,
          slideOrPageCount: res.data.slideOrPageCount,
        });
        setAiSuccessMessage(
          `Đã phân tích tài liệu "${candidate.name}" (${res.data.wordCount} từ${res.data.slideOrPageCount ? ` · ${res.data.slideOrPageCount} trang/slide` : ''}). AI sẽ dùng nội dung này để sinh đề bài bám sát bài giảng!`
        );
      } else {
        setError(res.message || 'Không thể trích xuất nội dung từ file tài liệu.');
        setMaterialFile(null);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải tài liệu lên.');
      setMaterialFile(null);
    } finally {
      setParsingMaterial(false);
    }
  };

  const handleRemoveMaterial = () => {
    setMaterialFile(null);
    setMaterialContent('');
    setMaterialInfo(null);
    setShowMaterialPreview(false);
  };

  // AI Trigger: Tự động soạn đề thi & bộ testcase kèm barem điểm
  const handleAiGenerateExam = async () => {
    if (!aiTopic.trim()) {
      setError('Vui lòng nhập hoặc chọn chủ đề bài toán để AI soạn đề.');
      return;
    }
    setGeneratingAi(true);
    setError('');
    setAiSuccessMessage('');

    try {
      const res = await apiRequest('/ai/generate-exam', {
        method: 'POST',
        body: JSON.stringify({
          topic: aiTopic,
          difficulty: aiDifficulty,
          language: allowedLanguage,
          testCaseCount: aiTestCount,
          additionalRequirements: aiRequirements.trim() || undefined,
          materialContent: materialContent.trim() || undefined,
        }),
      });

      if (res.success && res.data) {
        setTitle(res.data.title);
        setDescriptionMd(res.data.descriptionMd);
        setTimeLimitMs(res.data.timeLimitMs || 2000);
        setMemoryLimitMb(res.data.memoryLimitMb || 512);
        if (Array.isArray(res.data.testCases) && res.data.testCases.length > 0) {
          setTestCases(
            res.data.testCases.map((tc: any) => ({
              inputData: tc.inputData,
              expectedOutput: tc.expectedOutput,
              isHidden: Boolean(tc.isHidden),
              scoreWeight: tc.scoreWeight || 2.0,
            }))
          );
        }
        if (materialInfo?.filename) {
          setAiSuccessMessage(`✨ AI đã phân tích tài liệu "${materialInfo.filename}" và soạn thành công đề bài "${res.data.title}" kèm Barem điểm và ${res.data.testCases.length} test cases bám sát giáo trình!`);
        } else {
          setAiSuccessMessage(`✨ AI đã soạn thành công đề bài "${res.data.title}" kèm Barem điểm và ${res.data.testCases.length} test cases! Bạn có thể xem trước và tinh chỉnh bên dưới.`);
        }
      } else {
        setError(res.message || 'Không thể sinh đề bài bằng AI.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối khi gọi AI.');
    } finally {
      setGeneratingAi(false);
    }
  };

  // AI Trigger: Tự sinh lại Barem điểm cho đề hiện tại
  const handleAiGenerateRubric = async () => {
    if (!title.trim() && !descriptionMd.trim()) {
      setError('Vui lòng nhập tiêu đề hoặc nội dung đề bài trước khi sinh barem điểm.');
      return;
    }
    setGeneratingRubric(true);
    setError('');
    setAiSuccessMessage('');

    try {
      const res = await apiRequest('/ai/generate-rubric', {
        method: 'POST',
        body: JSON.stringify({
          title: title || aiTopic,
          descriptionMd: descriptionMd || `Bài toán ${aiTopic}`,
          language: allowedLanguage,
          maxScore: 10.0,
        }),
      });

      if (res.success && res.data) {
        // Replace existing rubric section if present or append
        let newDesc = descriptionMd;
        const rubricHeaderIndex = newDesc.indexOf('### BAREM ĐIỂM');
        if (rubricHeaderIndex !== -1) {
          newDesc = newDesc.substring(0, rubricHeaderIndex).trim() + '\n\n' + res.data.rubricMarkdown;
        } else {
          newDesc = newDesc.trim() + '\n\n' + res.data.rubricMarkdown;
        }
        setDescriptionMd(newDesc);
        setAiSuccessMessage('AI đã sinh Barem điểm chuẩn 10.0 điểm và cập nhật vào cuối nội dung đề bài!');
      } else {
        setError(res.message || 'Không thể sinh barem điểm.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối khi sinh barem.');
    } finally {
      setGeneratingRubric(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testCases.length === 0) {
      setError('Vui lòng thêm ít nhất một test case.');
      return;
    }

    if (!startTime || !endTime) {
      setError('Vui lòng chọn thời gian bắt đầu và kết thúc.');
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setError('Định dạng thời gian không hợp lệ.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setError('Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.');
      return;
    }

    setSubmitting(true);
    setError('');

    const formattedTestCases = testCases.map((tc, idx) => ({
      ...tc,
      orderIndex: idx + 1,
    }));

    const res = await apiRequest('/exams', {
      method: 'POST',
      body: JSON.stringify({
        classId,
        title,
        descriptionMd,
        allowedLanguage,
        examType,
        maxTeamSize: examType === 'GROUP' ? Number(maxTeamSize) : undefined,
        timeLimitMs: Number(timeLimitMs),
        memoryLimitMb: Number(memoryLimitMb),
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        testCases: formattedTestCases,
      }),
    });

    setSubmitting(false);
    if (res.success) {
      navigate('/lecturer');
    } else {
      setError(res.message || 'Lỗi khi tạo đề thi');
    }
  };

  return (
    <div className="container page-exam-create" style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/lecturer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Quay lại Dashboard</Link>
      </div>

      {/* SECTION: AI EXAM & RUBRIC GENERATOR HUB */}
      <div className="ai-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                AI Soạn Đề Bài & Tự Sinh Barem Điểm
              </h3>
            </div>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
              Tự động hóa toàn diện: Nhập chủ đề, AI sẽ tạo đề bài Markdown chi tiết, sinh bảng Barem điểm 10.0 và thiết lập sẵn bộ test cases chuẩn xác.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {aiStatus?.geminiAvailable ? (
                <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '0.35rem' }}/>Đang chạy: Google Gemini API (Online)
                </span>
              ) : aiStatus?.openaiAvailable ? (
                <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '0.35rem' }}/>Đang chạy: OpenAI GPT-4o API (Online)
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', marginRight: '0.35rem' }}/>Local Fallback Engine (Offline) · Điền GEMINI_API_KEY vào apps/backend/.env để dùng Gemini
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form controls for AI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label htmlFor="ai-topic" style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Chủ đề bài toán</label>
            <select
              id="ai-topic"
              className="form-control"
              value={POPULAR_TOPICS.includes(aiTopic) ? aiTopic : CUSTOM_TOPIC_OPTION}
              onChange={(e) => setAiTopic(e.target.value === CUSTOM_TOPIC_OPTION ? '' : e.target.value)}
            >
              {POPULAR_TOPICS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
              <option value={CUSTOM_TOPIC_OPTION}>Chủ đề khác...</option>
            </select>
            {!POPULAR_TOPICS.includes(aiTopic) && (
              <input
                type="text"
                className="form-control"
                style={{ marginTop: '0.5rem' }}
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Nhập chủ đề tùy ý..."
                aria-label="Nhập chủ đề bài toán khác"
              />
            )}
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Độ khó</label>
            <select
              className="form-control"
              value={aiDifficulty}
              onChange={(e) => setAiDifficulty(e.target.value as any)}
            >
              <option value="EASY">DỄ (Easy)</option>
              <option value="MEDIUM">TRUNG BÌNH (Medium)</option>
              <option value="HARD">KHÓ (Hard)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Số lượng test case</label>
            <select
              className="form-control"
              value={aiTestCount}
              onChange={(e) => setAiTestCount(Number(e.target.value))}
            >
              <option value={3}>3 test cases (nhanh)</option>
              <option value={5}>5 test cases (chuẩn FPT)</option>
              <option value={7}>7 test cases (toàn diện)</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
            Yêu cầu bổ sung cho AI (tùy chọn)
          </label>
          <input
            type="text"
            className="form-control"
            value={aiRequirements}
            onChange={(e) => setAiRequirements(e.target.value)}
            placeholder="Ví dụ: Cần bối cảnh logistics thực tế, yêu cầu xử lý mảng rỗng, độ phức tạp O(N log N)..."
          />
        </div>

        {/* MATERIAL / SLIDE UPLOAD SECTION */}
        <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: 'var(--surface-inset)', borderRadius: 'var(--radius-control)', border: '1px solid var(--border)' }}>
          <input
            type="file"
            ref={materialInputRef}
            accept=".pdf,.pptx,.docx,.txt,.md,.markdown"
            style={{ display: 'none' }}
            disabled={generatingAi || parsingMaterial}
            onChange={(e) => handleMaterialSelected(e.target.files?.[0] || null)}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Tài liệu hoặc Slide bài giảng đính kèm (Tùy chọn)
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Hỗ trợ: .pptx, .pdf, .docx, .md, .txt (tối đa 25 MB)
            </span>
          </div>

          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Tải lên slide bài giảng (.pptx) hoặc tài liệu môn học (.pdf/.docx). AI sẽ đọc hiểu cấu trúc slide để thiết kế bài thi, câu hỏi và test case bám sát trực tiếp kiến thức trong bài giảng.
          </p>

          {parsingMaterial ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-control)', color: '#93c5fd', fontSize: '0.85rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span>Đang đọc và phân tích cấu trúc slide / tài liệu bài giảng...</span>
            </div>
          ) : !materialInfo ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={generatingAi}
              onClick={() => materialInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Tải lên Slide hoặc Tài liệu bài giảng
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.55rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <strong style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>{materialInfo.filename}</strong>
                  <span style={{ fontSize: '0.78rem', color: '#6ee7b7' }}>
                    ({materialInfo.wordCount} từ{materialInfo.slideOrPageCount ? ` · ${materialInfo.slideOrPageCount} trang/slide` : ''})
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowMaterialPreview(!showMaterialPreview)}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    {showMaterialPreview ? 'Thu gọn' : 'Xem nội dung'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost-danger btn-sm"
                    onClick={handleRemoveMaterial}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Gỡ bỏ
                  </button>
                </div>
              </div>

              {showMaterialPreview && (
                <div style={{ marginTop: '0.6rem' }}>
                  <textarea
                    className="form-control"
                    rows={6}
                    value={materialContent}
                    onChange={(e) => setMaterialContent(e.target.value)}
                    placeholder="Nội dung tài liệu trích xuất..."
                    style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                    Bạn có thể chỉnh sửa hoặc bổ sung các lưu ý trọng tâm để AI tập trung vào phần kiến thức mong muốn.
                  </small>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={generatingAi}
            onClick={handleAiGenerateExam}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            {generatingAi ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                AI đang soạn đề bài & test cases...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                {materialInfo ? 'Phân tích tài liệu & Soạn đề bài' : 'AI Soạn Đề Bài & Sinh Barem'}
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={generatingRubric}
            onClick={handleAiGenerateRubric}
          >
            {generatingRubric ? ' AI đang sinh barem...' : ' AI Tự Sinh Lại Barem Điểm'}
          </button>
        </div>

        {aiSuccessMessage && (
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginTop: '1rem', fontSize: '0.9rem' }}>
            {aiSuccessMessage}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Chi tiết đề thi & Cấu hình kiểm thử</h2>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tiêu đề bài thi</label>
            <input
              type="text"
              className="form-control"
              placeholder="Bài tập 1: Tính tổng 2 số nguyên A + B"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="exam-description">Mô tả đề bài & Barem điểm (Markdown)</label>
            <div className="markdown-editor-preview">
              <div>
                <span className="markdown-panel-title">Nội dung Markdown</span>
                <textarea
                  id="exam-description"
                  className="form-control markdown-editor"
                  rows={14}
                  placeholder="# Mô tả bài toán\nCho hai số nguyên a và b trên cùng một dòng.\n\nIn ra tổng a + b.\n\n### BAREM ĐIỂM (10 ĐIỂM)..."
                  value={descriptionMd}
                  onChange={(e) => setDescriptionMd(e.target.value)}
                  required
                />
              </div>
              <section aria-label="Xem trước đề bài">
                <span className="markdown-panel-title">Xem trước hiển thị</span>
                <MarkdownPreview content={descriptionMd} />
              </section>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Hình thức bài thi</label>
              <select className="form-control" value={examType} onChange={(e) => setExamType(e.target.value)}>
                <option value="INDIVIDUAL">Cá nhân (Student)</option>
                <option value="GROUP">Theo nhóm (Team)</option>
              </select>
            </div>
            {examType === 'GROUP' && (
              <div className="form-group">
                <label>Số thành viên tối đa / nhóm</label>
                <input
                  type="number"
                  className="form-control"
                  value={maxTeamSize}
                  min={2}
                  max={20}
                  onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                />
              </div>
            )}
            <div className="form-group">
              <label>Ngôn ngữ quy định</label>
              <select className="form-control" value={allowedLanguage} onChange={(e) => setAllowedLanguage(e.target.value)}>
                <option value="PYTHON">Python 3</option>
                <option value="JAVA">Java JDK 17</option>
                <option value="CSHARP">C# (.NET 8)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Thời gian chạy tối đa (ms)</label>
              <input
                type="number"
                className="form-control"
                value={timeLimitMs}
                onChange={(e) => setTimeLimitMs(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Bộ nhớ tối đa (MiB)</label>
              <input
                type="number"
                className="form-control"
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label htmlFor="exam-start-time">Thời gian bắt đầu</label>
              <input
                id="exam-start-time"
                type="datetime-local"
                className="form-control"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="exam-end-time">Thời gian kết thúc (Hạn nộp bài)</label>
              <input
                id="exam-end-time"
                type="datetime-local"
                className="form-control"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <hr style={{ borderColor: 'var(--border)', margin: '1.5rem 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h4 style={{ margin: 0 }}>Bộ test case chấm điểm tự động</h4>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Tổng điểm test cases: {testCases.reduce((sum, tc) => sum + (tc.scoreWeight || 0), 0).toFixed(1)} điểm
              </p>
            </div>
            <button type="button" onClick={addTestCaseRow} className="btn btn-secondary">
              + Thêm test case
            </button>
          </div>

          {testCases.map((tc, idx) => (
            <div key={idx} className="exam-test-case" style={{ borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: tc.isHidden ? '#f59e0b' : '#38bdf8' }}>
                  Test case #{idx + 1} {tc.isHidden ? '(Test Ẩn)' : '(Công khai)'}
                </span>
                {testCases.length > 1 && (
                  <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => removeTestCaseRow(idx)}>
                    Xóa
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dữ liệu đầu vào (StdIn)</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="3 5"
                    value={tc.inputData}
                    onChange={(e) => updateTestCase(idx, 'inputData', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Kết quả mong đợi (StdOut)</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="8"
                    value={tc.expectedOutput}
                    onChange={(e) => updateTestCase(idx, 'expectedOutput', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={tc.isHidden}
                    onChange={(e) => updateTestCase(idx, 'isHidden', e.target.checked)}
                  />
                  Test case ẩn (chỉ dùng để chấm điểm, không hiển thị cho sinh viên)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Trọng số điểm:</span>
                  <input
                    type="number"
                    step="0.5"
                    style={{ width: '80px' }}
                    className="form-control"
                    value={tc.scoreWeight}
                    onChange={(e) => updateTestCase(idx, 'scoreWeight', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.85rem', fontSize: '1rem' }} disabled={submitting}>
            {submitting ? 'Đang lưu đề thi...' : ' Lưu & Kích hoạt Bài Thi'}
          </button>
        </form>
      </div>
    </div>
  );
};
