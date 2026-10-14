import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const formatDate = (value: string) => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const ExamSubmissionsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [syncingGit, setSyncingGit] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamRepo, setNewTeamRepo] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDeleteExam, setConfirmDeleteExam] = useState(false);
  const [deletingExam, setDeletingExam] = useState(false);
  const selectedExam = exams.find(exam => exam.id === selectedExamId);

  const deleteExam = async () => {
    if (!selectedExam || selectedExam._count?.submissions > 0) return;
    setDeletingExam(true);
    const result = await apiRequest(`/exams/${selectedExam.id}`, { method: 'DELETE' });
    setDeletingExam(false); setConfirmDeleteExam(false);
    if (!result.success) { setError(result.message || 'Không thể xóa đề thi.'); return; }
    const remaining = exams.filter(exam => exam.id !== selectedExam.id);
    setExams(remaining); setSelectedExamId(remaining[0]?.id || null);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId || !newTeamName.trim()) return;
    setCreatingTeam(true);
    const res = await apiRequest(`/exams/${selectedExamId}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name: newTeamName.trim(), repoUrl: newTeamRepo.trim() || undefined }),
    });
    setCreatingTeam(false);
    if (res.success) {
      setNewTeamName('');
      setNewTeamRepo('');
      setShowCreateTeam(false);
      const teamRes = await apiRequest(`/exams/${selectedExamId}/teams`);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    } else {
      setError(res.message || 'Không thể tạo nhóm.');
    }
  };

  const handleSyncGit = async (teamId: string) => {
    setSyncingGit(teamId);
    setError('');
    const res = await apiRequest(`/teams/${teamId}/sync-git`, {
      method: 'POST',
      body: JSON.stringify({ lowerBound: 0.5, upperBound: 1.2 }),
    });
    setSyncingGit(null);
    if (res.success) {
      const teamRes = await apiRequest(`/exams/${selectedExamId}/teams`);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    } else {
      setError(res.message || 'Không thể đồng bộ Git.');
    }
  };

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
    setSubmissions([]); setReports([]); setTeams([]);
    const fetchSubmissions = async () => {
      const [res, report, teamRes] = await Promise.all([
        apiRequest(`/exams/${selectedExamId}/submissions`),
        apiRequest(`/exams/${selectedExamId}/plagiarism`),
        apiRequest(`/exams/${selectedExamId}/teams`),
      ]);
      if (!active) return;
      if (res.success && res.data) setSubmissions(res.data);
      if (report.success && report.data) setReports(report.data);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
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
                {ex.title} {ex.examType === 'GROUP' && '👥 (Nhóm)'}
              </button>
            ))}
          </div>

          {selectedExam && <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
            <Link className="btn btn-secondary" to={`/lecturer/classes/${classId}/exams/${selectedExam.id}/edit`}>Sửa đề và test case</Link>
            <button className="btn btn-ghost-danger" disabled={selectedExam._count?.submissions > 0} title="Không thể xóa đề đã có bài nộp" onClick={() => setConfirmDeleteExam(true)}>Xóa đề</button>
            {selectedExam.examType === 'GROUP' && (
              <button className="btn btn-primary" onClick={() => setShowCreateTeam(!showCreateTeam)}>
                {showCreateTeam ? 'Đóng form tạo nhóm' : '+ Thêm nhóm mới'}
              </button>
            )}
          </div>}

          {showCreateTeam && (
            <form className="card" onSubmit={handleCreateTeam} style={{ marginBottom: '1.5rem', background: '#1e293b' }}>
              <h3>Thêm nhóm mới cho đề thi</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '1rem', alignItems: 'flex-end', marginTop: '1rem' }}>
                <div className="form-group">
                  <label>Tên nhóm *</label>
                  <input className="form-control" placeholder="Ví dụ: Nhóm 1 - AITA" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>GitHub Repository URL</label>
                  <input className="form-control" placeholder="https://github.com/owner/repo" value={newTeamRepo} onChange={e => setNewTeamRepo(e.target.value)} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={creatingTeam}>{creatingTeam ? 'Đang tạo...' : 'Tạo nhóm'}</button>
              </div>
            </form>
          )}

          {/* SECTION: GROUP TEAMS & GIT ANALYTICS (UC19, UC20, BR-05, BR-12) */}
          {selectedExam?.examType === 'GROUP' && (
            <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>👥 Phân tích Đóng góp Git & Điểm Cá nhân (UC19, BR-12)</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>
                    Tự động tính tỷ lệ đóng góp Git commits/LOC, cảnh báo Free-rider &lt; 5% (BR-05) và tính điểm cá nhân phái sinh từ điểm nhóm (BR-12).
                  </p>
                </div>
              </div>

              {teams.length === 0 ? (
                <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Chưa có nhóm nào được tạo cho bài kiểm tra này. Hãy bấm "+ Thêm nhóm mới" ở trên.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                  {teams.map(team => {
                    const latestSub = team.submissions?.[0];
                    return (
                      <div key={team.id} style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div>
                            <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{team.name}</strong>
                            {team.repoUrl ? (
                              <a href={team.repoUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#38bdf8' }}>
                                🔗 {team.repoUrl}
                              </a>
                            ) : (
                              <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#64748b' }}>(Chưa gắn link repo)</span>
                            )}
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                              Điểm bài nộp nhóm (Docker): <strong style={{ color: latestSub?.status === 'COMPLETED' ? '#34d399' : '#e2e8f0' }}>{latestSub ? `${latestSub.totalScore} pts (${latestSub.status})` : 'Chưa nộp bài'}</strong>
                            </div>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={syncingGit === team.id}
                            onClick={() => handleSyncGit(team.id)}
                            style={{ background: '#0284c7', color: '#fff' }}
                          >
                            {syncingGit === team.id ? 'Đang đồng bộ...' : '⚡ Đồng bộ Git & Tính điểm (BR-12)'}
                          </button>
                        </div>

                        {team.members.length === 0 ? (
                          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Nhóm chưa có thành viên nào.</p>
                        ) : (
                          <table className="table" style={{ fontSize: '0.875rem' }}>
                            <thead>
                              <tr>
                                <th>Thành viên</th>
                                <th>Vai trò</th>
                                <th>GitHub</th>
                                <th>Commits / LOC</th>
                                <th>% Đóng góp</th>
                                <th>Cảnh báo Free-rider (BR-05)</th>
                                <th>Điểm cá nhân (BR-12)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {team.members.map((m: any) => {
                                const contrib = m.contributions?.[0];
                                return (
                                  <tr key={m.id}>
                                    <td>
                                      <strong>{m.student?.fullName}</strong>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.student?.email}</div>
                                    </td>
                                    <td>
                                      <span className={`badge ${m.role === 'LEADER' ? 'badge-yellow' : 'badge-blue'}`}>
                                        {m.role === 'LEADER' ? 'Trưởng nhóm (Leader)' : 'Thành viên'}
                                      </span>
                                    </td>
                                    <td>{m.githubUsername || <span style={{ color: '#64748b' }}>Chưa cập nhật</span>}</td>
                                    <td>{contrib ? `${contrib.commitsCount} commits / +${contrib.locAdded} -${contrib.locDeleted}` : '-'}</td>
                                    <td>
                                      {contrib ? (
                                        <div>
                                          <strong>{contrib.contributionPercent}%</strong>
                                          <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '4px', width: '100px' }}>
                                            <div style={{ background: contrib.isWarning ? '#ef4444' : '#3b82f6', height: '100%', width: `${Math.min(100, contrib.contributionPercent)}%`, borderRadius: '3px' }} />
                                          </div>
                                        </div>
                                      ) : '-'}
                                    </td>
                                    <td>
                                      {contrib?.isWarning ? (
                                        <span className="badge badge-danger" style={{ background: '#991b1b', color: '#fecaca' }}>
                                          ⚠️ Dưới 5% (Free-rider)
                                        </span>
                                      ) : contrib ? (
                                        <span className="badge badge-green">Đạt yêu cầu</span>
                                      ) : '-'}
                                    </td>
                                    <td style={{ fontWeight: 'bold', fontSize: '1rem', color: contrib?.personalScore !== null ? '#34d399' : '#94a3b8' }}>
                                      {contrib?.personalScore !== null ? `${contrib.personalScore} pts` : latestSub?.status === 'COMPLETED' ? 'Bấm đồng bộ để tính' : 'Chờ chấm bài nhóm'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h3>Bài nộp mới nhất của sinh viên ({submissions.length})</h3>
            {submissions.length === 0 ? (
              <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Chưa có sinh viên nào nộp bài cho đề thi này.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Sinh viên / Nhóm</th>
                    <th>Thời điểm nộp</th>
                    <th>Trạng thái</th>
                    <th>Tổng điểm nhóm</th>
                    <th>AST</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <strong>{sub.student?.fullName}</strong>
                        {sub.team && <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>👥 Nhóm: {sub.team.name}</div>}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sub.student?.email}</div>
                      </td>
                      <td>{formatDate(sub.submittedAt)}</td>
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
                        <Link to={`/student/submissions/${sub.id}`} className="btn btn-secondary btn-sm">
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
      <ConfirmDialog open={confirmDeleteExam} title="Xóa đề thi?" description={selectedExam ? `Xóa đề “${selectedExam.title}” cùng các test case và báo cáo liên quan? Chỉ đề chưa có bài nộp mới được xóa.` : ''} confirmLabel="Xóa đề" busy={deletingExam} onConfirm={deleteExam} onCancel={() => setConfirmDeleteExam(false)} />
    </div>
  );
};
