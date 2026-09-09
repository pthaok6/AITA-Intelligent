import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export const LecturerDashboard: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [name, setName] = useState('');
  const [semester, setSemester] = useState('SU26');
  const [submitting, setSubmitting] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    const res = await apiRequest('/classes');
    if (res.success && res.data) {
      setClasses(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
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
      alert(res.message || 'Lỗi khi tạo lớp');
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Quản lý Lớp học & Đề thi</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Xem danh sách lớp học và quản lý bài kiểm tra thực hành</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          + Tạo lớp học mới
        </button>
      </div>

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Tạo Lớp Học Mới</h3>
            <form onSubmit={handleCreateClass}>
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
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Hủy</button>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {classes.map((cls) => (
            <div key={cls.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span className="badge badge-blue">{cls.classCode}</span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Học kỳ: {cls.semester}</span>
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{cls.name}</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
                Số sinh viên: {cls._count?.enrollments || 0} • Đề thi: {cls._count?.exams || 0}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Link to={`/lecturer/classes/${cls.id}/create-exam`} className="btn btn-primary" style={{ flex: 1 }}>
                  + Tạo đề thi
                </Link>
                <Link to={`/lecturer/classes/${cls.id}/exams`} className="btn btn-secondary">
                  Danh sách đề
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
