import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';

const formatDateTime = (value: string) => {
  try {
    const d = new Date(value);
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  } catch {
    return '-';
  }
};

export const MySubmissionsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [items, setItems] = useState<any[]>([]);
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [examResult, submissionResult] = await Promise.all([
        apiRequest(`/exams/${examId}`),
        apiRequest(`/exams/${examId}/submissions`),
      ]);
      if (!active) return;
      if (examResult.success) setExam(examResult.data);
      else setError(examResult.message || 'Không tải được bài thi.');

      if (submissionResult.success) setItems(submissionResult.data || []);
      else setError(submissionResult.message || 'Không tải được lịch sử nộp bài.');

      setLoading(false);
    };

    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [examId]);

  return (
    <div className="container page-my-submissions" style={{ maxWidth: 960, paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to="/student"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại lớp học
        </Link>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>
          Bài nộp gần nhất{exam ? `: ${exam.title}` : ''}
        </h2>
        {exam && (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Ngôn ngữ: <strong>{exam.allowedLanguage}</strong> · Hạn nộp:{' '}
            {new Date(exam.endTime).toLocaleString('vi-VN')}
          </p>
        )}
      </div>

      {exam && items.some((item) => !item.scoreReleased) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-control)',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            color: '#93c5fd',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>Điểm số và chi tiết test case sẽ được công bố sau khi thời hạn nộp bài kết thúc.</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-control)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#fca5a5',
            marginBottom: '1rem',
            fontSize: '0.9rem',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: '2rem' }}>
          <div className="skeleton-line" style={{ width: '40%' }} />
          <div className="skeleton-line" style={{ width: '80%', margin: '1rem 0' }} />
          <div className="skeleton-line" style={{ width: '60%' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state-box" style={{ marginTop: '1rem' }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2"
            style={{ marginBottom: '0.75rem' }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Bạn chưa nộp bài cho đề thi này
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
            Hãy chuẩn bị mã nguồn và nộp bài trước khi hết hạn.
          </p>
          <Link to={`/student/exams/${examId}`} className="btn btn-primary btn-sm">
            Đến trang làm bài &rarr;
          </Link>
        </div>
      ) : (
        <div className="card" style={{ marginTop: '1rem', overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Lần nộp</th>
                <th>Thời điểm nộp</th>
                <th>Trạng thái</th>
                <th>Điểm số</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>#{item.attemptNumber || items.length - idx}</td>
                  <td>{formatDateTime(item.submittedAt)}</td>
                  <td>
                    <span
                      className={`badge ${
                        item.status === 'COMPLETED'
                          ? 'badge-green'
                          : item.status === 'COMPILE_ERROR'
                          ? 'badge-red'
                          : item.status === 'RUNNING'
                          ? 'badge-yellow'
                          : item.status === 'LATE'
                          ? 'badge-yellow'
                          : 'badge-blue'
                      }`}
                    >
                      {item.status === 'LATE' ? 'NỘP MUỘN' : item.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: item.scoreReleased ? '#34d399' : 'var(--text-muted)' }}>
                    {item.scoreReleased ? `${item.totalScore} pts` : 'Chờ công bố'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn btn-secondary btn-sm" to={`/student/submissions/${item.id}`}>
                      Xem bài nộp
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
