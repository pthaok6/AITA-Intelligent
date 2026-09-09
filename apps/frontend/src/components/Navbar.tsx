import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
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
              {user?.role === 'LECTURER' ? 'Giảng viên Portal' : 'Sinh viên Portal'}
            </span>
          )}
        </div>

        <div>
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.875rem' }}>
                {user?.fullName} <span className="badge badge-blue">{user?.role}</span>
              </span>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem' }}>
                Đăng xuất
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/login" className="btn btn-secondary">Đăng nhập</Link>
              <Link to="/register" className="btn btn-primary">Đăng ký</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
