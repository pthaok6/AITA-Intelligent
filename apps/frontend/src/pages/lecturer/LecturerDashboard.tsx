import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { getUnreadAppealInboxCount } from '../student/appealNotifications';

export const LecturerDashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [pendingDeleteClass, setPendingDeleteClass] = useState<any | null>(null);
  const [deletingClass, setDeletingClass] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [name, setName] = useState('');
  const [semester, setSemester] = useState('SU26');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [openClassMenu, setOpenClassMenu] = useState<string | null>(null);
  const [unreadAppealCount, setUnreadAppealCount] = useState(0);

  const fetchClasses = async () => {
    setLoading(true);
    const res = await apiRequest('/classes');
    if (res.success && res.data) {
      setClasses(res.data);
    } else setError(res.message || 'Không tải được danh sách lớp.');
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!user || (user.role !== 'LECTURER' && user.role !== 'ADMIN')) return;
    let active = true;
    const fetchUnreadAppeals = async () => {
      const res = await apiRequest('/appeals/lecturer?status=SUBMITTED');
      if (active && res.success && res.data) {
        setUnreadAppealCount(getUnreadAppealInboxCount(res.data, user.id));
      }
    };
    void fetchUnreadAppeals();
    const timer = window.setInterval(() => void fetchUnreadAppeals(), 30000);
    const refreshAfterRead = () => void fetchUnreadAppeals();
    window.addEventListener('appeal-inbox-read', refreshAfterRead);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('appeal-inbox-read', refreshAfterRead);
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!openClassMenu) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.class-card-actions')) setOpenClassMenu(null);
    };
    document.addEventListener('click', closeOnOutsideClick);
    return () => document.removeEventListener('click', closeOnOutsideClick);
  }, [openClassMenu]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await apiRequest('/classes', {
      method: 'POST',
      body: JSON.stringify({ classCode, name, semester }),
    });
    setSubmitting(false);
    if (res.success) {
      setShowCreateModal(false);
      setClassCode('');
      setName('');
      fetchClasses();
    } else {
      setError(res.message || 'Lỗi khi tạo lớp');
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setError('');
    setSubmitting(true);
    const res = await apiRequest(`/classes/${editingClass.id}`, { method: 'PATCH', body: JSON.stringify({ classCode, name, semester }) });
    setSubmitting(false);
    if (res.success) { setEditingClass(null); fetchClasses(); }
    else setError(res.message || 'Không thể cập nhật lớp.');
  };

  const handleDeleteClass = async () => {
    if (!pendingDeleteClass) return;
    setDeletingClass(true);
    const res = await apiRequest(`/classes/${pendingDeleteClass.id}`, { method: 'DELETE' });
    setDeletingClass(false); setPendingDeleteClass(null);
    if (res.success) fetchClasses(); else setError(res.message || 'Không thể xóa lớp.');
  };

  const totalStudents = classes.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0);
  const totalExams = classes.reduce((sum, c) => sum + (c._count?.exams || 0), 0);

  return (
    <div className="container" style={{ paddingBottom: '3rem' }}>
      {/* Header section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1.25rem',
        marginBottom: '1.75rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            {isAdmin ? 'Tổng quan toàn hệ thống' : 'Quản lý Lớp học & Đề thi'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            {isAdmin ? 'Xem tất cả lớp học, đề thi, bài nộp và hoạt động nhóm của sinh viên.' : 'Tổ chức lớp học, soạn đề kiểm tra và theo dõi tiến độ nộp bài của sinh viên.'}
          </p>

          {/* Quick stats counter bar */}
          {!loading && classes.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
              <div className="meta-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                <span><strong>{classes.length}</strong> lớp học</span>
              </div>
              <div className="meta-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span><strong>{totalExams}</strong> bài kiểm tra</span>
              </div>
              <div className="meta-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span><strong>{totalStudents}</strong> lượt sinh viên</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to={isAdmin ? '/admin/appeals' : '/lecturer/appeals'} className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.2rem' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Hộp thư khiếu nại
            {unreadAppealCount > 0 && (
              <span className="notification-count" aria-label={`${unreadAppealCount} new appeals`}>
                {unreadAppealCount > 99 ? '99+' : unreadAppealCount}
              </span>
            )}
          </Link>
          {!isAdmin && (
            <button
              onClick={() => { setClassCode(''); setName(''); setSemester('SU26'); setShowCreateModal(true); }}
              className="btn btn-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Tạo lớp học mới
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" style={{
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-control)',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#fca5a5',
          marginBottom: '1.25rem',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      {/* Modal create / update class */}
      {(showCreateModal || editingClass) && (
        <div className="form-modal-overlay">
          <div className="card form-modal-panel">
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 700 }}>
              {editingClass ? 'Cập nhật thông tin lớp học' : 'Tạo Lớp Học Mới'}
            </h3>
            {error && <p role="alert" style={{ color: '#fca5a5', marginBottom: '1rem' }}>{error}</p>}
            <form onSubmit={editingClass ? handleUpdateClass : handleCreateClass}>
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block' }}>
                  Mã lớp (Class Code)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: SE1801-SWP391"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block' }}>
                  Tên môn học / Khóa học
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: Kỹ nghệ phần mềm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block' }}>
                  Học kỳ
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: SU26, FA26"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setEditingClass(null); }}
                  className="btn btn-secondary"
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : (editingClass ? 'Lưu thay đổi' : 'Tạo lớp ngay')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading Skeleton state */}
      {loading ? (
        <div className="lecturer-class-list">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton-box" style={{ height: '220px' }}>
              <div className="skeleton-line" style={{ width: '40%' }} />
              <div className="skeleton-line" style={{ width: '75%', height: '1.4rem', margin: '1rem 0' }} />
              <div className="skeleton-line" style={{ width: '50%' }} />
              <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem' }}>
                <div className="skeleton-line" style={{ width: '60%', height: '2.5rem' }} />
                <div className="skeleton-line" style={{ width: '35%', height: '2.5rem' }} />
              </div>
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        /* Empty State */
        <div className="empty-state-box">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '3.75rem',
            height: '3.75rem',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#60a5fa',
            marginBottom: '1rem'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {isAdmin ? 'Chưa có lớp học nào trong hệ thống' : 'Chưa có lớp học nào'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            {isAdmin ? 'Hệ thống chưa ghi nhận lớp học nào từ các giảng viên.' : 'Hãy tạo lớp học đầu tiên để mời sinh viên và thiết lập các bài lab thực hành chấm tự động.'}
          </p>
          {!isAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              + Tạo lớp học đầu tiên
            </button>
          )}
        </div>
      ) : (
        /* Classes Grid */
        <div className="lecturer-class-list">
          {classes.map((cls) => (
            <div key={cls.id} className="lecturer-class-card">
              {/* Card top */}
              <div>
                <div className="lecturer-class-heading">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">{cls.classCode}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Học kỳ: {cls.semester}
                    </span>
                  </div>

                  {/* Dropdown menu */}
                  <div className={`class-card-actions${openClassMenu === cls.id ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="class-menu-trigger"
                      aria-label={`Tùy chọn lớp ${cls.classCode}`}
                      aria-expanded={openClassMenu === cls.id}
                      onClick={() => setOpenClassMenu(current => current === cls.id ? null : cls.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="5" cy="12" r="1.7"/>
                        <circle cx="12" cy="12" r="1.7"/>
                        <circle cx="19" cy="12" r="1.7"/>
                      </svg>
                    </button>
                    <div className="class-card-options" aria-label={`Thao tác lớp ${cls.classCode}`}>
                      {!isAdmin && (
                        <Link to={`/lecturer/classes/${cls.id}/create-exam`} onClick={() => setOpenClassMenu(null)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                          Tạo đề thi mới
                        </Link>
                      )}
                      {!isAdmin && (
                        <Link to={`/lecturer/classes/${cls.id}/import-students`} onClick={() => setOpenClassMenu(null)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Import sinh viên
                        </Link>
                      )}
                      {!isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setClassCode(cls.classCode);
                              setName(cls.name);
                              setSemester(cls.semester);
                              setEditingClass(cls);
                              setOpenClassMenu(null);
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Sửa thông tin lớp
                          </button>
                          <button
                            type="button"
                            className="class-option-danger"
                            disabled={(cls._count?.enrollments || 0) + (cls._count?.exams || 0) > 0}
                            title="Chỉ xóa lớp chưa có sinh viên hoặc đề thi"
                            onClick={() => { setPendingDeleteClass(cls); setOpenClassMenu(null); }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Xóa lớp
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <h3 className="lecturer-class-title" style={{ marginTop: '0.65rem' }}>
                  {cls.name}
                </h3>

                {isAdmin && cls.lecturer?.fullName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>Giảng viên: <strong>{cls.lecturer.fullName}</strong></span>
                  </div>
                )}

                {/* Metrics chips */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <span className="meta-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <strong>{cls._count?.enrollments || 0}</strong> sinh viên
                  </span>
                  <span className="meta-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="16 18 22 12 16 6"/>
                      <polyline points="8 6 2 12 8 18"/>
                    </svg>
                    <strong>{cls._count?.exams || 0}</strong> đề thi
                  </span>
                </div>
              </div>

              {/* Action buttons row */}
              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <Link
                  to={`/lecturer/classes/${cls.id}/exams`}
                  className="btn btn-primary"
                  style={{ flex: 1, textDecoration: 'none' }}
                >
                  Quản lý đề thi & Chấm →
                </Link>
                <Link
                  to={`/lecturer/classes/${cls.id}/students`}
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  Sinh viên
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!pendingDeleteClass}
        title="Xóa lớp học?"
        description={pendingDeleteClass ? `Xóa lớp ${pendingDeleteClass.classCode} (${pendingDeleteClass.name})? Chỉ lớp chưa có sinh viên hoặc đề thi mới được xóa.` : ''}
        confirmLabel="Xóa lớp"
        busy={deletingClass}
        onConfirm={handleDeleteClass}
        onCancel={() => setPendingDeleteClass(null)}
      />
    </div>
  );
};
