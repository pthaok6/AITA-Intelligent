import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export const CreateExamPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [descriptionMd, setDescriptionMd] = useState('');
  const [allowedLanguage, setAllowedLanguage] = useState('PYTHON');
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(512);

  // Test cases state
  const [testCases, setTestCases] = useState<Array<{ inputData: string; expectedOutput: string; isHidden: boolean; scoreWeight: number }>>([
    { inputData: '3 5', expectedOutput: '8', isHidden: false, scoreWeight: 5.0 },
    { inputData: '10 20', expectedOutput: '30', isHidden: true, scoreWeight: 5.0 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addTestCaseRow = () => {
    setTestCases([...testCases, { inputData: '', expectedOutput: '', isHidden: false, scoreWeight: 2.5 }]);
  };

  const removeTestCaseRow = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (index: number, field: string, value: any) => {
    const updated = [...testCases];
    (updated[index] as any)[field] = value;
    setTestCases(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testCases.length === 0) {
      setError('Vui lòng thêm ít nhất 1 test case');
      return;
    }

    setSubmitting(true);
    setError('');

    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 ngày sau

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
        timeLimitMs: Number(timeLimitMs),
        memoryLimitMb: Number(memoryLimitMb),
        startTime,
        endTime,
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
    <div className="container" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/lecturer">← Quay lại Dashboard</Link>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Tạo Bài Thi & Bộ Test Cases Mới</h2>

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
            <label>Mô tả đề bài (Markdown)</label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="Cho 2 số nguyên a và b trên cùng một dòng. In ra tổng a + b."
              value={descriptionMd}
              onChange={(e) => setDescriptionMd(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Ngôn ngữ quy định</label>
              <select className="form-control" value={allowedLanguage} onChange={(e) => setAllowedLanguage(e.target.value)}>
                <option value="PYTHON">Python 3</option>
                <option value="JAVA">Java JDK 17</option>
                <option value="CPP">C++ (GCC)</option>
                <option value="CSHARP">C# (.NET 8)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Giới hạn CPU (ms)</label>
              <input
                type="number"
                className="form-control"
                value={timeLimitMs}
                onChange={(e) => setTimeLimitMs(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Giới hạn RAM (MB)</label>
              <input
                type="number"
                className="form-control"
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
              />
            </div>
          </div>

          <hr style={{ borderColor: 'var(--border)', margin: '1.5rem 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4>Bộ Test Cases Chấm Điểm Tự Động</h4>
            <button type="button" onClick={addTestCaseRow} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
              + Thêm Test Case
            </button>
          </div>

          {testCases.map((tc, idx) => (
            <div key={idx} style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Test Case #{idx + 1}</span>
                {testCases.length > 1 && (
                  <button type="button" onClick={() => removeTestCaseRow(idx)} style={{ background: 'none', color: '#ef4444', fontSize: '0.8rem' }}>
                    Xóa
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dữ liệu đầu vào (StdIn)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="3 5"
                    value={tc.inputData}
                    onChange={(e) => updateTestCase(idx, 'inputData', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Kết quả kỳ vọng (StdOut)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="8"
                    value={tc.expectedOutput}
                    onChange={(e) => updateTestCase(idx, 'expectedOutput', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={tc.isHidden}
                    onChange={(e) => updateTestCase(idx, 'isHidden', e.target.checked)}
                  />
                  Test case ẩn (Chỉ dùng chấm điểm, giấu với sinh viên)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Điểm:</span>
                  <input
                    type="number"
                    step="0.5"
                    style={{ width: '70px' }}
                    className="form-control"
                    value={tc.scoreWeight}
                    onChange={(e) => updateTestCase(idx, 'scoreWeight', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={submitting}>
            {submitting ? 'Đang lưu đề thi...' : 'Lưu & Kích hoạt Bài Thi'}
          </button>
        </form>
      </div>
    </div>
  );
};
