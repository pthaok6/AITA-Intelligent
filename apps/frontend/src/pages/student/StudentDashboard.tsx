import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { getUnreadAppealCount } from './appealNotifications';

export const StudentDashboard: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classCode, setClassCode] = useState('');
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingLeave, setPendingLeave] = useState<any>(null);
  const [leaving, setLeaving] = useState(false);
  const [unreadAppealCount, setUnreadAppealCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      const res = await apiRequest<any[]>('/classes');
      if (res.success && res.data) {
        setClasses(res.data);
      }
      setLoading(false);
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'STUDENT') return;
    let active = true;
    const fetchAppealNotifications = async () => {
      const res = await apiRequest<any[]>('/appeals/my');
      if (active && res.success && res.data) {
        setUnreadAppealCount(getUnreadAppealCount(res.data, user.id));
      }
    };
    void fetchAppealNotifications();
    const timer = window.setInterval(() => void fetchAppealNotifications(), 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id, user?.role]);

  const joinClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!classCode.trim()) return;

    setSubmittingJoin(true);
    const result = await apiRequest('/classes/join', {
      method: 'POST',
      body: JSON.stringify({ classCode: classCode.trim().toUpperCase() }),
    });
    setSubmittingJoin(false);

    if (!result.success) {
      setNotice({ type: 'error', text: result.message || 'Không thể tham gia lớp học. Vui lòng kiểm tra lại mã lớp.' });
      return;
    }

    setClassCode('');
    setNotice({ type: 'success', text: 'Tham gia lớp học thành công!' });
    const refreshed = await apiRequest<any[]>('/classes');
    if (refreshed.success && refreshed.data) setClasses(refreshed.data);
  };

  const leaveClass = async () => {
    if (!pendingLeave) return;
    setLeaving(true);
    const result = await apiRequest(`/classes/${pendingLeave.id}/enroll`, { method: 'DELETE' });
    setLeaving(false);
    setPendingLeave(null);

    if (result.success) {
      setNotice({ type: 'success', text: `Đã rời lớp ${pendingLeave.classCode}.` });
      setClasses(current => current.filter(item => item.id !== pendingLeave.id));
    } else {
      setNotice({ type: 'error', text: result.message || 'Không thể rời lớp học.' });
    }
  };

  const getExamStatus = (exam: any) => {
    const now = new Date();
    const start = new Date(exam.startTime);
    const end = new Date(exam.endTime);

    if (now < start) {
      return {
        key: 'UPCOMING',
        badge: (
          <span className="status-badge status-badge-upcoming">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            Sắp mở
          </span>
        ),
        canTake: false,
        label: `Bắt đầu ${start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${start.toLocaleDateString('vi-VN')}`,
      };
    }
    if (now >= end) {
      return {
        key: 'CLOSED',
        badge: (
          <span className="status-badge status-badge-closed">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
            Đã hết hạn
          </span>
        ),
        canTake: false,
        label: 'Đã hết thời gian nộp bài',
      };
    }
    return {
      key: 'ACTIVE',
      badge: (
        <span className="status-badge status-badge-active">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          Đang mở nộp bài
        </span>
      ),
      canTake: true,
      label: 'Đang mở',
    };
  };

  return (
    <div className="container" style={{ maxWidth: 1200, paddingTop: '1.25rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            Cổng Luyện Tập & Nộp Bài
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 640 }}>
            Tham gia lớp học bằng mã code, hoàn thành bài tập thực hành lập trình và theo dõi kết quả chấm điểm tự động.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {user?.role === 'STUDENT' && (
            <Link to="/student/teams" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Nhóm của tôi
            </Link>
          )}

          <Link to="/student/appeals" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Khiếu nại
            {unreadAppealCount > 0 && (
              <span
                style={{
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  padding: '0.05rem 0.35rem',
                  marginLeft: '0.2rem',
                }}
              >
                {unreadAppealCount > 99 ? '99+' : unreadAppealCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Join Class Bar */}
      {user?.role === 'STUDENT' && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.75rem' }}>
          <form onSubmit={joinClass} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 260 }}>
              <div style={{ color: '#60a5fa', display: 'flex', alignItems: 'center' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <input
                id="class-code-input"
                className="form-control"
                placeholder="Nhập mã lớp để tham gia (Ví dụ: SE1901-PRF192)"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                style={{ height: '2.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submittingJoin} style={{ height: '2.5rem', minWidth: 140 }}>
              {submittingJoin ? 'Đang xác thực...' : 'Tham gia lớp'}
            </button>
          </form>
        </div>
      )}

      {/* Alert Notice */}
      {notice && (
        <div
          role="status"
          style={{
            background: notice.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${notice.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            color: notice.type === 'success' ? '#34d399' : '#f87171',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-control)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{notice.type === 'success' ? '✓ ' : '⚠ '} {notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {[1, 2].map((i) => (
            <div key={i} className="skeleton-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ width: 140 }} className="skeleton-line" />
                <div style={{ width: 100 }} className="skeleton-line" />
              </div>
              <div style={{ width: '45%' }} className="skeleton-line" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
                <div style={{ height: 160, background: '#090d16', borderRadius: '0.5rem', border: '1px solid #334155' }} />
                <div style={{ height: 160, background: '#090d16', borderRadius: '0.5rem', border: '1px solid #334155' }} />
              </div>
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        /* Empty State */
        <div className="empty-state-box">
          <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', marginBottom: '1rem' }}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Bạn chưa tham gia lớp học nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto 1.25rem' }}>
            Hãy liên hệ giảng viên môn học để nhận mã lớp (Class Code) và nhập vào ô bên trên để bắt đầu luyện tập.
          </p>
        </div>
      ) : (
        /* Enrolled Classes List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {classes.map((cls) => (
            <div key={cls.id} className="student-class-card">
              {/* Class Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border)',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="badge badge-blue" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}>
                      {cls.classCode}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Học kỳ: <strong>{cls.semester}</strong>
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 650, margin: 0 }}>{cls.name}</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {cls.lecturer?.fullName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>Giảng viên: <strong style={{ color: 'var(--text-primary)' }}>{cls.lecturer.fullName}</strong></span>
                    </div>
                  )}

                  {user?.role === 'STUDENT' && (
                    <button
                      type="button"
                      className="btn btn-ghost-danger btn-sm"
                      onClick={() => setPendingLeave(cls)}
                      title="Rời khỏi lớp học này"
                    >
                      Rời lớp
                    </button>
                  )}
                </div>
              </div>

              {/* Class Exams List */}
              <div style={{ marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Danh sách bài thi & Lab thực hành ({cls.exams?.length || 0})
                </h4>

                {!cls.exams || cls.exams.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic', padding: '1rem 0' }}>
                    Chưa có bài thi nào được mở cho lớp này.
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: '1rem',
                    }}
                  >
                    {cls.exams.map((exam: any) => {
                      const status = getExamStatus(exam);
                      return (
                        <div
                          key={exam.id}
                          className={`exam-card-improved ${status.key === 'CLOSED' ? 'is-closed' : ''}`}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <h4 style={{ fontSize: '1rem', fontWeight: 650, margin: 0, lineHeight: 1.35 }}>
                                {exam.title}
                              </h4>
                              {status.badge}
                            </div>

                            {/* Meta Specs Chips */}
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.65rem 0' }}>
                              <span className="meta-chip">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="16 18 22 12 16 6" />
                                  <polyline points="8 6 2 12 8 18" />
                                </svg>
                                {exam.allowedLanguage}
                              </span>

                              <span className="meta-chip">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                {exam.timeLimitMs}ms
                              </span>
                            </div>

                            {/* Deadline info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              <span>
                                Hạn nộp: <strong style={{ color: status.key === 'CLOSED' ? 'var(--text-secondary)' : '#e2e8f0' }}>
                                  {new Date(exam.endTime).toLocaleString('vi-VN')}
                                </strong>
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {status.canTake ? (
                              <Link
                                to={`/student/exams/${exam.id}/take`}
                                className="btn btn-primary"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.4rem',
                                  fontWeight: 600,
                                }}
                              >
                                Vào nộp bài
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                  <polyline points="12 5 19 12 12 19" />
                                </svg>
                              </Link>
                            ) : (
                              <button
                                disabled
                                className="btn btn-secondary"
                                style={{ opacity: 0.6, cursor: 'not-allowed', fontSize: '0.85rem' }}
                              >
                                {status.label}
                              </button>
                            )}

                            <Link
                              to={`/student/exams/${exam.id}/submissions`}
                              className="btn btn-secondary btn-sm"
                              style={{ textAlign: 'center' }}
                            >
                              Lịch sử bài nộp
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Leaving Class */}
      <ConfirmDialog
        open={!!pendingLeave}
        title="Rời khỏi lớp học?"
        description={
          pendingLeave
            ? `Bạn có chắc chắn muốn rời lớp ${pendingLeave.classCode} (${pendingLeave.name})? Bạn sẽ không thể nộp bài tập mới cho lớp này, nhưng lịch sử bài nộp trước đây vẫn được lưu trữ.`
            : ''
        }
        confirmLabel="Xác nhận rời lớp"
        busy={leaving}
        onConfirm={leaveClass}
        onCancel={() => setPendingLeave(null)}
      />
    </div>
  );
};
