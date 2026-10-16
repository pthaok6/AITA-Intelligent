import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export const StudentDashboard: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classCode, setClassCode] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingLeave, setPendingLeave] = useState<any>(null);
  const [leaving, setLeaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      const res = await apiRequest('/classes');
      if (res.success && res.data) {
        setClasses(res.data);
      }
      setLoading(false);
    };
    fetchClasses();
  }, []);

  const joinClass = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice('');
    const result = await apiRequest('/classes/join', { method: 'POST', body: JSON.stringify({ classCode }) });
    if (!result.success) { setNotice(result.message || 'Không thể tham gia lớp.'); return; }
    setClassCode(''); setNotice('Đã tham gia lớp.');
    const refreshed = await apiRequest('/classes'); if (refreshed.success && refreshed.data) setClasses(refreshed.data);
  };

  const leaveClass = async () => {
    if (!pendingLeave) return;
    setLeaving(true);
    const result = await apiRequest(`/classes/${pendingLeave.id}/enroll`, { method: 'DELETE' });
    setLeaving(false);
    setPendingLeave(null);
    setNotice(result.success ? 'Đã rời lớp.' : result.message || 'Không thể rời lớp.');
    if (result.success) setClasses(current => current.filter(item => item.id !== pendingLeave.id));
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Cổng Luyện Tập & Nộp Bài Sinh Viên</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Chọn bài thi thực hành được giao để làm bài và nhận kết quả chấm tự động tức thì</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {user?.role === 'STUDENT' && <Link to="/student/teams" className="btn btn-secondary">Nhóm của tôi</Link>}
          <Link to="/student/appeals" className="btn btn-secondary">Đơn khiếu nại điểm của tôi</Link>
        </div>
      </div>

      {user?.role === 'STUDENT' && <form onSubmit={joinClass} className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label htmlFor="class-code">Tham gia lớp bằng mã lớp</label><input id="class-code" className="form-control" value={classCode} onChange={event => setClassCode(event.target.value)} required /></div>
        <button className="btn btn-primary" type="submit">Tham gia</button>
      </form>}
      {notice && <p role="status" style={{ marginBottom: '1rem' }}>{notice}</p>}

      {loading ? (
        <p>Đang tải danh sách bài tập...</p>
      ) : classes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8' }}>Bạn chưa tham gia lớp học nào hoặc chưa có bài tập được giao.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {classes.map((cls) => (
            <div key={cls.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div>
                  <span className="badge badge-blue">{cls.classCode}</span>
                  <h3 style={{ marginTop: '0.25rem' }}>{cls.name}</h3>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Giảng viên: <strong>{cls.lecturer?.fullName}</strong>
                </div>
              </div>
      {user?.role === 'STUDENT' && <button className="btn btn-ghost-danger btn-sm" onClick={() => setPendingLeave(cls)} style={{ marginBottom: '0.75rem' }}>Rời lớp</button>}

              <h4>Danh sách bài thi thực hành:</h4>
              {(!cls.exams || cls.exams.length === 0) ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>Chưa có bài thi nào mở.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                  {cls.exams.map((exam: any) => (
                    <div key={exam.id} style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
                      <h4 style={{ marginBottom: '0.5rem' }}>{exam.title}</h4>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                        Ngôn ngữ: <strong style={{ color: '#60a5fa' }}>{exam.allowedLanguage}</strong> • CPU: {exam.timeLimitMs}ms
                      </p>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                        📅 Hạn nộp: <strong style={{ color: '#e2e8f0' }}>{new Date(exam.endTime).toLocaleString('vi-VN')}</strong>
                      </p>
                      {new Date() < new Date(exam.startTime) ? (
                        <button disabled className="btn btn-secondary" style={{ width: '100%', opacity: 0.6 }}>
                          Chưa mở (bắt đầu {new Date(exam.startTime).toLocaleString('vi-VN')})
                        </button>
                      ) : new Date() >= new Date(exam.endTime) ? (
                        <button disabled className="btn btn-secondary" style={{ width: '100%', opacity: 0.6 }}>
                          Đã hết hạn nộp
                        </button>
                      ) : (
                        <Link to={`/student/exams/${exam.id}/take`} className="btn btn-primary" style={{ width: '100%' }}>
                          Vào nộp bài &rarr;
                        </Link>
                      )}
                      <Link to={`/student/exams/${exam.id}/submissions`} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }}>Lịch sử bài nộp</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!pendingLeave} title="Rời lớp học?" description={pendingLeave ? `Bạn sẽ ngừng thấy lớp ${pendingLeave.classCode} và không thể nộp bài mới ở lớp này. Lịch sử bài nộp hiện có vẫn được lưu.` : ''} confirmLabel="Rời lớp" busy={leaving} onConfirm={leaveClass} onCancel={() => setPendingLeave(null)} />
    </div>
  );
};
