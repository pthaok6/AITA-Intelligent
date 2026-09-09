import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export const ExamTakePage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [exam, setExam] = useState<any>(null);
  const [sourceCode, setSourceCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExam = async () => {
      setLoading(true);
      const res = await apiRequest(`/exams/${examId}`);
      if (res.success && res.data) {
        setExam(res.data);
        // Default template
        if (res.data.allowedLanguage === 'PYTHON') {
          setSourceCode('# Viết code giải bài toán tại đây:\na, b = map(int, input().split())\nprint(a + b)\n');
        } else {
          setSourceCode('// Viết code giải bài toán tại đây\n');
        }
      }
      setLoading(false);
    };
    fetchExam();
  }, [examId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceCode.trim()) {
      setError('Vui lòng nhập mã nguồn trước khi nộp');
      return;
    }

    setSubmitting(true);
    setError('');

    const res = await apiRequest(`/exams/${examId}/submissions`, {
      method: 'POST',
      body: JSON.stringify({ sourceCode }),
    });

    setSubmitting(false);
    if (res.success && res.data) {
      navigate(`/student/submissions/${res.data.id}`);
    } else {
      setError(res.message || 'Lỗi khi nộp bài');
    }
  };

  if (loading) return <div className="container"><p>Đang tải bài thi...</p></div>;
  if (!exam) return <div className="container"><p>Không tìm thấy bài thi.</p></div>;

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/student">← Quay lại danh sách bài tập</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left column: Problem statement & Testcases */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className="badge badge-blue">{exam.allowedLanguage}</span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Giới hạn: {exam.timeLimitMs}ms • {exam.memoryLimitMb}MB</span>
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>{exam.title}</h2>

          <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.5rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {exam.descriptionMd}
          </div>

          <h4>Ví dụ mẫu (Sample Test Cases):</h4>
          {(!exam.testCases || exam.testCases.length === 0) ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Không có ví dụ công khai.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {exam.testCases.map((tc: any) => (
                <div key={tc.id} style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.35rem', padding: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ marginBottom: '0.25rem' }}><strong>Input (StdIn):</strong> <code style={{ color: '#60a5fa' }}>{tc.inputData}</code></div>
                  <div><strong>Output (StdOut):</strong> <code style={{ color: '#34d399' }}>{tc.expectedOutput}</code></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Code editor & Submit */}
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>Mã nguồn nộp bài ({exam.allowedLanguage})</h3>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <textarea
                className="form-control"
                rows={16}
                style={{
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.4',
                  whiteSpace: 'pre',
                }}
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                placeholder="Nhập code tại đây..."
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} disabled={submitting}>
              {submitting ? 'Đang gửi bài lên Sandbox...' : '🚀 Nộp bài chấm tự động'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
