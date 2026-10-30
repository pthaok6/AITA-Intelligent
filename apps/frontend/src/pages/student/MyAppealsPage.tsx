import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { markAppealsAsSeen } from './appealNotifications';

const formatDate = (value: string) => {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'SUBMITTED':
      return <span className="badge badge-yellow">Chờ tiếp nhận</span>;
    case 'IN_REVIEW':
      return <span className="badge badge-blue">Đang xem xét</span>;
    case 'ACCEPTED':
      return <span className="badge badge-green">Đã chấp nhận</span>;
    case 'REJECTED':
      return <span className="badge badge-red">Đã từ chối</span>;
    default:
      return <span className="badge">{status}</span>;
  }
};

export const MyAppealsPage: React.FC = () => {
  const { user } = useAuth();
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [roundFilter, setRoundFilter] = useState<'ALL' | '1' | '2'>('ALL');

  const fetchAppeals = async () => {
    setLoading(true);
    const res = await apiRequest('/appeals/my');
    if (res.success && res.data) {
      setAppeals(res.data);
      if (user?.role === 'STUDENT') markAppealsAsSeen(res.data, user.id);
    } else {
      setError(res.message || 'Không thể tải danh sách khiếu nại.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppeals();
  }, [user?.id, user?.role]);

  const filteredAppeals = appeals.filter((appeal) => {
    if (filterStatus !== 'ALL' && appeal.status !== filterStatus) return false;
    if (roundFilter === '1' && (appeal.round === 2 || appeal.targetRole === 'ADMIN')) return false;
    if (roundFilter === '2' && !(appeal.round === 2 || appeal.targetRole === 'ADMIN')) return false;
    return true;
  });

  const countPending = appeals.filter(a => ['SUBMITTED', 'IN_REVIEW'].includes(a.status)).length;
  const countAccepted = appeals.filter(a => a.status === 'ACCEPTED').length;
  const countRejected = appeals.filter(a => a.status === 'REJECTED').length;

  return (
    <div className="container page-appeals" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/student" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Quay lại Dashboard Sinh viên
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Cổng Khiếu Nại & Phúc Khảo Điểm Số</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Theo dõi tiến trình phúc khảo 2 cấp độc lập: Lần 1 (Giảng viên) & Lần 2 (Ban Khảo thí)
          </p>
        </div>
      </div>

      {error && <p role="alert" style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</p>}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TỔNG SỐ KHIẾU NẠI</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem' }}>{appeals.length}</h3>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>ĐANG CHỜ XỬ LÝ</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem', color: '#fbbf24' }}>{countPending}</h3>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.8rem', color: '#34d399' }}>ĐÃ CHẤP NHẬN</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem', color: '#34d399' }}>{countAccepted}</h3>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '0.8rem', color: '#f87171' }}>TỪ CHỐI</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem', color: '#f87171' }}>{countRejected}</h3>
        </div>
      </div>

      {/* Filter Tabs by Status and Round */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`btn btn-sm ${filterStatus === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Tất cả ({appeals.length})
          </button>
          <button
            onClick={() => setFilterStatus('SUBMITTED')}
            className={`btn btn-sm ${filterStatus === 'SUBMITTED' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Chờ tiếp nhận ({appeals.filter(a => a.status === 'SUBMITTED').length})
          </button>
          <button
            onClick={() => setFilterStatus('IN_REVIEW')}
            className={`btn btn-sm ${filterStatus === 'IN_REVIEW' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Đang xem xét ({appeals.filter(a => a.status === 'IN_REVIEW').length})
          </button>
          <button
            onClick={() => setFilterStatus('ACCEPTED')}
            className={`btn btn-sm ${filterStatus === 'ACCEPTED' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Đã chấp nhận ({countAccepted})
          </button>
          <button
            onClick={() => setFilterStatus('REJECTED')}
            className={`btn btn-sm ${filterStatus === 'REJECTED' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Đã từ chối ({countRejected})
          </button>
        </div>

        {/* Round Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Cấp thẩm định:</span>
          <button
            onClick={() => setRoundFilter('ALL')}
            className={`btn btn-sm ${roundFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Tất cả
          </button>
          <button
            onClick={() => setRoundFilter('1')}
            className={`btn btn-sm ${roundFilter === '1' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Lần 1 (Giảng viên)
          </button>
          <button
            onClick={() => setRoundFilter('2')}
            className={`btn btn-sm ${roundFilter === '2' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Lần 2 (Khảo thí)
          </button>
        </div>
      </div>

      {loading ? (
        <p>Đang tải danh sách khiếu nại...</p>
      ) : filteredAppeals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>
            {filterStatus === 'ALL' && roundFilter === 'ALL'
              ? 'Bạn chưa gửi đơn khiếu nại điểm nào.'
              : 'Không có khiếu nại nào ở bộ lọc này.'}
          </p>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Để khiếu nại, bạn có thể vào trang kết quả của bài nộp tương ứng và chọn &quot;Gửi khiếu nại&quot;.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredAppeals.map((appeal) => (
            <div key={appeal.id} className="card" style={{ padding: '1.25rem 1.5rem', borderLeft: appeal.round === 2 || appeal.targetRole === 'ADMIN' ? '4px solid #f59e0b' : '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">{appeal.exam?.class?.classCode || 'LỚP'}</span>
                    <span className={`badge ${appeal.round === 2 || appeal.targetRole === 'ADMIN' ? 'badge-yellow' : 'badge-blue'}`} style={{ fontWeight: 600 }}>
                      {appeal.round === 2 || appeal.targetRole === 'ADMIN' ? 'Lần 2: Khảo thí (Admin)' : 'Lần 1: Giảng viên'}
                    </span>
                    <strong style={{ fontSize: '1.1rem' }}>{appeal.title}</strong>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Đề thi: <strong>{appeal.exam?.title}</strong> • Lần nộp #{appeal.submission?.attemptNumber} • Gửi lúc: {formatDate(appeal.createdAt)}
                  </p>
                </div>
                <div>{getStatusBadge(appeal.status)}</div>
              </div>

              {/* Reference to parent appeal (if round 2) */}
              {appeal.parentAppeal && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '0.35rem', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>Đối chiếu phúc khảo Lần 1: </span>
                  <span style={{ color: '#cbd5e1' }}>Giảng viên đã {appeal.parentAppeal.status === 'ACCEPTED' ? 'chấp thuận sửa điểm' : 'từ chối (giữ nguyên)'}</span>
                  {appeal.parentAppeal.newScore !== null && <span style={{ color: '#34d399', fontWeight: 'bold' }}> ({appeal.parentAppeal.newScore} điểm)</span>}
                  {appeal.parentAppeal.decisionReason && <span style={{ color: '#94a3b8' }}> — &quot;{appeal.parentAppeal.decisionReason}&quot;</span>}
                </div>
              )}

              {/* Score comparison */}
              <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>{appeal.round === 2 || appeal.targetRole === 'ADMIN' ? 'ĐIỂM SAU LẦN 1' : 'ĐIỂM GỐC AI CHẤM'}</span>
                  <strong style={{ fontSize: '1.1rem', color: '#e2e8f0' }}>{appeal.previousScore} điểm</strong>
                </div>
                {appeal.expectedScore !== null && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>ĐIỂM KỲ VỌNG</span>
                    <strong style={{ fontSize: '1.1rem', color: '#60a5fa' }}>{appeal.expectedScore} điểm</strong>
                  </div>
                )}
                {appeal.status === 'ACCEPTED' && appeal.newScore !== null && (
                  <div style={{ borderLeft: '2px solid #10b981', paddingLeft: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'block', fontWeight: 600 }}>ĐIỂM ĐIỀU CHỈNH CHÍNH THỨC</span>
                    <strong style={{ fontSize: '1.25rem', color: '#34d399' }}>{appeal.newScore} điểm</strong>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Lý do khiếu nại của bạn:</span>
                <p style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', color: '#cbd5e1', fontSize: '0.9rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: '0.35rem' }}>
                  {appeal.reason}
                </p>
              </div>

              {/* Decision reason */}
              {appeal.decisionReason && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: appeal.status === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.08)' : appeal.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)', borderRadius: '0.5rem', border: `1px solid ${appeal.status === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.3)' : appeal.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: appeal.status === 'ACCEPTED' ? '#34d399' : appeal.status === 'REJECTED' ? '#f87171' : '#60a5fa' }}>
                      Phản hồi từ {appeal.round === 2 || appeal.targetRole === 'ADMIN' ? 'Ban Khảo thí' : 'Giảng viên'} {appeal.resolvedBy ? `(${appeal.resolvedBy.fullName})` : ''}:
                    </span>
                    {appeal.resolvedAt && (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {formatDate(appeal.resolvedAt)}
                      </span>
                    )}
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#f1f5f9' }}>
                    {appeal.decisionReason}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <Link to={`/student/submissions/${appeal.submissionId}`} className="btn btn-secondary btn-sm">
                  Xem lại bài nộp này &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
