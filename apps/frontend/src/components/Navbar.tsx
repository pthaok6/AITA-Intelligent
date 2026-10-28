import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NotificationBell } from './NotificationBell';

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
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-brand-group">
          <Link to="/" className="app-brand">
             AITA Platform
          </Link>
          {isAuthenticated && (
            <span className="app-role-label">
              {user?.role === 'ADMIN' ? 'Quản trị Portal' : user?.role === 'LECTURER' ? 'Giảng viên Portal' : 'Sinh viên Portal'}
            </span>
          )}
        </div>

        <div className="app-header-actions">
          {logoutError && <p role="alert">{logoutError}</p>}
          {isAuthenticated ? (
            <div className="app-account-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {user?.role === 'ADMIN' && (
                <>
                  <Link to="/admin" className="btn btn-secondary btn-sm">Tổng quan</Link>
                  <Link to="/admin/users" className="btn btn-secondary btn-sm">Tài khoản</Link>
                  <Link to="/admin/ai-keys" className="btn btn-secondary btn-sm" title="Quản lý xoay vòng AI API Key (UC14)">
                    AI Keys
                  </Link>
                </>
              )}

              {/* UC23: Real-time In-App Notification Center */}
              <NotificationBell />

              {/* UC02: User Profile Link & Avatar */}
              <Link
                to="/profile"
                className="btn btn-secondary btn-sm"
                title="Quản lý hồ sơ cá nhân (UC02)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Avatar"
                    style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#3b82f6',
                      color: '#fff',
                      fontSize: '0.7rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                    }}
                  >
                    {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
                <span>{user?.fullName}</span>
                <span className="badge badge-blue">{user?.role}</span>
              </Link>

              <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="app-account-actions">
              <Link to="/login" className="btn btn-secondary btn-sm">Đăng nhập</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Đăng ký</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
