import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';

type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'LECTURER' | 'ADMIN';
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
};

const emptyForm = {
  email: '',
  fullName: '',
  password: '',
  role: 'STUDENT' as ManagedUser['role'],
  isActive: true,
};

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState<ManagedUser | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'LECTURER' | 'ADMIN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'INACTIVE'>('ALL');

  const load = async () => {
    setLoading(true);
    const result = await apiRequest<ManagedUser[]>('/admin/users');
    if (result.success && result.data) {
      setUsers(result.data);
    } else {
      setMessage(result.message || 'Không tải được danh sách tài khoản.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    const result = editing
      ? await apiRequest(`/admin/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            email: form.email,
            fullName: form.fullName,
            role: form.role,
            isActive: form.isActive,
            ...(form.password ? { password: form.password } : {}),
          }),
        })
      : await apiRequest('/admin/users', {
          method: 'POST',
          body: JSON.stringify(form),
        });

    setBusy(false);
    if (!result.success) {
      setMessage(result.message || 'Không lưu được tài khoản.');
      return;
    }

    setForm(emptyForm);
    setEditing(null);
    setShowCreateForm(false);
    setMessage(editing ? 'Đã cập nhật thông tin tài khoản thành công.' : 'Đã tạo tài khoản mới thành công.');
    await load();
  };

  const startEdit = (account: ManagedUser) => {
    setEditing(account);
    setShowCreateForm(true);
    setForm({
      email: account.email,
      fullName: account.fullName,
      password: '',
      role: account.role,
      isActive: account.isActive,
    });
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const cancelForm = () => {
    setEditing(null);
    setShowCreateForm(false);
    setForm(emptyForm);
  };

  const deactivate = async () => {
    if (!pendingDeactivate) return;
    setDeactivating(true);
    const account = pendingDeactivate;
    const result = await apiRequest(`/admin/users/${account.id}`, { method: 'DELETE' });
    setDeactivating(false);
    setPendingDeactivate(null);
    setMessage(
      result.success
        ? `Đã vô hiệu hóa tài khoản ${account.fullName}; dữ liệu học tập vẫn được giữ lại.`
        : result.message || 'Không thể vô hiệu hóa tài khoản.'
    );
    if (result.success) await load();
  };

  const activate = async (account: ManagedUser) => {
    const result = await apiRequest(`/admin/users/${account.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    });
    setMessage(result.success ? `Đã kích hoạt lại tài khoản ${account.fullName}.` : result.message || 'Không thể kích hoạt tài khoản.');
    if (result.success) await load();
  };

  const approve = async (account: ManagedUser) => {
    const result = await apiRequest(`/admin/users/${account.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isApproved: true, isActive: true }),
    });
    setMessage(result.success ? `Đã phê duyệt tài khoản ${account.fullName}.` : result.message || 'Không thể duyệt tài khoản.');
    if (result.success) await load();
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && (!u.isActive || !u.isApproved)) return false;
      if (statusFilter === 'PENDING' && u.isApproved) return false;
      if (statusFilter === 'INACTIVE' && u.isActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = u.fullName.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Counts for KPI
  const countStudents = users.filter((u) => u.role === 'STUDENT').length;
  const countLecturers = users.filter((u) => u.role === 'LECTURER').length;
  const countAdmins = users.filter((u) => u.role === 'ADMIN').length;
  const countPending = users.filter((u) => !u.isApproved).length;

  return (
    <div className="container" style={{ maxWidth: 1200, paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to="/admin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại Tổng quan
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>
            Quản trị người dùng & Phân quyền
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Quản lý tài khoản hệ thống, cấp quyền truy cập và kiểm soát trạng thái phê duyệt tài khoản.
          </p>
        </div>

        {!showCreateForm && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setShowCreateForm(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm người dùng mới
          </button>
        )}
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
            Tổng số tài khoản
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
            {users.length}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <span style={{ fontSize: '0.75rem', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 600 }}>
            Sinh viên (Student)
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.25rem' }}>
            {countStudents}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #a855f7' }}>
          <span style={{ fontSize: '0.75rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 600 }}>
            Giảng viên (Lecturer)
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c084fc', marginTop: '0.25rem' }}>
            {countLecturers}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>
            Quản trị viên (Admin)
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
            {countAdmins}
          </div>
        </div>

        {countPending > 0 && (
          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444', background: 'rgba(239, 68, 68, 0.08)' }}>
            <span style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 600 }}>
              Chờ phê duyệt
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>
              {countPending}
            </div>
          </div>
        )}
      </div>

      {/* NOTICE MESSAGE */}
      {message && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1.15rem',
            borderRadius: 'var(--radius-control)',
            background: message.startsWith('Đã ')
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            border: message.startsWith('Đã ')
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : '1px solid rgba(239, 68, 68, 0.3)',
            color: message.startsWith('Đã ') ? '#34d399' : '#fca5a5',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          {message.startsWith('Đã ') ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          <span>{message}</span>
        </div>
      )}

      {/* CREATE / EDIT USER DRAWER CARD */}
      {showCreateForm && (
        <div
          className="card"
          style={{
            marginBottom: '1.75rem',
            border: editing ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-strong)',
            background: 'var(--surface-inset)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editing ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Cập nhật tài khoản: <span style={{ color: '#93c5fd' }}>{editing.fullName}</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  Tạo tài khoản người dùng mới
                </>
              )}
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={cancelForm}
              style={{ fontSize: '0.8rem' }}
            >
              Đóng form
            </button>
          </div>

          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Họ và tên *
                </label>
                <input
                  className="form-control"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Địa chỉ Email *
                </label>
                <input
                  className="form-control"
                  type="email"
                  required
                  placeholder="name@school.edu.vn"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  {editing ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu khởi tạo *'}
                </label>
                <input
                  className="form-control"
                  type="password"
                  minLength={8}
                  required={!editing}
                  placeholder={editing ? 'Nhập mật khẩu mới...' : 'Tối thiểu 8 ký tự'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Vai trò hệ thống *
                </label>
                <select
                  className="form-control"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as ManagedUser['role'] })}
                >
                  <option value="STUDENT">STUDENT (Sinh viên)</option>
                  <option value="LECTURER">LECTURER (Giảng viên)</option>
                  <option value="ADMIN">ADMIN (Quản trị viên)</option>
                </select>
              </div>
            </div>

            {editing && (
              <div style={{ marginBottom: '1.25rem', padding: '0.65rem 0.85rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-control)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="checkbox"
                  id="user-is-active"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="user-is-active" style={{ fontSize: '0.875rem', cursor: 'pointer', margin: 0 }}>
                  Tài khoản đang hoạt động (Được phép đăng nhập vào hệ thống)
                </label>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
              >
                {busy ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Đang lưu...
                  </>
                ) : editing ? (
                  'Lưu thay đổi'
                ) : (
                  'Tạo tài khoản'
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelForm}
              >
                Hủy bỏ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: '1 1 320px', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo họ tên hoặc email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.1rem', minHeight: '2.25rem', fontSize: '0.85rem' }}
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Role select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Vai trò:</span>
            <select
              className="form-control"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              style={{ padding: '0.35rem 0.65rem', minHeight: '2.25rem', fontSize: '0.85rem', width: 'auto' }}
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="STUDENT">Sinh viên</option>
              <option value="LECTURER">Giảng viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </div>

          {/* Status select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trạng thái:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ padding: '0.35rem 0.65rem', minHeight: '2.25rem', fontSize: '0.85rem', width: 'auto' }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="INACTIVE">Đã vô hiệu hóa</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Hiển thị <strong>{filteredUsers.length}</strong> / {users.length} người dùng
        </div>
      </div>

      {/* USERS TABLE CARD */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem' }}>
            <div className="skeleton-line" style={{ width: '40%' }} />
            <div className="skeleton-line" style={{ width: '90%', margin: '1rem 0' }} />
            <div className="skeleton-line" style={{ width: '70%' }} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state-box" style={{ border: 'none' }}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.8"
              style={{ marginBottom: '0.75rem' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.4rem' }}>
              Không tìm thấy tài khoản nào phù hợp
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
              Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại bộ lọc vai trò/trạng thái.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((account) => {
                  const isCurrent = account.id === currentUser?.id;
                  const initials = account.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(-2)
                    .toUpperCase();

                  return (
                    <tr key={account.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background:
                                account.role === 'ADMIN'
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : account.role === 'LECTURER'
                                  ? 'rgba(168, 85, 247, 0.2)'
                                  : 'rgba(59, 130, 246, 0.2)',
                              color:
                                account.role === 'ADMIN'
                                  ? '#fbbf24'
                                  : account.role === 'LECTURER'
                                  ? '#c084fc'
                                  : '#60a5fa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            {initials || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{account.fullName}</span>
                              {isCurrent && (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 600 }}>
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {account.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        {account.role === 'ADMIN' ? (
                          <span className="badge badge-yellow">ADMIN</span>
                        ) : account.role === 'LECTURER' ? (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#c084fc',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                            }}
                          >
                            LECTURER
                          </span>
                        ) : (
                          <span className="badge badge-blue">STUDENT</span>
                        )}
                      </td>

                      <td>
                        {!account.isApproved ? (
                          <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Chờ duyệt
                          </span>
                        ) : account.isActive ? (
                          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            Hoạt động
                          </span>
                        ) : (
                          <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                            Đã vô hiệu hóa
                          </span>
                        )}
                      </td>

                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(account.createdAt).toLocaleDateString('vi-VN')}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {!account.isApproved && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => void approve(account)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              Duyệt
                            </button>
                          )}

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEdit(account)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Sửa
                          </button>

                          {account.isApproved &&
                            (account.isActive ? (
                              <button
                                className="btn btn-ghost-danger btn-sm"
                                disabled={isCurrent}
                                title={isCurrent ? 'Không thể tự vô hiệu hóa tài khoản của chính bạn' : 'Vô hiệu hóa tài khoản'}
                                onClick={() => setPendingDeactivate(account)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                              >
                                Vô hiệu hóa
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => activate(account)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                              >
                                Kích hoạt
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDeactivate}
        title="Xác nhận vô hiệu hóa tài khoản?"
        description={
          pendingDeactivate
            ? `${pendingDeactivate.fullName} (${pendingDeactivate.email}) sẽ không thể đăng nhập vào hệ thống; các phiên làm việc hiện tại sẽ bị thu hồi. Tất cả bài nộp, điểm số và dữ liệu lịch sử vẫn được bảo toàn nguyên vẹn.`
            : ''
        }
        confirmLabel="Vô hiệu hóa tài khoản"
        busy={deactivating}
        onConfirm={deactivate}
        onCancel={() => setPendingDeactivate(null)}
      />
    </div>
  );
};
