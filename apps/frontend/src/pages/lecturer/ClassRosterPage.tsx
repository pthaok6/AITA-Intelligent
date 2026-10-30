import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export const ClassRosterPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [cls, setClass] = useState<any>(null);
  const [error, setError] = useState('');
  const [pendingDrop, setPendingDrop] = useState<any>(null);
  const [dropping, setDropping] = useState(false);
  const load = async () => { const result = await apiRequest(`/classes/${classId}`); if (result.success) { setClass(result.data); setError(''); } else setError(result.message || 'Không tải được danh sách lớp.'); };
  useEffect(() => { void load(); }, [classId]);
  const drop = async () => {
    if (!pendingDrop) return;
    setDropping(true);
    const result = await apiRequest(`/classes/${classId}/students/${pendingDrop.id}`, { method: 'DELETE' });
    setDropping(false); setPendingDrop(null);
    if (!result.success) setError(result.message || 'Không cập nhật được danh sách.'); else await load();
  };
  const reactivate = async (student: any) => {
    const result = await apiRequest(`/classes/${classId}/students/${student.id}`, { method: 'PATCH' });
    if (!result.success) setError(result.message || 'Không thể ghi danh sinh viên.'); else await load();
  };
  return <div className="container">
    <div style={{ marginBottom: '1.25rem' }}><Link to="/lecturer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Quay lại lớp học</Link></div>
    <h2>{cls ? `Danh sách sinh viên: ${cls.name}` : 'Danh sách sinh viên'}</h2>
    {cls && <p>Mã lớp: {cls.classCode} · Học kỳ: {cls.semester}</p>}
    {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
    {cls && <div className="card"><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}><h3>Sinh viên ({cls.enrollments.filter((item: any) => item.status === 'ACTIVE').length} đang học)</h3><Link className="btn btn-primary" to={`/lecturer/classes/${classId}/import-students`}>Import Excel</Link></div>
      <table className="table"><thead><tr><th>Họ tên</th><th>Email</th><th>Thao tác</th></tr></thead><tbody>{cls.enrollments.map((enrollment: any) => <tr key={enrollment.studentId}><td>{enrollment.student.fullName}</td><td>{enrollment.student.email}</td><td style={{ display: 'flex', gap: '0.5rem' }}>{enrollment.status === 'DROPPED' && <button className="btn btn-secondary btn-sm" onClick={() => reactivate(enrollment.student)}>Ghi danh lại</button>}<button className="btn btn-ghost-danger btn-sm" onClick={() => setPendingDrop(enrollment.student)}>Xóa khỏi lớp</button></td></tr>)}</tbody></table>
    </div>}
    <ConfirmDialog open={!!pendingDrop} title="Xóa sinh viên khỏi lớp?" description={pendingDrop ? `Ghi danh của ${pendingDrop.fullName} sẽ bị xóa khỏi lớp. Tài khoản sinh viên và lịch sử bài nộp vẫn được giữ lại.` : ''} confirmLabel="Xóa khỏi lớp" busy={dropping} onConfirm={drop} onCancel={() => setPendingDrop(null)} />
  </div>;
};
