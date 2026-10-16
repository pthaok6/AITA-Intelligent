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
        setAiSuccessMessage(`✨ AI đã soạn thành công đề bài "${res.data.title}" kèm Barem điểm và ${res.data.testCases.length} test cases! Bạn có thể xem trước và tinh chỉnh bên dưới.`);
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
        setAiSuccessMessage('📋 AI đã sinh Barem điểm chuẩn 10.0 điểm và cập nhật vào cuối nội dung đề bài!');
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
        <Link to="/lecturer">← Quay lại Dashboard</Link>
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
                  🟢 Đang chạy LLM thật: Google Gemini API (Online)
                </span>
              ) : aiStatus?.openaiAvailable ? (
                <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 600 }}>
                  🟢 Đang chạy LLM thật: OpenAI GPT-4o API (Online)
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                  🟠 Chế độ: Local Fallback Engine (Offline) · Để gọi Gemini trực tiếp, điền GEMINI_API_KEY vào apps/backend/.env
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

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={generatingAi}
            onClick={handleAiGenerateExam}
          >
            {generatingAi ? ' AI đang soạn đề bài & test case...' : ' AI Soạn Đề Bài & Sinh Barem'}
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
