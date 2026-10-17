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
            <div className="app-account-actions">
              {user?.role === 'ADMIN' && <>
                <Link to="/admin" className="btn btn-secondary btn-sm">Tổng quan</Link>
                <Link to="/admin/users" className="btn btn-secondary btn-sm">Tài khoản</Link>
              </>}
              <span className="app-user-label">
                {user?.fullName} <span className="badge badge-blue">{user?.role}</span>
              </span>
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
