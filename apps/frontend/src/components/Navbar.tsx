import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    setLogoutError('');
    if (await logout()) navigate('/login');
    else setLogoutError('Đăng xuất chưa thành công. Vui lòng thử lại.');
  };

  return (
    <header style={{ background: '#111827', borderBottom: '1px solid #1f2937', padding: '0.8rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#60a5fa', textDecoration: 'none' }}>
            ⚡ AITA Platform
          </Link>
          {isAuthenticated && (
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              {user?.role === 'ADMIN' ? 'Quản trị Portal' : user?.role === 'LECTURER' ? 'Giảng viên Portal' : 'Sinh viên Portal'}
            </span>
          )}
        </div>

        <div>
          {logoutError && <p role="alert">{logoutError}</p>}
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {user?.role === 'ADMIN' && <Link to="/admin/users" className="btn btn-secondary btn-sm">Quản lý tài khoản</Link>}
              <span style={{ fontSize: '0.875rem' }}>
                {user?.fullName} <span className="badge badge-blue">{user?.role}</span>
              </span>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                Đăng xuất
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/login" className="btn btn-secondary btn-sm">Đăng nhập</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Đăng ký</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
