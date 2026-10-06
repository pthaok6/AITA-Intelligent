import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export const ExamTakePage: React.FC = () => {
  const { examId } = useParams(); const navigate = useNavigate();
  const [exam, setExam] = useState<any>(null), [file, setFile] = useState<File | null>(null);
  const [entrypoint, setEntrypoint] = useState(''), [submitting, setSubmitting] = useState(false), [error, setError] = useState('');
  useEffect(() => { void apiRequest('/exams/' + examId).then(res => { if (res.success) setExam(res.data); else setError(res.message || 'Không tải được bài thi.'); }); }, [examId]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !file.name.toLowerCase().endsWith('.zip')) { setError('Chọn file .zip chứa mã nguồn.'); return; }
    if (file.size > 25 * 1024 * 1024) { setError('ZIP tối đa 25 MiB.'); return; }
    setSubmitting(true); setError('');
    const body = new FormData(); body.append('file', file); if (entrypoint.trim()) body.append('entrypoint', entrypoint.trim());
    const res = await apiRequest('/exams/' + examId + '/submissions', { method: 'POST', body });
    setSubmitting(false);
    if (res.success) navigate('/student/submissions/' + res.data.id); else setError(res.message || 'Không nộp được bài.');
  }
  return <div className="container" style={{ maxWidth: 1000 }}>
    <Link to="/student">← Danh sách bài tập</Link>
    {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
    {exam && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
      <div className="card">
        <span className="badge badge-blue">{exam.allowedLanguage}</span>
        <h2>{exam.title}</h2><p>{exam.timeLimitMs} ms · {exam.memoryLimitMb} MiB</p>
        <div style={{ whiteSpace: 'pre-wrap' }}>{exam.descriptionMd}</div>
        <h3>Test case công khai</h3>
        {exam.testCases?.map((tc: any) => <div key={tc.id}><p>Input</p><pre>{tc.inputData}</pre><p>Output</p><pre>{tc.expectedOutput}</pre></div>)}
      </div>
      <form className="card" onSubmit={submit}>
        <h3>Nộp bài bằng ZIP</h3>
        <p>ZIP tối đa 25 MiB, giải nén tối đa 50 MiB. Chỉ mã nguồn được đưa vào môi trường chạy.</p>
        <p>{exam.allowedLanguage === 'PYTHON' ? 'Python: đặt main.py và các module .py vào ZIP. Dùng thư viện chuẩn.' : exam.allowedLanguage === 'JAVA' ? 'Java 17: ZIP chứa Main.java và các file .java. Không dùng thư viện ngoài.' : 'C# .NET 8: ZIP chứa các file .cs có Main hoặc top-level statements. Dự án được biên dịch bằng cấu hình của hệ thống.'}</p>
        <label htmlFor="submission-zip">File bài nộp</label>
        <input id="submission-zip" className="form-control" type="file" accept=".zip,application/zip" required onChange={e => setFile(e.target.files?.[0] || null)} />
        {exam.allowedLanguage !== 'CSHARP' && <div className="form-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="entrypoint">{exam.allowedLanguage === 'JAVA' ? 'Tên lớp chạy chính (mặc định Main)' : 'File chạy chính trong ZIP (tự tìm main.py)'}</label>
          <input id="entrypoint" className="form-control" value={entrypoint} onChange={e => setEntrypoint(e.target.value)} placeholder={exam.allowedLanguage === 'JAVA' ? 'Main hoặc school.Main' : 'main.py hoặc src/main.py'} />
        </div>}
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: '1rem' }}>{submitting ? 'Đang tải bài nộp…' : 'Nộp bài và chấm tự động'}</button>
      </form>
    </div>}
  </div>;
};
