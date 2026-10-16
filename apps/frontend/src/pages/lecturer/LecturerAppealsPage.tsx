import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

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
      return <span className="badge badge-green">Đã chấp thuận</span>;
    case 'REJECTED':
      return <span className="badge badge-red">Đã từ chối</span>;
    default:
      return <span className="badge">{status}</span>;
  }
};

export const LecturerAppealsPage: React.FC = () => {
  const { user } = useAuth();
  const dashboardPath = user?.role === 'ADMIN' ? '/admin' : '/lecturer';
  const dashboardLabel = user?.role === 'ADMIN' ? 'Quay lại Tổng quan' : 'Quay lại Dashboard Giảng viên';
  const [appeals, setAppeals] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Resolution Modal State
  const [activeAppeal, setActiveAppeal] = useState<any | null>(null);
  const [resolveAction, setResolveAction] = useState<'IN_REVIEW' | 'ACCEPTED' | 'REJECTED'>('IN_REVIEW');
  const [newScore, setNewScore] = useState<string>('');
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [submittingResolve, setSubmittingResolve] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchClasses = async () => {
    const res = await apiRequest('/classes');
    if (res.success && res.data) {
      setClasses(res.data);
    }
  };

  const fetchAppeals = async () => {
    setLoading(true);
    let url = '/appeals/lecturer?';
    if (statusFilter && statusFilter !== 'ALL') url += `status=${statusFilter}&`;
    if (selectedClassId) url += `classId=${selectedClassId}&`;

    const res = await apiRequest(url);
    if (res.success && res.data) {
      setAppeals(res.data);
    } else {
      setError(res.message || 'Không thể tải danh sách khiếu nại.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchAppeals();
  }, [statusFilter, selectedClassId]);

  const handleOpenResolveModal = (appeal: any) => {
    setActiveAppeal(appeal);
    setResolveAction(appeal.status === 'SUBMITTED' ? 'IN_REVIEW' : appeal.status);
    setNewScore(appeal.newScore !== null ? String(appeal.newScore) : String(appeal.previousScore));
    setDecisionReason(appeal.decisionReason || '');
    setModalError('');
  };

  const handleSubmitResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppeal) return;
    setModalError('');

    if (resolveAction === 'ACCEPTED') {
      const scoreNum = Number(newScore);
      if (isNaN(scoreNum) || scoreNum < 0) {
        setModalError('Vui lòng nhập điểm mới hợp lệ (số không âm).');
        return;
      }
      if (!decisionReason.trim()) {
        setModalError('Vui lòng nhập nhận xét/lý do chấp thuận điều chỉnh điểm.');
        return;
      }
    } else if (resolveAction === 'REJECTED') {
      if (!decisionReason.trim()) {
        setModalError('Vui lòng nhập lý do từ chối khiếu nại để sinh viên nắm rõ.');
        return;
      }
    }

    setSubmittingResolve(true);

    const body: any = {
      status: resolveAction,
      decisionReason: decisionReason.trim(),
    };
    if (resolveAction === 'ACCEPTED') {
      body.newScore = Number(newScore);
    }

    const res = await apiRequest(`/appeals/${activeAppeal.id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    setSubmittingResolve(false);

    if (res.success) {
      setSuccessNotice(`Đã giải quyết khiếu nại của sinh viên ${activeAppeal.student?.fullName || ''} thành công.`);
      setActiveAppeal(null);
      fetchAppeals();
    } else {
      setModalError(res.message || 'Lỗi khi giải quyết khiếu nại.');
    }
  };

  const countPending = appeals.filter(a => a.status === 'SUBMITTED').length;
  const countInReview = appeals.filter(a => a.status === 'IN_REVIEW').length;
  const countAccepted = appeals.filter(a => a.status === 'ACCEPTED').length;
  const countRejected = appeals.filter(a => a.status === 'REJECTED').length;

  return (
    <div className="container page-appeals" style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={dashboardPath}>← {dashboardLabel}</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Hộp Thư Giải Quyết Khiếu Nại Điểm</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Xem xét các yêu cầu phúc khảo bài thi từ sinh viên và cập nhật điểm số chính thức
          </p>
        </div>
      </div>

      {error && <p role="alert" style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</p>}
      {successNotice && (
        <div className="card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#34d399', marginBottom: '1rem', padding: '0.75rem 1rem' }}>
          {successNotice}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TỔNG SỐ ĐƠN</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem' }}>{appeals.length}</h3>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>CHỜ TIẾP NHẬN</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem', color: '#fbbf24' }}>{countPending}</h3>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <span style={{ fontSize: '0.8rem', color: '#60a5fa' }}>ĐANG XEM XÉT</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem', color: '#60a5fa' }}>{countInReview}</h3>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.8rem', color: '#34d399' }}>ĐÃ CHẤP THUẬN</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem', color: '#34d399' }}>{countAccepted}</h3>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '0.8rem', color: '#f87171' }}>TỪ CHỐI</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '0.25rem', color: '#f87171' }}>{countRejected}</h3>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setStatusFilter('SUBMITTED')}
            className={`btn btn-sm ${statusFilter === 'SUBMITTED' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Chờ tiếp nhận
          </button>
          <button
            onClick={() => setStatusFilter('IN_REVIEW')}
            className={`btn btn-sm ${statusFilter === 'IN_REVIEW' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Đang xem xét
          </button>
          <button
            onClick={() => setStatusFilter('ACCEPTED')}
            className={`btn btn-sm ${statusFilter === 'ACCEPTED' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Đã chấp thuận
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`btn btn-sm ${statusFilter === 'REJECTED' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Đã từ chối
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Lớp học:</label>
          <select
            className="form-control"
            style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Tất cả các lớp phụ trách</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.classCode} - {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Appeals List Table */}
      {loading ? (
        <p>Đang tải dữ liệu khiếu nại...</p>
      ) : appeals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <p style={{ color: '#94a3b8', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
            Hộp thư khiếu nại đang trống.
          </p>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Không có đơn khiếu nại nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: '0.5rem 1rem' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Lớp & Đề thi</th>
                <th>Điểm hiện tại / Kỳ vọng</th>
                <th>Lý do khiếu nại</th>
                <th>Thời gian gửi</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {appeals.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.student?.fullName}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.student?.email}</div>
                  </td>
                  <td>
                    <span className="badge badge-blue">{item.exam?.class?.classCode}</span>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{item.exam?.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Lần nộp #{item.submission?.attemptNumber}</div>
                  </td>
                  <td>
                    <div>
                      <strong style={{ color: item.status === 'ACCEPTED' ? '#34d399' : '#e2e8f0' }}>
                        {item.status === 'ACCEPTED' && item.newScore !== null ? `${item.newScore} điểm` : `${item.previousScore} điểm`}
                      </strong>
                    </div>
                    {item.expectedScore !== null && (
                      <div style={{ fontSize: '0.8rem', color: '#60a5fa' }}>Kỳ vọng: {item.expectedScore}đ</div>
                    )}
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.reason}
                    </div>
                    {item.decisionReason && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', fontStyle: 'italic' }}>
                        Phản hồi: {item.decisionReason}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatDate(item.createdAt)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {getStatusBadge(item.status)}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => handleOpenResolveModal(item)}
                      className="btn btn-primary btn-sm"
                    >
                      Xử lý đơn
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolution Modal */}
      {activeAppeal && (
        <div className="form-modal-overlay">
          <div className="card form-modal-panel" style={{ width: 'min(42rem, 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem' }}>Giải Quyết Khiếu Nại Điểm</h3>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Sinh viên: <strong>{activeAppeal.student?.fullName}</strong> ({activeAppeal.student?.email})
                </span>
              </div>
              <div>{getStatusBadge(activeAppeal.status)}</div>
            </div>

            {modalError && <p role="alert" style={{ color: '#f87171', marginBottom: '1rem' }}>{modalError}</p>}

            {/* Appeal Details Card */}
            <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>LỚP HỌC</span>
                  <strong>{activeAppeal.exam?.class?.classCode} - {activeAppeal.exam?.class?.name}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>ĐỀ THI</span>
                  <strong>{activeAppeal.exam?.title}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>ĐIỂM HIỆN TẠI</span>
                  <strong style={{ fontSize: '1.1rem', color: '#60a5fa' }}>{activeAppeal.previousScore} điểm</strong>
                </div>
                {activeAppeal.expectedScore !== null && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>ĐIỂM KỲ VỌNG</span>
                    <strong style={{ fontSize: '1.1rem', color: '#fbbf24' }}>{activeAppeal.expectedScore} điểm</strong>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Nội dung sinh viên trình bày:</span>
                <p style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', color: '#f1f5f9', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  {activeAppeal.reason}
                </p>
              </div>

              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <a
                  href={`/student/submissions/${activeAppeal.submissionId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                   Mở xem chi tiết bài nộp & test case (Tab mới) &rarr;
                </a>
              </div>
            </div>

            {/* Resolution Form */}
            <form onSubmit={handleSubmitResolve}>
              <div className="form-group">
                <label>Quyết định xử lý *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setResolveAction('IN_REVIEW')}
                    className={`btn ${resolveAction === 'IN_REVIEW' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.85rem' }}
                  >
                     Đang xem xét
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveAction('ACCEPTED')}
                    className={`btn ${resolveAction === 'ACCEPTED' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      background: resolveAction === 'ACCEPTED' ? '#10b981' : undefined,
                      borderColor: resolveAction === 'ACCEPTED' ? '#10b981' : undefined,
                      fontSize: '0.85rem',
                    }}
                  >
                    ✓ Chấp thuận & Sửa điểm
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveAction('REJECTED')}
                    className={`btn ${resolveAction === 'REJECTED' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ fontSize: '0.85rem' }}
                  >
                     Từ chối khiếu nại
                  </button>
                </div>
              </div>

              {resolveAction === 'ACCEPTED' && (
                <div className="form-group" style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <label style={{ color: '#34d399', fontWeight: 600 }}>Điểm mới chính thức (Total Score) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="form-control"
                    placeholder="Nhập số điểm mới..."
                    value={newScore}
                    onChange={(e) => setNewScore(e.target.value)}
                    required
                  />
                  <small style={{ color: '#94a3b8', display: 'block', marginTop: '0.35rem' }}>
                    * Hệ thống sẽ tự động cập nhật trực tiếp điểm số mới vào bài nộp của sinh viên.
                  </small>
                </div>
              )}

              <div className="form-group">
                <label>
                  {resolveAction === 'ACCEPTED'
                    ? 'Nhận xét / Căn cứ điều chỉnh điểm cho sinh viên *'
                    : resolveAction === 'REJECTED'
                    ? 'Lý do từ chối khiếu nại (bắt buộc) *'
                    : 'Ghi chú thẩm định nội bộ / Lời nhắn cho sinh viên'}
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder={
                    resolveAction === 'ACCEPTED'
                      ? 'VD: Đã kiểm tra lại test case số 2, logic xử lý của sinh viên đúng nhưng timeout do tải hệ thống. Điều chỉnh điểm lên 9.0.'
                      : resolveAction === 'REJECTED'
                      ? 'VD: Đã thẩm định lại code, thuật toán của bạn có độ phức tạp O(n^2) vượt quá giới hạn thời gian cho phép của đề thi.'
                      : 'VD: Giảng viên đang biên dịch và test lại bằng tay trên môi trường máy chủ...'
                  }
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  required={resolveAction !== 'IN_REVIEW'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveAppeal(null)}
                  disabled={submittingResolve}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className={`btn ${resolveAction === 'ACCEPTED' ? 'btn-primary' : resolveAction === 'REJECTED' ? 'btn-danger' : 'btn-primary'}`}
                  style={resolveAction === 'ACCEPTED' ? { background: '#10b981', borderColor: '#10b981' } : undefined}
                  disabled={submittingResolve}
                >
                  {submittingResolve ? 'Đang cập nhật...' : 'Lưu kết quả xử lý'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
