import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export const LecturerDashboard: React.FC = () => {
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

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Quản lý Lớp học & Đề thi</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Xem danh sách lớp học và quản lý bài kiểm tra thực hành</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link to="/lecturer/appeals" className="btn btn-secondary">
             Hộp thư khiếu nại
          </Link>
          <button onClick={() => { setClassCode(''); setName(''); setSemester('SU26'); setShowCreateModal(true); }} className="btn btn-primary">
            + Tạo lớp học mới
          </button>
        </div>
      </div>
      {error && <p role="alert" style={{ color: '#fca5a5', marginBottom: '1rem' }}>{error}</p>}

      {(showCreateModal || editingClass) && (
        <div className="form-modal-overlay">
          <div className="card form-modal-panel">
            <h3 style={{ marginBottom: '1rem' }}>{editingClass ? 'Cập nhật lớp học' : 'Tạo Lớp Học Mới'}</h3>
            {error && <p role="alert" style={{ color: '#fca5a5', marginBottom: '1rem' }}>{error}</p>}
            <form onSubmit={editingClass ? handleUpdateClass : handleCreateClass}>
              <div className="form-group">
                <label>Mã lớp (Class Code)</label>
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
                <label>Tên môn học</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Kỹ nghệ phần mềm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Học kỳ</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="SU26"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => { setShowCreateModal(false); setEditingClass(null); }} className="btn btn-secondary">Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Xác nhận tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p>Đang tải dữ liệu lớp học...</p>
      ) : classes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Bạn chưa có lớp học nào.</p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">+ Tạo lớp đầu tiên</button>
        </div>
      ) : (
        <div className="lecturer-class-list">
          {classes.map((cls) => (
            <div key={cls.id} className="card lecturer-class-card">
              <div className="lecturer-class-heading">
                <span className="badge badge-blue">{cls.classCode}</span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Học kỳ: {cls.semester}</span>
              </div>
              <h3 className="lecturer-class-title">{cls.name}</h3>
              <p className="lecturer-class-counts">
                Số sinh viên: {cls._count?.enrollments || 0} • Đề thi: {cls._count?.exams || 0}
              </p>
              <div className={`class-card-actions${openClassMenu === cls.id ? ' is-open' : ''}`}>
                <button type="button" className="class-menu-trigger" aria-label={`Tùy chọn lớp ${cls.classCode}`} aria-expanded={openClassMenu === cls.id} onClick={() => setOpenClassMenu(current => current === cls.id ? null : cls.id)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
                </button>
                <div className="class-card-options" aria-label={`Thao tác lớp ${cls.classCode}`}>
                  <Link to={`/lecturer/classes/${cls.id}/import-students`} onClick={() => setOpenClassMenu(null)}>Import sinh viên</Link>
                  <Link to={`/lecturer/classes/${cls.id}/students`} onClick={() => setOpenClassMenu(null)}>Danh sách sinh viên</Link>
                  <Link to={`/lecturer/classes/${cls.id}/create-exam`} onClick={() => setOpenClassMenu(null)}>Tạo đề thi</Link>
                  <Link to={`/lecturer/classes/${cls.id}/exams`} onClick={() => setOpenClassMenu(null)}>Danh sách đề</Link>
                  <button type="button" onClick={() => { setClassCode(cls.classCode); setName(cls.name); setSemester(cls.semester); setEditingClass(cls); setOpenClassMenu(null); }}>Sửa lớp</button>
                  <button type="button" className="class-option-danger" disabled={(cls._count?.enrollments || 0) + (cls._count?.exams || 0) > 0} title="Chỉ xóa lớp chưa có sinh viên hoặc đề thi" onClick={() => { setPendingDeleteClass(cls); setOpenClassMenu(null); }}>Xóa lớp</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!pendingDeleteClass} title="Xóa lớp học?" description={pendingDeleteClass ? `Xóa lớp ${pendingDeleteClass.classCode} (${pendingDeleteClass.name})? Chỉ lớp chưa có sinh viên hoặc đề thi mới được xóa.` : ''} confirmLabel="Xóa lớp" busy={deletingClass} onConfirm={handleDeleteClass} onCancel={() => setPendingDeleteClass(null)} />
    </div>
  );
};
