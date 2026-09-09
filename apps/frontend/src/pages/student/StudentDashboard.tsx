import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export const StudentDashboard: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      const res = await apiRequest('/classes');
      if (res.success && res.data) {
        setClasses(res.data);
      }
      setLoading(false);
    };
    fetchClasses();
  }, []);

  return (
    <div className="container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Cổng Luyện Tập & Nộp Bài Sinh Viên</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Chọn bài thi thực hành được giao để làm bài và nhận kết quả chấm tự động tức thì</p>
      </div>

      {loading ? (
        <p>Đang tải danh sách bài tập...</p>
      ) : classes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8' }}>Bạn chưa tham gia lớp học nào hoặc chưa có bài tập được giao.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {classes.map((cls) => (
            <div key={cls.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div>
                  <span className="badge badge-blue">{cls.classCode}</span>
                  <h3 style={{ marginTop: '0.25rem' }}>{cls.name}</h3>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Giảng viên: <strong>{cls.lecturer?.fullName}</strong>
                </div>
              </div>

              <h4>Danh sách bài thi thực hành:</h4>
              {(!cls.exams || cls.exams.length === 0) ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>Chưa có bài thi nào mở.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                  {cls.exams.map((exam: any) => (
                    <div key={exam.id} style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
                      <h4 style={{ marginBottom: '0.5rem' }}>{exam.title}</h4>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                        Ngôn ngữ: <strong style={{ color: '#60a5fa' }}>{exam.allowedLanguage}</strong> • CPU: {exam.timeLimitMs}ms
                      </p>
                      <Link to={`/student/exams/${exam.id}/take`} className="btn btn-primary" style={{ width: '100%', fontSize: '0.85rem' }}>
                        Vào nộp bài &rarr;
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
