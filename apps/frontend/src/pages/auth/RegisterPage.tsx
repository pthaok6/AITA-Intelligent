import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'LECTURER' | 'STUDENT'>('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, fullName, password, role }),
    });

    setLoading(false);
    if (res.success && res.data) {
      login(res.data.token, res.data.user);
      if (role === 'LECTURER') {
        navigate('/lecturer');
      } else {
        navigate('/student');
      }
    } else {
      setError(res.message || 'Đăng ký thất bại');
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '3rem auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Tạo tài khoản AITA</h2>
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Họ và tên</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email FPT</label>
            <input
              type="email"
              className="form-control"
              placeholder="ten@fpt.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Mật khẩu</label>
            <input
              type="password"
              className="form-control"
              placeholder="Tối thiểu 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Vai trò hệ thống</label>
            <select className="form-control" value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="STUDENT">Sinh viên (Nộp bài & Xem điểm)</option>
              <option value="LECTURER">Giảng viên (Tạo lớp & Đề thi)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Đang tạo...' : 'Đăng ký'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: '#94a3b8' }}>
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
};
