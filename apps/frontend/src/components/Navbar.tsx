import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getUnreadAppealInboxCount } from '../pages/student/appealNotifications';

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutError, setLogoutError] = useState('');
  const [unreadAppealCount, setUnreadAppealCount] = useState(0);

  useEffect(() => {
    if (!user || (user.role !== 'LECTURER' && user.role !== 'ADMIN')) {
      setUnreadAppealCount(0);
      return;
    }
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
  }, [user?.id, user?.role, location.pathname]);

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
                <Link to="/admin/appeals" className="btn btn-secondary btn-sm">Khiếu nại{unreadAppealCount > 0 && <span className="notification-count" aria-label={`${unreadAppealCount} đơn mới`}>{unreadAppealCount > 99 ? '99+' : unreadAppealCount}</span>}</Link>
                <Link to="/admin/users" className="btn btn-secondary btn-sm">Tài khoản</Link>
              </>}
              {user?.role === 'LECTURER' && <Link to="/lecturer/appeals" className="btn btn-secondary btn-sm">
                Khiếu nại{unreadAppealCount > 0 && <span className="notification-count" aria-label={`${unreadAppealCount} đơn mới`}>{unreadAppealCount > 99 ? '99+' : unreadAppealCount}</span>}
              </Link>}
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
