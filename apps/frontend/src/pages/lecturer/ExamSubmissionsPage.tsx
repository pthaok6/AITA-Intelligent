import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export const ExamSubmissionsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      setLoading(true);
      const res = await apiRequest(`/exams/class/${classId}`);
      if (res.success && res.data) {
        setExams(res.data);
        if (res.data.length > 0) {
          setSelectedExamId(res.data[0].id);
        }
      }
      setLoading(false);
    };
    fetchExams();
  }, [classId]);

  useEffect(() => {
    if (!selectedExamId) return;
    let active = true;
    setSubmissions([]); setReports([]);
    const fetchSubmissions = async () => {
      const [res, report] = await Promise.all([apiRequest(`/exams/${selectedExamId}/submissions`), apiRequest(`/exams/${selectedExamId}/plagiarism`)]);
      if (!active) return;
      if (res.success && res.data) setSubmissions(res.data);
      if (report.success && report.data) setReports(report.data);
      setError(!res.success ? res.message || 'Không tải được bài nộp.' : !report.success ? report.message || 'Không tải được báo cáo AST.' : '');
    };
    fetchSubmissions();
    const timer = setInterval(fetchSubmissions, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [selectedExamId]);

  return (
    <div className="container">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/lecturer">← Quay lại Dashboard</Link>
      </div>

      <h2>Danh sách Đề thi & Kết quả Bài nộp</h2>
      {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}

      {loading ? (
        <p>Đang tải...</p>
      ) : exams.length === 0 ? (
        <div className="card" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <p>Lớp học này chưa có đề thi nào.</p>
        </div>
      ) : (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {exams.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setSelectedExamId(ex.id)}
                className={`btn ${selectedExamId === ex.id ? 'btn-primary' : 'btn-secondary'}`}
              >
                {ex.title}
              </button>
            ))}
          </div>

          <div className="card">
            <h3>Danh sách bài nộp của sinh viên ({submissions.length})</h3>
            {submissions.length === 0 ? (
              <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Chưa có sinh viên nào nộp bài cho đề thi này.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Sinh viên</th>
                    <th>Thời điểm nộp</th>
                    <th>Trạng thái</th>
                    <th>Tổng điểm</th>
                    <th>AST</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <strong>{sub.student?.fullName}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sub.student?.email}</div>
                      </td>
                      <td>{new Date(sub.submittedAt).toLocaleString('vi-VN')}</td>
                      <td>
                        <span className={`badge ${sub.status === 'COMPLETED' ? 'badge-green' : sub.status === 'RUNNING' ? 'badge-yellow' : 'badge-blue'}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '1.05rem', color: '#34d399' }}>
                        {sub.totalScore} pts
                      </td>
                      <td>{sub.astStatus}</td>
                      <td>
                        <Link to={`/student/submissions/${sub.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                          Xem chi tiết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3>Độ tương đồng AST & Winnowing</h3>
            <p>Tỷ lệ fingerprint chung trên tập fingerprint nhỏ hơn. Đây là dấu hiệu để giảng viên kiểm tra, không phải kết luận đạo văn.</p>
            {!reports.length ? <p>Chưa có cặp bài hoàn tất phân tích. Báo cáo tự cập nhật sau khi worker xử lý.</p> : <table className="table">
              <thead><tr><th>Bài A</th><th>Bài B</th><th>Tương đồng</th><th>Hash chung</th><th>Mức đánh dấu</th></tr></thead>
              <tbody>{reports.map(report => <tr key={report.id}>
                <td><Link to={`/student/submissions/${report.submissionAId}`}>{report.submissionA.student.fullName}</Link><div>{report.submissionAId.slice(0, 8)}</div></td>
                <td><Link to={`/student/submissions/${report.submissionBId}`}>{report.submissionB.student.fullName}</Link><div>{report.submissionBId.slice(0, 8)}</div></td>
                <td>{report.similarityScore.toFixed(2)}%</td><td>{report.matchedHashesCount}</td><td>{report.status}</td>
              </tr>)}</tbody>
            </table>}
          </div>
        </div>
      )}
    </div>
  );
};
