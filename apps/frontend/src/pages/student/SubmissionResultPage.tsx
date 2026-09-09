import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export const SubmissionResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubmission = async () => {
    const res = await apiRequest(`/submissions/${id}`);
    if (res.success && res.data) {
      setSubmission(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubmission();
    // Auto-poll nếu trạng thái vẫn đang QUEUED hoặc RUNNING
    const interval = setInterval(() => {
      if (submission && (submission.status === 'QUEUED' || submission.status === 'RUNNING')) {
        fetchSubmission();
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [id, submission?.status]);

  if (loading) return <div className="container"><p>Đang tải kết quả bài nộp...</p></div>;
  if (!submission) return <div className="container"><p>Không tìm thấy bài nộp.</p></div>;

  const isCompleted = submission.status === 'COMPLETED';

  return (
    <div className="container" style={{ maxWidth: '850px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/student">← Quay lại danh sách bài tập</Link>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Phiên nộp bài: #{submission.id.substring(0, 8)}</span>
            <h2 style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>{submission.exam?.title}</h2>
          </div>
          <div>
            <span className={`badge ${isCompleted ? 'badge-green' : submission.status === 'RUNNING' ? 'badge-yellow' : 'badge-blue'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
              {submission.status}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1.5rem', background: '#090d16', padding: '1rem', borderRadius: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TỔNG ĐIỂM</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: isCompleted ? '#34d399' : '#94a3b8' }}>
              {submission.totalScore} pts
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>NGÔN NGỮ</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{submission.exam?.allowedLanguage}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>THỜI ĐIỂM NỘP</div>
            <div style={{ fontSize: '0.85rem' }}>{new Date(submission.submittedAt).toLocaleTimeString('vi-VN')}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>HOÀN THÀNH</div>
            <div style={{ fontSize: '0.85rem' }}>
              {submission.completedAt ? new Date(submission.completedAt).toLocaleTimeString('vi-VN') : 'Đang xử lý...'}
            </div>
          </div>
        </div>

        {!isCompleted && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '0.5rem' }}>
            <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '0.5rem', color: '#60a5fa' }}>Hàng đợi AutogradingWorker đang chạy bài nộp qua Sandbox...</p>
          </div>
        )}
      </div>

      {isCompleted && (
        <div className="card">
          <h3>Chi tiết các Test Cases ({submission.testResults?.length || 0})</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Test Case</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th>Bộ nhớ</th>
                <th>Điểm đạt được</th>
              </tr>
            </thead>
            <tbody>
              {submission.testResults?.map((tr: any) => (
                <tr key={tr.id}>
                  <td>
                    <strong>#{tr.testCase?.orderIndex}</strong>
                    {tr.testCase?.isHidden && <span className="badge badge-yellow" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>ẨN</span>}
                  </td>
                  <td>
                    <span className={`badge ${tr.status === 'ACCEPTED' ? 'badge-green' : 'badge-red'}`}>
                      {tr.status}
                    </span>
                  </td>
                  <td>{tr.executionTimeMs} ms</td>
                  <td>{Math.round(tr.memoryUsedKb / 1024)} MB</td>
                  <td style={{ fontWeight: 600, color: tr.scoreEarned > 0 ? '#34d399' : '#f87171' }}>
                    +{tr.scoreEarned} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h4>Mã nguồn đã nộp</h4>
        <pre style={{ background: '#090d16', padding: '1rem', borderRadius: '0.5rem', marginTop: '0.5rem', overflowX: 'auto', fontSize: '0.85rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
          {submission.sourceCodeUrl}
        </pre>
      </div>
    </div>
  );
};
