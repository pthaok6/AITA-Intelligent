import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { MarkdownPreview } from '../../components/MarkdownPreview';
import { useAuth } from '../../contexts/AuthContext';

const isGithubRepositoryUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && ['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())
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
    const isGroupSubmission = exam?.examType === 'GROUP';
    if (isGroupSubmission && !isGithubRepositoryUrl(repoUrl.trim())) {
      setError('Nhóm chưa có repository GitHub hợp lệ. Hãy đăng ký repository tại trang Nhóm của tôi.');
      return;
    }
    if (!isGroupSubmission && (!file || !file.name.toLowerCase().endsWith('.zip'))) {
      setError('Chọn file .zip chứa mã nguồn.');
      return;
    }
    if (!isGroupSubmission && file && file.size > 25 * 1024 * 1024) {
      setError('ZIP tối đa 25 MiB.');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = isGroupSubmission
      ? await apiRequest('/exams/' + examId + '/submissions/from-git', {
        method: 'POST', body: JSON.stringify({ repoUrl: repoUrl.trim(), entrypoint: entrypoint.trim() || undefined }),
      })
      : await apiRequest('/exams/' + examId + '/submissions', {
        method: 'POST', body: (() => {
          const body = new FormData();
          if (file) body.append('file', file);
          if (entrypoint.trim()) body.append('entrypoint', entrypoint.trim());
          return body;
        })(),
      });
    setSubmitting(false);
    if (res.success) navigate('/student/submissions/' + res.data.id);
    else setError(res.message || 'Không nộp được bài.');
  }

  return (
    <div className="container page-exam-view" style={{ maxWidth: 1000, paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <Link to="/student" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Danh sách bài tập
        </Link>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-control)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#fca5a5', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {!exam && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          <div className="skeleton-box" style={{ minHeight: '380px' }}>
            <div className="skeleton-line" style={{ width: '25%' }} />
            <div className="skeleton-line" style={{ width: '60%', height: '1.6rem', margin: '0.75rem 0' }} />
            <div className="skeleton-line" style={{ width: '40%', marginBottom: '1.5rem' }} />
            <div className="skeleton-line" style={{ width: '90%' }} />
            <div className="skeleton-line" style={{ width: '85%' }} />
            <div className="skeleton-line" style={{ width: '70%' }} />
          </div>
          <div className="skeleton-box" style={{ minHeight: '380px' }}>
            <div className="skeleton-line" style={{ width: '45%' }} />
            <div className="skeleton-line" style={{ width: '100%', height: '2.5rem', margin: '1.5rem 0' }} />
            <div className="skeleton-line" style={{ width: '100%', height: '2.5rem' }} />
          </div>
        </div>
      )}

      {exam && (
        <div className="exam-take-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '0.5rem' }}>
          <div className="card">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <span className="badge badge-blue">{exam.allowedLanguage === 'PYTHON' ? 'Python 3' : exam.allowedLanguage === 'JAVA' ? 'Java 17' : 'C# .NET 8'}</span>
              {exam.examType === 'GROUP' && <span className="badge badge-yellow">Bài tập nhóm</span>}
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.01em' }}>{exam.title}</h2>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                CPU: {exam.timeLimitMs} ms
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
                RAM: {exam.memoryLimitMb} MiB
              </span>
            </div>

            <div style={{ margin: '0.75rem 0', padding: '0.65rem 0.85rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-control)', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Thời gian: <strong style={{ color: '#60a5fa' }}>{new Date(exam.startTime).toLocaleString('vi-VN')}</strong> — <strong style={{ color: '#f87171' }}>{new Date(exam.endTime).toLocaleString('vi-VN')}</strong></span>
            </div>

            <MarkdownPreview content={exam.descriptionMd} />

            {exam.testCases && exam.testCases.length > 0 && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  Test case công khai
                </h3>
                {exam.testCases.map((testCase: any, index: number) => (
                  <div className="exam-sample-case" key={testCase.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Ví dụ #{index + 1}
                    </div>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dữ liệu đầu vào (Input):</p>
                    <pre style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>{testCase.inputData}</pre>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kết quả mong đợi (Output):</p>
                    <pre style={{ margin: 0, fontSize: '0.82rem' }}>{testCase.expectedOutput}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {exam.examType === 'GROUP' && loadingTeam ? (
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-secondary)', padding: '2rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span>Đang tải thông tin nhóm...</span>
            </div>
          ) : exam.examType === 'GROUP' && !myTeam ? (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Bạn chưa được xếp vào nhóm</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Bài thi này là bài thi nhóm. Bạn cần tham gia một nhóm tại trang <Link to="/student/teams" style={{ color: '#38bdf8' }}>Nhóm của tôi</Link> trước khi nộp bài.
              </p>
            </div>
          ) : exam.examType === 'GROUP' && !isLeader ? (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Bạn là thành viên nhóm {myTeam.name}</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Chỉ Trưởng nhóm (<strong style={{ color: '#f8fafc' }}>{teamLeader?.student?.fullName || 'Trưởng nhóm'}</strong>) mới có quyền nộp bài đại diện cho cả nhóm.
                Quản lý thành viên và GitHub username tại <Link to="/student/teams" style={{ color: '#38bdf8' }}>Nhóm của tôi</Link>.
              </p>
            </div>
          ) : (
            <form className="card" onSubmit={submit}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                {exam.examType === 'GROUP' ? 'Nộp bài từ GitHub' : 'Nộp bài dạng ZIP'}
              </h3>
              {exam.examType === 'GROUP' ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Hệ thống lấy mã nguồn mới nhất trên nhánh mặc định của repository nhóm đã đăng ký tại thời điểm nộp. Commit được ghi nhận để cố định phiên bản đem đi chấm.
                </p>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  ZIP tối đa 25 MiB, giải nén tối đa 50 MiB. Chỉ mã nguồn được đưa vào môi trường chạy.
                </p>
              )}
              <div style={{ background: 'var(--bg-input)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-control)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                {exam.allowedLanguage === 'PYTHON'
                  ? exam.examType === 'GROUP' ? 'Python: đặt main.py và các module .py trong repository. Dùng thư viện chuẩn.' : 'Python: đặt main.py và các module .py vào ZIP. Dùng thư viện chuẩn.'
                  : exam.allowedLanguage === 'JAVA'
                  ? exam.examType === 'GROUP' ? 'Java 17: repository cần có Main.java và các file .java. Không dùng thư viện ngoài.' : 'Java 17: ZIP chứa Main.java và các file .java. Không dùng thư viện ngoài.'
                  : exam.examType === 'GROUP' ? 'C# .NET 8: repository cần có các file .cs có Main hoặc top-level statements.' : 'C# .NET 8: ZIP chứa các file .cs có Main hoặc top-level statements. Dự án được biên dịch bằng cấu hình của hệ thống.'}
              </div>

              {exam.examType !== 'GROUP' && (
                <div className="form-group">
                  <label htmlFor="submission-zip" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Tệp bài làm (.zip) *
                  </label>
                  <input id="submission-zip" className="form-control" type="file" accept=".zip,application/zip" required onChange={event => setFile(event.target.files?.[0] || null)} />
                </div>
              )}

              {exam.allowedLanguage !== 'CSHARP' && (
                <div className="form-group">
                  <label htmlFor="entrypoint" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    {exam.allowedLanguage === 'JAVA' ? 'Tên lớp chạy chính (mặc định Main)' : exam.examType === 'GROUP' ? 'File chạy chính trong repository (tự tìm main.py)' : 'File chạy chính trong ZIP (tự tìm main.py)'}
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
                  <label htmlFor="team-repository-url" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Link repository GitHub của nhóm *
                  </label>
                  <input
                    id="team-repository-url"
                    className="form-control"
                    type="url"
                    value={repoUrl}
                    onChange={event => setRepoUrl(event.target.value)}
                    placeholder="https://github.com/nhom/bai-tap"
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem', fontSize: '0.78rem' }}>
                    Bạn có thể nhập lại link GitHub; hệ thống lấy commit mới nhất trên nhánh mặc định của link này.
                  </small>
                </div>
              )}

              <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: '0.75rem', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}>
                {submitting ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Đang tải bài nộp…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    Nộp bài và chấm tự động
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
