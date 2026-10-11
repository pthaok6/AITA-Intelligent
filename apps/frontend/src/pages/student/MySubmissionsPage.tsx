import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export const MySubmissionsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [items, setItems] = useState<any[]>([]);
  const [exam, setExam] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [examResult, submissionResult] = await Promise.all([apiRequest(`/exams/${examId}`), apiRequest(`/exams/${examId}/submissions`)]);
      if (!active) return;
      if (examResult.success) setExam(examResult.data); else setError(examResult.message || 'Không tải được bài thi.');
      if (submissionResult.success) setItems(submissionResult.data || []); else setError(submissionResult.message || 'Không tải được lịch sử nộp bài.');
    };
    void load(); const timer = setInterval(load, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [examId]);
  return <div className="container">
    <p><Link to="/student">← Quay lại lớp học</Link></p>
    <h2>Lịch sử bài nộp{exam ? `: ${exam.title}` : ''}</h2>
    {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
    <div className="card" style={{ marginTop: '1rem' }}>{items.length === 0 ? <p>Bạn chưa nộp bài cho đề thi này.</p> : <table className="table"><thead><tr><th>Thời điểm nộp</th><th>Trạng thái</th><th>Điểm</th><th>Phân tích mã</th><th></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{new Date(item.submittedAt).toLocaleString('vi-VN')}</td><td>{item.status}</td><td>{item.totalScore}</td><td>{item.astStatus}</td><td><Link className="btn btn-secondary" to={`/student/submissions/${item.id}`}>Xem kết quả</Link></td></tr>)}</tbody></table>}</div>
  </div>;
};
