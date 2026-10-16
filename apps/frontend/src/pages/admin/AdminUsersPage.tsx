import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';

type ManagedUser = { id: string; email: string; fullName: string; role: 'STUDENT' | 'LECTURER' | 'ADMIN'; isActive: boolean; isApproved: boolean; createdAt: string };
const emptyForm = { email: '', fullName: '', password: '', role: 'STUDENT' as ManagedUser['role'], isActive: true };

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState<ManagedUser | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await apiRequest<ManagedUser[]>('/admin/users');
    if (result.success && result.data) setUsers(result.data);
    else setMessage(result.message || 'Không tải được danh sách tài khoản.');
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    const result = editing
      ? await apiRequest(`/admin/users/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ email: form.email, fullName: form.fullName, role: form.role, isActive: form.isActive, ...(form.password ? { password: form.password } : {}) }) })
      : await apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(form) });
    setBusy(false);
    if (!result.success) { setMessage(result.message || 'Không lưu được tài khoản.'); return; }
    setForm(emptyForm); setEditing(null); setMessage('Đã lưu tài khoản.'); await load();
  };

  const startEdit = (account: ManagedUser) => {
    setEditing(account); setForm({ email: account.email, fullName: account.fullName, password: '', role: account.role, isActive: account.isActive });
  };

  const deactivate = async () => {
    if (!pendingDeactivate) return;
    setDeactivating(true);
    const account = pendingDeactivate;
    const result = await apiRequest(`/admin/users/${account.id}`, { method: 'DELETE' });
    setDeactivating(false); setPendingDeactivate(null);
    setMessage(result.success ? 'Đã vô hiệu hóa tài khoản; dữ liệu học tập được giữ lại.' : result.message || 'Không thể vô hiệu hóa tài khoản.');
    if (result.success) await load();
  };

  const activate = async (account: ManagedUser) => {
    const result = await apiRequest(`/admin/users/${account.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) });
    setMessage(result.success ? 'Đã kích hoạt lại tài khoản.' : result.message || 'Không thể kích hoạt tài khoản.');
    if (result.success) await load();
  };

  const approve = async (account: ManagedUser) => {
    const result = await apiRequest(`/admin/users/${account.id}`, { method: 'PATCH', body: JSON.stringify({ isApproved: true, isActive: true }) });
    setMessage(result.success ? 'Đã duyệt tài khoản.' : result.message || 'Không thể duyệt tài khoản.');
    if (result.success) await load();
  };

  return <div className="container" style={{ maxWidth: 1200 }}>
    <div style={{ marginBottom: '1rem' }}><Link to="/admin">← Quay lại Tổng quan</Link></div>
    <div style={{ marginBottom: '1.5rem' }}>
      <h2>Quản lý tài khoản</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Tạo tài khoản, phân vai trò và quản lý trạng thái truy cập. Dữ liệu học tập được giữ lại khi vô hiệu hóa tài khoản.</p>
    </div>
    {message && <p role="status" style={{ color: message.startsWith('Đã ') ? '#34d399' : '#fca5a5' }}>{message}</p>}
    <div className="card" style={{ margin: '1rem 0' }}>
      <h3>{editing ? 'Cập nhật tài khoản' : 'Tạo tài khoản'}</h3>
      <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div className="form-group"><label>Email</label><input className="form-control" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div className="form-group"><label>Họ tên</label><input className="form-control" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
        {!editing && <div className="form-group"><label>Mật khẩu ban đầu</label><input className="form-control" type="password" minLength={8} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>}
        {editing && <div className="form-group"><label>Đặt mật khẩu mới (không bắt buộc)</label><input className="form-control" type="password" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>}
        <div className="form-group"><label>Vai trò</label><select className="form-control" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as ManagedUser['role'] })}><option value="STUDENT">STUDENT</option><option value="LECTURER">LECTURER</option><option value="ADMIN">ADMIN</option></select></div>
        {editing && <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />Đang hoạt động</label>}
        <div style={{ display: 'flex', gap: '0.5rem' }}><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button>{editing && <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setForm(emptyForm); }}>Hủy</button>}</div>
      </form>
    </div>
    <div className="card">
      {loading ? <p>Đang tải…</p> : <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
        {users.map(account => <tr key={account.id}><td>{account.fullName}</td><td>{account.email}</td><td><span className="badge badge-blue">{account.role}</span></td><td><span className={`badge ${!account.isApproved ? 'badge-yellow' : account.isActive ? 'badge-green' : 'badge-red'}`}>{!account.isApproved ? 'Chờ duyệt' : account.isActive ? 'Hoạt động' : 'Đã vô hiệu hóa'}</span></td><td>{new Date(account.createdAt).toLocaleDateString('vi-VN')}</td><td style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>{!account.isApproved && <button className="btn btn-primary btn-sm" onClick={() => void approve(account)}>Duyệt</button>}<button className="btn btn-secondary btn-sm" onClick={() => startEdit(account)}>Sửa</button>{account.isApproved && (account.isActive ? <button className="btn btn-ghost-danger btn-sm" disabled={account.id === currentUser?.id} onClick={() => setPendingDeactivate(account)}>Vô hiệu hóa</button> : <button className="btn btn-secondary btn-sm" onClick={() => activate(account)}>Kích hoạt</button>)}</td></tr>)}
      </tbody></table></div>}
    </div>
    <ConfirmDialog open={!!pendingDeactivate} title="Vô hiệu hóa tài khoản?" description={pendingDeactivate ? `${pendingDeactivate.fullName} (${pendingDeactivate.email}) sẽ không thể đăng nhập; các phiên hiện tại bị thu hồi. Bài nộp và dữ liệu lớp học vẫn được giữ.` : ''} confirmLabel="Vô hiệu hóa" busy={deactivating} onConfirm={deactivate} onCancel={() => setPendingDeactivate(null)} />
  </div>;
};
