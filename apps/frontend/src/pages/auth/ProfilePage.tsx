import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  
  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification preferences (FR-PROF-001)
  const [notifyGrading, setNotifyGrading] = useState(true);
  const [notifyAppeals, setNotifyAppeals] = useState(true);
  const [notifyTeam, setNotifyTeam] = useState(true);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setAvatarUrl(user.avatarUrl || null);
      setAvatarPreview(user.avatarUrl || null);
    }
  }, [user]);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    // FR-PROF-002: Validate PNG/JPG smaller than 2 MB
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Định dạng ảnh không hợp lệ. Chỉ chấp nhận ảnh PNG hoặc JPG (FR-PROF-002).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Dung lượng ảnh vượt quá 2 MB. Vui lòng chọn ảnh nhỏ hơn 2 MB (FR-PROF-002).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!fullName.trim()) {
      setError('Họ và tên không được để trống.');
      return;
    }

    if (showPasswordChange && newPassword) {
      if (newPassword.length < 8) {
        setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Xác nhận mật khẩu mới không khớp.');
        return;
      }
      if (!currentPassword) {
        setError('Vui lòng nhập mật khẩu hiện tại để xác thực.');
        return;
      }
    }

    setLoading(true);
    const payload: Record<string, any> = {
      fullName: fullName.trim(),
      avatarUrl: avatarUrl,
    };

    if (showPasswordChange && newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    const res = await apiRequest<{ id: string; email: string; fullName: string; role: any; avatarUrl?: string }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (res.success && res.data) {
      setMessage('Cập nhật hồ sơ cá nhân thành công!');
      updateUser({
        fullName: res.data.fullName,
        avatarUrl: res.data.avatarUrl || null,
      });
      if (showPasswordChange) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordChange(false);
      }
    } else {
      setError(res.message || 'Không thể cập nhật hồ sơ cá nhân.');
    }
  };

  const backUrl = user?.role === 'ADMIN' ? '/admin' : user?.role === 'LECTURER' ? '/lecturer' : '/student';

  return (
    <div className="container" style={{ maxWidth: 760, paddingTop: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={backUrl} style={{ color: '#60a5fa', fontSize: '0.9rem' }}>
          ← Quay lại Trang chính
        </Link>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem' }}>
          <div>
            <h2>Hồ sơ người dùng (UC02)</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Quản lý thông tin cá nhân, ảnh đại diện và tùy chọn thông báo tài khoản
            </p>
          </div>
        </div>

        {message && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
            ✓ {message}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Avatar Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#1e293b',
                border: '2px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                color: '#94a3b8',
                flexShrink: 0,
              }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                fullName ? fullName.charAt(0).toUpperCase() : 'U'
              )}
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Ảnh đại diện (Avatar)
              </label>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Định dạng PNG hoặc JPG, dung lượng tối đa 2 MB (FR-PROF-002).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                  Chọn ảnh mới
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    style={{ display: 'none' }}
                    onChange={handleAvatarFile}
                  />
                </label>
                {avatarPreview && (
                  <button type="button" onClick={handleRemoveAvatar} className="btn btn-ghost-danger btn-sm">
                    Gỡ ảnh
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Readonly info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.875rem' }}>Địa chỉ Email (Trường cấp)</label>
              <input
                type="text"
                className="form-control"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.875rem' }}>Vai trò hệ thống (Role)</label>
              <div>
                <span className="badge badge-blue" style={{ fontSize: '0.9rem', padding: '0.45rem 0.85rem' }}>
                  {user?.role}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                  (Phân quyền quản trị định danh)
                </span>
              </div>
            </div>
          </div>

          {/* Editable Full Name */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.875rem' }}>Họ và tên hiển thị *</label>
            <input
              type="text"
              className="form-control"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={100}
              placeholder="Ví dụ: Nguyễn Văn An"
            />
          </div>

          {/* Notification Preferences (FR-PROF-001) */}
          <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Tùy chọn nhận thông báo (Notification Preferences)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifyGrading} onChange={(e) => setNotifyGrading(e.target.checked)} />
                Thông báo kết quả chấm điểm tự động bài nộp
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifyAppeals} onChange={(e) => setNotifyAppeals(e.target.checked)} />
                Thông báo tiến trình và kết quả giải quyết khiếu nại
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifyTeam} onChange={(e) => setNotifyTeam(e.target.checked)} />
                Thông báo phân công và bài nộp của nhóm bài tập lớn
              </label>
            </div>
          </div>

          {/* Password section */}
          <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Đổi mật khẩu</h4>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
              >
                {showPasswordChange ? 'Hủy đổi mật khẩu' : 'Đổi mật khẩu'}
              </button>
            </div>

            {showPasswordChange && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.85rem' }}>Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    className="form-control"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.85rem' }}>Mật khẩu mới (tối thiểu 8 ký tự)</label>
                  <input
                    type="password"
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    minLength={8}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.85rem' }}>Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    minLength={8}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Link to={backUrl} className="btn btn-secondary">
              Quay lại
            </Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu thay đổi hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
