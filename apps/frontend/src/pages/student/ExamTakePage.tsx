import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { MarkdownPreview } from '../../components/MarkdownPreview';
import { useAuth } from '../../contexts/AuthContext';

export const ExamTakePage: React.FC = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exam, setExam] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [entrypoint, setEntrypoint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [myTeam, setMyTeam] = useState<any>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    void apiRequest('/exams/' + examId).then(res => {
      if (res.success) {
        setExam(res.data);
        if (res.data.examType === 'GROUP') {
          setLoadingTeam(true);
          void apiRequest('/exams/' + examId + '/my-team').then(tRes => {
            setLoadingTeam(false);
            if (tRes.success && tRes.data) {
              setMyTeam(tRes.data);
            }
          });
        }
      } else {
        setError(res.message || 'Không tải được bài thi.');
      }
    });
  }, [examId]);

  const myMembership = myTeam?.members?.find((m: any) => m.studentId === user?.id);
  const isLeader = myMembership?.role === 'LEADER';
  const teamLeader = myTeam?.members?.find((m: any) => m.role === 'LEADER');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (exam?.examType === 'GROUP' && !isLeader) {
      setError('Chỉ Nhóm trưởng (Leader) mới có quyền nộp bài cho nhóm theo quy tắc BR-11.');
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
    setSubmitting(true);
    setError('');
    const body = new FormData();
    body.append('file', file);
    if (entrypoint.trim()) body.append('entrypoint', entrypoint.trim());
    const res = await apiRequest('/exams/' + examId + '/submissions', { method: 'POST', body });
    setSubmitting(false);
    if (res.success) navigate('/student/submissions/' + res.data.id);
    else setError(res.message || 'Không nộp được bài.');
  }

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <Link to="/student">← Danh sách bài tập</Link>
      {error && <p role="alert" style={{ color: '#f87171', marginTop: '0.5rem' }}>{error}</p>}
      {exam && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          <div className="card">
            <span className="badge badge-blue">{exam.allowedLanguage === 'PYTHON' ? 'Python 3' : exam.allowedLanguage === 'JAVA' ? 'Java 17' : 'C# .NET 8'}</span>
            {exam.examType === 'GROUP' && (
              <span className="badge badge-yellow" style={{ marginLeft: '0.5rem', background: '#854d0e', color: '#fef08a' }}>
                Bài tập nhóm (Leader nộp)
              </span>
            )}
            <h2>{exam.title}</h2>
            <p>{exam.timeLimitMs} ms · {exam.memoryLimitMb} MiB</p>
            <MarkdownPreview content={exam.descriptionMd} />
            <h3>Test case công khai</h3>
            {exam.testCases?.map((tc: any, index: number) => (
              <div className="exam-sample-case" key={tc.id}>
                <h4>Test case {index + 1}</h4>
                <p>Dữ liệu đầu vào</p>
                <pre>{tc.inputData}</pre>
                <p>Kết quả mong đợi</p>
                <pre>{tc.expectedOutput}</pre>
              </div>
            ))}
          </div>

          {exam.examType === 'GROUP' && !loadingTeam && !myTeam ? (
            <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#1c1917' }}>
              <h3 style={{ color: '#f59e0b', margin: 0 }}>⚠️ Chưa được xếp vào nhóm</h3>
              <p style={{ marginTop: '0.75rem', color: '#e2e8f0' }}>
                Đây là bài thi làm theo hình thức <strong>Nhóm (Team)</strong>. Hiện tại tài khoản của bạn chưa thuộc nhóm nào cho bài thi này.
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                Vui lòng liên hệ Giảng viên để được thêm vào danh sách nhóm trước khi có thể nộp hoặc theo dõi điểm số.
              </p>
            </div>
          ) : exam.examType === 'GROUP' && !loadingTeam && myTeam && !isLeader ? (
            <div className="card" style={{ borderLeft: '4px solid #38bdf8', background: '#0f172a' }}>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>👥 Nhóm của bạn: {myTeam.name}</h3>
              <div style={{ marginTop: '0.75rem', color: '#cbd5e1', fontSize: '0.9rem' }}>
                <strong>Trưởng nhóm:</strong> {teamLeader?.student?.fullName || 'Chưa chỉ định'} ({teamLeader?.student?.email || ''})
              </div>

              <div style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '6px', marginTop: '1rem', border: '1px solid #334155' }}>
                <p style={{ color: '#facc15', fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>
                  🔒 Quy định BR-11: Chỉ Nhóm trưởng mới có quyền nộp bài
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: 0 }}>
                  Bạn đang tham gia với tư cách <strong>Thành viên</strong>. Khi Trưởng nhóm nộp bài, hệ thống sẽ tự động chấm và lưu kết quả cho cả nhóm. Điểm số cá nhân của bạn sẽ được tính phái sinh dựa trên đóng góp Git (BR-12).
                </p>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Danh sách thành viên nhóm ({myTeam.members?.length || 0})
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {myTeam.members?.map((m: any) => (
                    <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                      <span>
                        {m.student?.fullName} <span style={{ color: '#64748b' }}>({m.student?.email})</span>
                      </span>
                      <span className={`badge ${m.role === 'LEADER' ? 'badge-yellow' : 'badge-blue'}`}>
                        {m.role === 'LEADER' ? 'Trưởng nhóm' : 'Thành viên'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <form className="card" onSubmit={submit}>
              {exam.examType === 'GROUP' && isLeader && (
                <div style={{ background: '#064e3b', color: '#6ee7b7', padding: '0.6rem 0.85rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #059669', fontSize: '0.875rem' }}>
                  👑 <strong>Bạn là Trưởng nhóm của {myTeam.name}.</strong> Bài nộp của bạn sẽ đại diện cho cả nhóm theo quy định BR-11.
                </div>
              )}
              <h3>Nộp bài dạng ZIP</h3>
              <p>ZIP tối đa 25 MiB, giải nén tối đa 50 MiB. Chỉ mã nguồn được đưa vào môi trường chạy.</p>
              <p>
                {exam.allowedLanguage === 'PYTHON'
                  ? 'Python: đặt main.py và các module .py vào ZIP. Dùng thư viện chuẩn.'
                  : exam.allowedLanguage === 'JAVA'
                  ? 'Java 17: ZIP chứa Main.java và các file .java. Không dùng thư viện ngoài.'
                  : 'C# .NET 8: ZIP chứa các file .cs có Main hoặc top-level statements. Dự án được biên dịch bằng cấu hình của hệ thống.'}
              </p>
              <label htmlFor="submission-zip">Tệp bài làm (.zip)</label>
              <input id="submission-zip" className="form-control" type="file" accept=".zip,application/zip" required onChange={e => setFile(e.target.files?.[0] || null)} />
              {exam.allowedLanguage !== 'CSHARP' && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="entrypoint">
                    {exam.allowedLanguage === 'JAVA' ? 'Tên lớp chạy chính (mặc định Main)' : 'File chạy chính trong ZIP (tự tìm main.py)'}
                  </label>
                  <input
                    id="entrypoint"
                    className="form-control"
                    value={entrypoint}
                    onChange={e => setEntrypoint(e.target.value)}
                    placeholder={exam.allowedLanguage === 'JAVA' ? 'Main hoặc school.Main' : 'main.py hoặc src/main.py'}
                  />
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: '1rem' }}>
                {submitting ? 'Đang tải bài nộp…' : 'Nộp bài và chấm tự động'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
