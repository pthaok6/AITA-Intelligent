import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleSignIn } from '../../components/GoogleSignIn';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [demoError, setDemoError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
    });

    setLoading(false);
    if (res.success && res.data) {
      login(res.data.token, res.data.user, res.data.refreshToken);
      navigate(
        res.data.user.role === 'ADMIN'
          ? '/admin'
          : res.data.user.role === 'LECTURER'
          ? '/lecturer'
          : '/student',
        { replace: true }
      );
    } else {
      setError(res.message || 'Email hoặc mật khẩu không chính xác.');
    }
  };

  const demoAccounts = [
    { label: 'Admin Test', key: 'admin', email: 'admin.test@fpt.edu.vn' },
    { label: 'Lecturer Test', key: 'lecturer', email: 'lecturer.test@fpt.edu.vn' },
    { label: 'Student Test', key: 'student', email: 'student.test@fpt.edu.vn' },
  ];

  const loginDemo = async (key: string, demoEmail: string) => {
    setBusyEmail(demoEmail);
    setDemoError('');
    const result = await apiRequest('/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ account: key }),
    });
    setBusyEmail(null);
    if (!result.success || !result.data) {
      setDemoError(result.message || 'Không thể đăng nhập tài khoản demo.');
      return;
    }
    login(result.data.token, result.data.user, result.data.refreshToken);
    navigate(
      result.data.user.role === 'ADMIN'
        ? '/admin'
        : result.data.user.role === 'LECTURER'
        ? '/lecturer'
        : '/student',
      { replace: true }
    );
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto', padding: '0 1rem' }}>
      <div
        className="card"
        style={{
          padding: '2.25rem 2rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.12)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 0.35rem 0', fontWeight: 700 }}>Đăng nhập AITA</h2>
          <p
            style={{
              margin: 0,
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '0.875rem',
            }}
          >
            Hệ thống Đánh giá & Chấm mã nguồn Tự động
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#f87171',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {/* 1. Standard Email & Password Form */}
        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email FPT / FE</label>
            <input
              type="email"
              className="form-control"
              placeholder="VD: admin.test@fpt.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Nhập mật khẩu (Mặc định: AitaTest@123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Điền nhanh:</span>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { setEmail('admin.test@fpt.edu.vn'); setPassword('AitaTest@123'); }}>Admin</button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { setEmail('lecturer.test@fpt.edu.vn'); setPassword('AitaTest@123'); }}>Lecturer</button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { setEmail('student.test@fpt.edu.vn'); setPassword('AitaTest@123'); }}>Student</button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.65rem', fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>

        {/* 2. Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '1.5rem 0 1.25rem',
            color: 'var(--text-muted, #64748b)',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--border, rgba(255,255,255,0.1))' }} />
          <span style={{ padding: '0 0.75rem', letterSpacing: '0.05em' }}>HOẶC TIẾP TỤC VỚI</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border, rgba(255,255,255,0.1))' }} />
        </div>

        {/* 3. Google SSO */}
        <GoogleSignIn />

        {/* 4. Quick Demo Login for Local Development */}
        {import.meta.env.DEV && (
          <section
            aria-label="Đăng nhập nhanh tài khoản demo"
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border, rgba(255,255,255,0.1))',
              textAlign: 'left',
            }}
          >
            <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.35rem 0', color: '#f8fafc' }}>
              Đăng nhập nhanh 1-Click (Demo Local)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '0 0 0.75rem 0' }}>
              Bấm tài khoản mẫu bên dưới để vào thẳng hệ thống:
            </p>
            {demoError && (
              <p role="alert" style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                {demoError}
              </p>
            )}
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyEmail !== null}
                  onClick={() => void loginDemo(account.key, account.email)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {busyEmail === account.email ? 'Đang vào…' : account.label}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{account.email}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
            fontSize: '0.78rem',
            color: '#64748b',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Hệ thống AITA quản lý người dùng theo danh sách lớp học. Tài khoản demo dùng mật khẩu: <code>AitaTest@123</code>.
        </div>
      </div>
    </div>
  );
};
