import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface KeyItem {
  id: string;
  provider: 'gemini' | 'openai';
  maskedKey: string;
  isCustom: boolean;
  failures: number;
  cooldownUntil: number;
  isAvailable: boolean;
  status: 'ACTIVE' | 'COOLDOWN' | 'FAILED';
  cooldownRemainingSeconds: number;
  lastProbeStatus?: 'SUCCESS' | 'FAILED' | 'PENDING';
  lastProbeMessage?: string;
  lastUsedAt?: number;
  addedAt: number;
}

interface PoolData {
  gemini: KeyItem[];
  openai: KeyItem[];
  status: {
    gemini: { totalKeys: number; availableKeys: number };
    openai: { totalKeys: number; availableKeys: number };
  };
}

export const AdminAiKeysPage: React.FC = () => {
  const [data, setData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [provider, setProvider] = useState<'gemini' | 'openai'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [probeFirst, setProbeFirst] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Probe / Action state
  const [probingId, setProbingId] = useState<string | null>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<KeyItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadKeys = async () => {
    setLoading(true);
    const res = await apiRequest<PoolData>('/ai/admin/keys');
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.message || 'Không thể tải danh sách AI Key Pool.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadKeys();
    const interval = setInterval(() => {
      void loadKeys();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!apiKey.trim()) {
      setError('Vui lòng nhập API Key.');
      return;
    }
    setSubmitting(true);
    const res = await apiRequest('/ai/admin/keys', {
      method: 'POST',
      body: JSON.stringify({ provider, key: apiKey.trim(), probeFirst }),
    });
    setSubmitting(false);
    if (res.success) {
      setSuccess(`Thêm Key vào Pool ${provider.toUpperCase()} thành công!`);
      setApiKey('');
      await loadKeys();
    } else {
      setError(res.message || 'Không thể thêm Key.');
    }
  };

  const handleProbeKey = async (keyItem: KeyItem) => {
    setError('');
    setSuccess('');
    setProbingId(keyItem.id);
    const res = await apiRequest<{ success: boolean; message: string }>(`/ai/admin/keys/${keyItem.id}/probe`, {
      method: 'POST',
    });
    setProbingId(null);
    if (res.success && res.data) {
      if (res.data.success) {
        setSuccess(`[${keyItem.maskedKey}] ${res.data.message}`);
      } else {
        setError(`[${keyItem.maskedKey}] ${res.data.message}`);
      }
      await loadKeys();
    } else {
      setError(res.message || 'Lỗi khi kiểm tra kết nối.');
    }
  };

  const handleResetCooldown = async (keyItem: KeyItem) => {
    setError('');
    setSuccess('');
    const res = await apiRequest(`/ai/admin/keys/${keyItem.id}/reset`, { method: 'POST' });
    if (res.success) {
      setSuccess(`Đã reset trạng thái Cooldown cho key ${keyItem.maskedKey}.`);
      await loadKeys();
    } else {
      setError(res.message || 'Không thể reset key.');
    }
  };

  const handleDeleteKey = async () => {
    if (!pendingDeleteKey) return;
    setDeleting(true);
    const res = await apiRequest(`/ai/admin/keys/${pendingDeleteKey.id}`, { method: 'DELETE' });
    setDeleting(false);
    setPendingDeleteKey(null);
    if (res.success) {
      setSuccess('Đã xóa Key khỏi Pool.');
      await loadKeys();
    } else {
      setError(res.message || 'Không thể xóa Key.');
    }
  };

  const allKeys = [...(data?.gemini || []), ...(data?.openai || [])];

  return (
    <div className="container" style={{ maxWidth: 1200, paddingTop: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/admin" style={{ color: '#60a5fa', fontSize: '0.9rem' }}>
          ← Quay lại Tổng quan Quản trị
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Quản lý Xoay vòng AI API Key (UC14)</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Giám sát danh sách key, cơ chế xoay vòng Round-Robin và tự động Cooldown khi gặp lỗi HTTP 429 RateLimit (BR-04, FR-AI-004..007)
          </p>
        </div>
        <button onClick={() => void loadKeys()} className="btn btn-secondary btn-sm" disabled={loading}>
          {loading ? 'Đang cập nhật...' : '↻ Làm mới trạng thái'}
        </button>
      </div>

      {success && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
          ✓ {success}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
          ⚠ {error}
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ color: '#60a5fa', margin: 0 }}>Gemini Key Pool</h4>
            <span className="badge badge-blue">Google AI</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.5rem 0' }}>
            {data?.status.gemini.availableKeys || 0} / {data?.status.gemini.totalKeys || 0}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
            Key đang khả dụng và sẵn sàng phục vụ sinh đề thi / review mã nguồn
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ color: '#10b981', margin: 0 }}>OpenAI Key Pool</h4>
            <span className="badge badge-green">OpenAI</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.5rem 0' }}>
            {data?.status.openai.availableKeys || 0} / {data?.status.openai.totalKeys || 0}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
            Key dự phòng khi Gemini quá tải hoặc lỗi định dạng
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ color: '#f59e0b', margin: 0 }}>Chính sách xoay vòng</h4>
            <span className="badge badge-yellow">BR-04 Active</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0.5rem 0' }}>
            • Round-Robin phân phối đều tải<br />
            • Cooldown 24h khi gặp HTTP 429 RateLimit<br />
            • Tự động fallback sang Intelligent Local
          </p>
        </div>
      </div>

      {/* Form Add Key */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Thêm API Key mới vào Rotation Pool</h3>
        <form onSubmit={handleAddKey} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem' }}>Nhà cung cấp (Provider)</label>
            <select
              className="form-control"
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
            >
              <option value="gemini">Google Gemini (Khuyên dùng)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-3.5)</option>
            </select>
          </div>

          <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem' }}>API Key bí mật</label>
            <input
              type="password"
              className="form-control"
              placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-proj-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={probeFirst}
                onChange={(e) => setProbeFirst(e.target.checked)}
              />
              Probe kiểm tra kết nối ngay (Lightweight probe)
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Đang kiểm tra & thêm...' : '+ Thêm Key vào Pool'}
            </button>
          </div>
        </form>
      </div>

      {/* Table of Keys */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Danh sách Key trong Pool ({allKeys.length})</h3>
        {loading && !data ? (
          <p>Đang tải dữ liệu key...</p>
        ) : allKeys.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Chưa có API key nào trong hệ thống.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nhà cung cấp</th>
                  <th>Masked Key</th>
                  <th>Nguồn</th>
                  <th>Trạng thái</th>
                  <th>Lỗi tích lũy</th>
                  <th>Probe gần nhất</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {allKeys.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`badge ${item.provider === 'gemini' ? 'badge-blue' : 'badge-green'}`}>
                        {item.provider.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <code style={{ background: '#1e293b', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', color: '#f1f5f9' }}>
                        {item.maskedKey}
                      </code>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {item.isCustom ? 'Thêm qua UI' : 'Môi trường (.env)'}
                      </span>
                    </td>
                    <td>
                      {item.status === 'ACTIVE' && (
                        <span className="badge badge-green">Hoạt động (Active)</span>
                      )}
                      {item.status === 'COOLDOWN' && (
                        <span className="badge badge-yellow" title={`Còn ${item.cooldownRemainingSeconds}s`}>
                          Cooldown ({item.cooldownRemainingSeconds}s)
                        </span>
                      )}
                      {item.status === 'FAILED' && (
                        <span className="badge badge-red">Lỗi liên tục</span>
                      )}
                    </td>
                    <td>{item.failures} lần</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: item.lastProbeStatus === 'SUCCESS' ? '#34d399' : '#f87171' }}>
                        {item.lastProbeMessage || 'Chưa kiểm tra'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={probingId === item.id}
                          onClick={() => void handleProbeKey(item)}
                          title="Kiểm tra kết nối trực tiếp đến nhà cung cấp"
                        >
                          {probingId === item.id ? 'Đang test...' : 'Test Probe'}
                        </button>
                        {item.status !== 'ACTIVE' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void handleResetCooldown(item)}
                            title="Xóa thời gian chờ cooldown"
                          >
                            Reset
                          </button>
                        )}
                        {item.isCustom && (
                          <button
                            type="button"
                            className="btn btn-ghost-danger btn-sm"
                            onClick={() => setPendingDeleteKey(item)}
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteKey}
        title="Xóa API Key khỏi Pool?"
        description={pendingDeleteKey ? `Bạn có chắc muốn xóa key ${pendingDeleteKey.maskedKey} (${pendingDeleteKey.provider.toUpperCase()}) khỏi vòng xoay không?` : ''}
        confirmLabel="Xóa Key"
        busy={deleting}
        onConfirm={handleDeleteKey}
        onCancel={() => setPendingDeleteKey(null)}
      />
    </div>
  );
};
