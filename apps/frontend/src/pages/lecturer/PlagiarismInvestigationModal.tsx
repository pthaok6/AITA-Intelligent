import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';

interface PlagiarismInvestigationModalProps {
  examId: string;
  reportId: string;
  onClose: () => void;
  onStatusUpdated?: (updatedReport: any) => void;
}

export const PlagiarismInvestigationModal: React.FC<PlagiarismInvestigationModalProps> = ({
  examId,
  reportId,
  onClose,
  onStatusUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  // Status & Note update states
  const [status, setStatus] = useState<'SUSPECTED' | 'CONFIRMED' | 'DISMISSED'>('SUSPECTED');
  const [lecturerNote, setLecturerNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    let active = true;
    const fetchDetails = async () => {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/exams/${examId}/plagiarism/${reportId}`);
      if (!active) return;
      if (res.success && res.data) {
        setData(res.data);
        setStatus(res.data.report.status || 'SUSPECTED');
        setLecturerNote(res.data.report.lecturerNote || '');
      } else {
        setError(res.message || 'Không tải được chi tiết báo cáo đạo văn.');
      }
      setLoading(false);
    };

    fetchDetails();
    return () => {
      active = false;
    };
  }, [examId, reportId]);

  const handleUpdateStatus = async (newStatus: 'SUSPECTED' | 'CONFIRMED' | 'DISMISSED') => {
    setUpdating(true);
    setUpdateMessage('');
    const res = await apiRequest(`/exams/${examId}/plagiarism/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, lecturerNote }),
    });
    setUpdating(false);
    if (res.success && res.data) {
      setStatus(newStatus);
      setUpdateMessage('Đã cập nhật trạng thái quyết định thành công!');
      if (onStatusUpdated) onStatusUpdated(res.data);
      setTimeout(() => setUpdateMessage(''), 3500);
    } else {
      setError(res.message || 'Cập nhật thất bại.');
    }
  };

  const handleSaveNote = async () => {
    setUpdating(true);
    setUpdateMessage('');
    const res = await apiRequest(`/exams/${examId}/plagiarism/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, lecturerNote }),
    });
    setUpdating(false);
    if (res.success && res.data) {
      setUpdateMessage('Đã lưu ghi chú giảng viên thành công!');
      if (onStatusUpdated) onStatusUpdated(res.data);
      setTimeout(() => setUpdateMessage(''), 3500);
    } else {
      setError(res.message || 'Lưu ghi chú thất bại.');
    }
  };

  if (loading) {
    return (
      <div className="modal-backdrop" style={backdropStyle}>
        <div className="modal-card" style={modalCardStyle}>
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#93c5fd' }}>
              Đang phân tích và đối soát AST...
            </div>
            <p style={{ color: '#94a3b8' }}>Đang nạp file mã nguồn và lập bản đồ các đoạn k-gram trùng lặp.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="modal-backdrop" style={backdropStyle}>
        <div className="modal-card" style={modalCardStyle}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ color: '#ef4444' }}>Lỗi đối soát đạo văn</h3>
            <p style={{ color: '#94a3b8', margin: '1rem 0' }}>{error || 'Không tìm thấy dữ liệu.'}</p>
            <button className="btn btn-secondary" onClick={onClose}>
              Đóng cửa sổ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { report, submissionA, submissionB, matches } = data;
  const filesA = submissionA.files || [];
  const filesB = submissionB.files || [];

  const currentFileA = filesA[selectedFileIndex] || filesA[0] || { path: '', content: '' };
  // Find matching file in B by filename, or use same index or first
  const currentFileB =
    filesB.find((f: any) => f.path === currentFileA.path) || filesB[selectedFileIndex] || filesB[0] || { path: '', content: '' };

  const highlightedLinesA: number[] = submissionA.highlightedLines?.[currentFileA.path] || [];
  const highlightedLinesB: number[] = submissionB.highlightedLines?.[currentFileB.path] || [];

  const linesA = currentFileA.content ? currentFileA.content.split('\n') : [];
  const linesB = currentFileB.content ? currentFileB.content.split('\n') : [];

  const isHighRisk = report.similarityScore >= 80;
  const isModerateRisk = report.similarityScore >= 50 && report.similarityScore < 80;

  return (
    <div className="modal-backdrop" style={backdropStyle}>
      <div className="modal-card" style={modalCardStyle}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    backgroundColor: '#1e3a8a',
                    color: '#93c5fd',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  AST WINNOWING v1
                </span>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                  Giám định Đạo văn & So sánh Mã nguồn Song song
                </h2>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Đề thi: <strong>{data.exam?.title}</strong> ({data.exam?.allowedLanguage})
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
              }}
              title="Đóng"
            >
              ✕
            </button>
          </div>

          {/* SIMILARITY STATS BAR */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1.25rem',
              padding: '1rem',
              background: '#0b1324',
              borderRadius: '0.5rem',
              border: '1px solid #1e293b',
            }}
          >
            {/* Student A */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '1.05rem' }}>
                {submissionA.student?.fullName}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{submissionA.student?.email}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Nộp lúc: {new Date(submissionA.submittedAt).toLocaleTimeString('vi-VN')} - Điểm:{' '}
                <strong style={{ color: '#34d399' }}>{submissionA.totalScore} pts</strong>
              </div>
            </div>

            {/* Central Score Gauge */}
            <div style={{ textAlign: 'center', padding: '0 1rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 1.25rem',
                  borderRadius: '9999px',
                  backgroundColor: isHighRisk ? '#450a0a' : isModerateRisk ? '#451a03' : '#064e3b',
                  border: `2px solid ${isHighRisk ? '#ef4444' : isModerateRisk ? '#f59e0b' : '#10b981'}`,
                  color: isHighRisk ? '#fca5a5' : isModerateRisk ? '#fde68a' : '#a7f3d0',
                }}
              >
                <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{report.similarityScore.toFixed(1)}%</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  {isHighRisk ? 'Nguy cơ rất cao' : isModerateRisk ? 'Tương đồng vừa' : 'Tương đồng thấp'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                Phát hiện <strong>{report.matchedHashesCount}</strong> k-gram hashes AST trùng lặp
              </div>
            </div>

            {/* Student B */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: '#f472b6', fontSize: '1.05rem' }}>
                {submissionB.student?.fullName}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{submissionB.student?.email}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Nộp lúc: {new Date(submissionB.submittedAt).toLocaleTimeString('vi-VN')} - Điểm:{' '}
                <strong style={{ color: '#34d399' }}>{submissionB.totalScore} pts</strong>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS & FILE SELECTOR */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: '#131d31',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Xem file nguồn:</span>
            {filesA.map((f: any, idx: number) => (
              <button
                key={f.path}
                onClick={() => setSelectedFileIndex(idx)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: selectedFileIndex === idx ? '#2563eb' : '#1e293b',
                  color: selectedFileIndex === idx ? '#ffffff' : '#94a3b8',
                }}
              >
                📄 {f.path}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid #ef4444',
                  borderRadius: '2px',
                }}
              />
              Đoạn mã trùng lặp AST
            </span>
            <span>
              Tổng số đoạn trùng: <strong>{matches.length}</strong>
            </span>
          </div>
        </div>

        {/* DUAL CODE DIFF VIEWER */}
        <div style={dualPaneContainerStyle}>
          {/* LEFT: STUDENT A */}
          <div style={paneStyle}>
            <div style={paneHeaderStyle('blue')}>
              <span>👤 {submissionA.student?.fullName} ({currentFileA.path || 'Source code'})</span>
              <span style={{ fontSize: '0.75rem' }}>{linesA.length} dòng</span>
            </div>
            <div style={codeWrapperStyle}>
              {linesA.length === 0 ? (
                <p style={{ padding: '1rem', color: '#64748b' }}>Không có nội dung file.</p>
              ) : (
                linesA.map((line: string, i: number) => {
                  const lineNum = i + 1;
                  const isHighlighted = highlightedLinesA.includes(lineNum);
                  return (
                    <div
                      key={lineNum}
                      style={{
                        display: 'flex',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                        lineHeight: '1.45',
                        backgroundColor: isHighlighted ? 'rgba(239, 68, 68, 0.22)' : 'transparent',
                        borderLeft: isHighlighted ? '3px solid #ef4444' : '3px solid transparent',
                      }}
                    >
                      <span
                        style={{
                          width: '45px',
                          textAlign: 'right',
                          paddingRight: '12px',
                          userSelect: 'none',
                          color: isHighlighted ? '#f87171' : '#475569',
                          fontWeight: isHighlighted ? 700 : 400,
                        }}
                      >
                        {lineNum}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          color: isHighlighted ? '#fecaca' : '#e2e8f0',
                        }}
                      >
                        {line || ' '}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: STUDENT B */}
          <div style={paneStyle}>
            <div style={paneHeaderStyle('pink')}>
              <span>👤 {submissionB.student?.fullName} ({currentFileB.path || 'Source code'})</span>
              <span style={{ fontSize: '0.75rem' }}>{linesB.length} dòng</span>
            </div>
            <div style={codeWrapperStyle}>
              {linesB.length === 0 ? (
                <p style={{ padding: '1rem', color: '#64748b' }}>Không có nội dung file.</p>
              ) : (
                linesB.map((line: string, i: number) => {
                  const lineNum = i + 1;
                  const isHighlighted = highlightedLinesB.includes(lineNum);
                  return (
                    <div
                      key={lineNum}
                      style={{
                        display: 'flex',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                        lineHeight: '1.45',
                        backgroundColor: isHighlighted ? 'rgba(239, 68, 68, 0.22)' : 'transparent',
                        borderLeft: isHighlighted ? '3px solid #ef4444' : '3px solid transparent',
                      }}
                    >
                      <span
                        style={{
                          width: '45px',
                          textAlign: 'right',
                          paddingRight: '12px',
                          userSelect: 'none',
                          color: isHighlighted ? '#f87171' : '#475569',
                          fontWeight: isHighlighted ? 700 : 400,
                        }}
                      >
                        {lineNum}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          color: isHighlighted ? '#fecaca' : '#e2e8f0',
                        }}
                      >
                        {line || ' '}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* DECISION & LECTURER REVIEW PANEL */}
        <div style={footerStyle}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              📝 Ghi chú nhận xét của Giảng viên:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Ví dụ: Hai bài có cùng giải thuật, cấu trúc cây AST giống hệt, chỉ đổi tên hàm và biến..."
                value={lecturerNote}
                onChange={(e) => setLecturerNote(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                }}
              />
              <button
                className="btn btn-secondary"
                disabled={updating}
                onClick={handleSaveNote}
                style={{ padding: '0.5rem 1rem' }}
              >
                Lưu ghi chú
              </button>
            </div>
            {updateMessage && (
              <div style={{ color: '#34d399', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                ✓ {updateMessage}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <button
              style={{
                ...actionBtnStyle,
                backgroundColor: status === 'CONFIRMED' ? '#b91c1c' : '#7f1d1d',
                border: status === 'CONFIRMED' ? '2px solid #ef4444' : '1px solid #991b1b',
                color: '#fee2e2',
              }}
              disabled={updating}
              onClick={() => handleUpdateStatus('CONFIRMED')}
            >
              🚨 Xác nhận Gian lận (CONFIRMED)
            </button>

            <button
              style={{
                ...actionBtnStyle,
                backgroundColor: status === 'DISMISSED' ? '#047857' : '#064e3b',
                border: status === 'DISMISSED' ? '2px solid #10b981' : '1px solid #065f46',
                color: '#d1fae5',
              }}
              disabled={updating}
              onClick={() => handleUpdateStatus('DISMISSED')}
            >
              ✓ Bỏ qua / Hợp lệ (DISMISSED)
            </button>

            <button
              style={{
                ...actionBtnStyle,
                backgroundColor: status === 'SUSPECTED' ? '#b45309' : '#78350f',
                border: status === 'SUSPECTED' ? '2px solid #f59e0b' : '1px solid #92400e',
                color: '#fef3c7',
              }}
              disabled={updating}
              onClick={() => handleUpdateStatus('SUSPECTED')}
            >
              ⚠️ Đang nghi vấn (SUSPECTED)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Styles
const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(3, 7, 18, 0.85)',
  backdropFilter: 'blur(6px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
};

const modalCardStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderRadius: '0.75rem',
  border: '1px solid #334155',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
  width: 'min(1400px, 98vw)',
  height: '92vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem 1rem 1.5rem',
  background: '#141e33',
  borderBottom: '1px solid #1e293b',
};

const dualPaneContainerStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1px',
  backgroundColor: '#1e293b',
  overflow: 'hidden',
};

const paneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#090d16',
  overflow: 'hidden',
};

const paneHeaderStyle = (color: 'blue' | 'pink'): React.CSSProperties => ({
  padding: '0.5rem 1rem',
  background: color === 'blue' ? '#172554' : '#500724',
  color: color === 'blue' ? '#93c5fd' : '#fbcfe8',
  fontSize: '0.85rem',
  fontWeight: 700,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #1e293b',
});

const codeWrapperStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0.5rem 0',
};

const footerStyle: React.CSSProperties = {
  padding: '1rem 1.5rem',
  background: '#141e33',
  borderTop: '1px solid #1e293b',
  display: 'flex',
  alignItems: 'flex-end',
  gap: '1.5rem',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '0.55rem 1rem',
  borderRadius: '0.375rem',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};
