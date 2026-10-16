import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { MarkdownPreview } from '../../components/MarkdownPreview';
import { useAuth } from '../../contexts/AuthContext';

const isGithubRepositoryUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())
      && url.pathname.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
};

export const ExamTakePage: React.FC = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exam, setExam] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [entrypoint, setEntrypoint] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [myTeam, setMyTeam] = useState<any>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    setExam(null);
    setMyTeam(null);
    setLoadingTeam(false);
    void apiRequest('/exams/' + examId).then(res => {
      if (!res.success) {
        setError(res.message || 'Không tải được bài thi.');
        return;
      }
      setExam(res.data);
      if (res.data.examType === 'GROUP') {
        setLoadingTeam(true);
        void apiRequest('/exams/' + examId + '/my-team').then(teamRes => {
          setLoadingTeam(false);
          if (teamRes.success && teamRes.data) {
            setMyTeam(teamRes.data);
            setRepoUrl(teamRes.data.repoUrl || '');
          }
        });
      }
    });
  }, [examId]);

  const myMembership = myTeam?.members?.find((member: any) => member.studentId === user?.id);
  const isLeader = myMembership?.role === 'LEADER';
  const teamLeader = myTeam?.members?.find((member: any) => member.role === 'LEADER');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (exam?.examType === 'GROUP' && !isLeader) {
      setError('Chỉ trưởng nhóm mới có quyền nộp bài cho nhóm.');
      return;
    }
    if (!file || !file.name.toLowerCase().endsWith('.zip')) {
      setError('Chọn file .zip chứa mã nguồn.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('ZIP tối đa 25 MiB.');
      return;
    }
    if (exam?.examType === 'GROUP' && !isGithubRepositoryUrl(repoUrl.trim())) {
      setError('Nhập URL repository GitHub hợp lệ, ví dụ https://github.com/nhom/bai-tap.');
      return;
    }

    setSubmitting(true);
    setError('');
    const body = new FormData();
    body.append('file', file);
    if (entrypoint.trim()) body.append('entrypoint', entrypoint.trim());
    if (exam?.examType === 'GROUP') body.append('repoUrl', repoUrl.trim());
    const res = await apiRequest('/exams/' + examId + '/submissions', { method: 'POST', body });
    setSubmitting(false);
    if (res.success) navigate('/student/submissions/' + res.data.id);
    else setError(res.message || 'Không nộp được bài.');
  }

  return (
    <div className="container page-exam-view" style={{ maxWidth: 1000 }}>
      <Link to="/student">← Danh sách bài tập</Link>
      {error && <p role="alert" style={{ color: '#f87171', marginTop: '0.5rem' }}>{error}</p>}
      {exam && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          <div className="card">
            <span className="badge badge-blue">{exam.allowedLanguage === 'PYTHON' ? 'Python 3' : exam.allowedLanguage === 'JAVA' ? 'Java 17' : 'C# .NET 8'}</span>
            {exam.examType === 'GROUP' && <span className="badge badge-yellow" style={{ marginLeft: '0.5rem' }}>Bài tập nhóm</span>}
            <h2>{exam.title}</h2>
            <p>{exam.timeLimitMs} ms · {exam.memoryLimitMb} MiB</p>
            <div style={{ margin: '0.75rem 0', padding: '0.5rem 0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-control)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Thời gian: <strong style={{ color: '#60a5fa' }}>{new Date(exam.startTime).toLocaleString('vi-VN')}</strong> — <strong style={{ color: '#f87171' }}>{new Date(exam.endTime).toLocaleString('vi-VN')}</strong>
            </div>
            <MarkdownPreview content={exam.descriptionMd} />
            <h3>Test case công khai</h3>
            {exam.testCases?.map((testCase: any, index: number) => (
              <div className="exam-sample-case" key={testCase.id}>
                <h4>Test case {index + 1}</h4>
                <p>Dữ liệu đầu vào</p>
                <pre>{testCase.inputData}</pre>
                <p>Kết quả mong đợi</p>
                <pre>{testCase.expectedOutput}</pre>
              </div>
            ))}
          </div>

          {exam.examType === 'GROUP' && loadingTeam ? (
            <div className="card"><p>Đang tải thông tin nhóm...</p></div>
          ) : exam.examType === 'GROUP' && !myTeam ? (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Bạn chưa được xếp vào nhóm</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Liên hệ giảng viên để được thêm vào nhóm trước khi nộp bài.</p>
            </div>
          ) : exam.examType === 'GROUP' && !isLeader ? (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Bạn là thành viên nhóm {myTeam.name}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Trưởng nhóm sẽ đính kèm link GitHub và nộp bài đại diện cho cả nhóm. Quản lý thành viên và GitHub username tại <Link to="/student/teams">Nhóm của tôi</Link>.</p>
            </div>
          ) : (
            <form className="card" onSubmit={submit}>
              {exam.examType === 'GROUP' && isLeader }
              <h3>Nộp bài dạng ZIP</h3>
              <p>ZIP tối đa 25 MiB, giải nén tối đa 50 MiB. Chỉ mã nguồn được đưa vào môi trường chạy.</p>
              <p>
                {exam.allowedLanguage === 'PYTHON'
                  ? 'Python: đặt main.py và các module .py vào ZIP. Dùng thư viện chuẩn.'
                  : exam.allowedLanguage === 'JAVA'
                  ? 'Java 17: ZIP chứa Main.java và các file .java. Không dùng thư viện ngoài.'
                  : 'C# .NET 8: ZIP chứa các file .cs có Main hoặc top-level statements. Dự án được biên dịch bằng cấu hình của hệ thống.'}
              </p>
              <div className="form-group">
                <label htmlFor="submission-zip">Tệp bài làm (.zip)</label>
                <input id="submission-zip" className="form-control" type="file" accept=".zip,application/zip" required onChange={event => setFile(event.target.files?.[0] || null)} />
              </div>
              {exam.allowedLanguage !== 'CSHARP' && (
                <div className="form-group">
                  <label htmlFor="entrypoint">
                    {exam.allowedLanguage === 'JAVA' ? 'Tên lớp chạy chính (mặc định Main)' : 'File chạy chính trong ZIP (tự tìm main.py)'}
                  </label>
                  <input
                    id="entrypoint"
                    className="form-control"
                    value={entrypoint}
                    onChange={event => setEntrypoint(event.target.value)}
                    placeholder={exam.allowedLanguage === 'JAVA' ? 'Main hoặc school.Main' : 'main.py hoặc src/main.py'}
                  />
                </div>
              )}
              {exam.examType === 'GROUP' && (
                <div className="form-group">
                  <label htmlFor="team-repository-url">Link repository GitHub của nhóm</label>
                  <input
                    id="team-repository-url"
                    className="form-control"
                    type="url"
                    value={repoUrl}
                    onChange={event => setRepoUrl(event.target.value)}
                    placeholder="https://github.com/nhom/bai-tap"
                    required
                  />
                  <small style={{ color: 'var(--text-secondary)' }}>Link được lưu cùng lần nộp và dùng để phân tích đóng góp Git.</small>
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: '0.5rem' }}>
                {submitting ? 'Đang tải bài nộp…' : 'Nộp bài và chấm tự động'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
