import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const formatDate = (value?: string) => {
  if (!value) return '-';
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
};

export const ExamSubmissionsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [syncingGit, setSyncingGit] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamRepo, setNewTeamRepo] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDeleteExam, setConfirmDeleteExam] = useState(false);
  const [deletingExam, setDeletingExam] = useState(false);
  const [editingMemberGithub, setEditingMemberGithub] = useState<{ teamId: string; studentId: string; username: string } | null>(null);
  const [savingGithub, setSavingGithub] = useState(false);
  const [editingRepoUrl, setEditingRepoUrl] = useState<{ teamId: string; repoUrl: string } | null>(null);
  const [savingRepo, setSavingRepo] = useState(false);

  // Thêm thành viên vào nhóm
  const [addingMemberTeamId, setAddingMemberTeamId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [memberRole, setMemberRole] = useState<'MEMBER' | 'LEADER'>('MEMBER');
  const [memberGithub, setMemberGithub] = useState('');
  const [savingMember, setSavingMember] = useState(false);
  const [editingMemberScore, setEditingMemberScore] = useState<{ teamId: string; studentId: string; score: string } | null>(null);
  const [savingScore, setSavingScore] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  const selectedExam = exams.find(exam => exam.id === selectedExamId);

  const handleSaveScore = async (teamId: string, studentId: string) => {
    if (!editingMemberScore) return;
    setSavingScore(true);
    const scoreVal = parseFloat(editingMemberScore.score);
    const res = await apiRequest(`/teams/${teamId}/members/${studentId}/score`, {
      method: 'PUT',
      body: JSON.stringify({ score: isNaN(scoreVal) ? 0 : scoreVal }),
    });
    setSavingScore(false);
    if (res.success) {
      setEditingMemberScore(null);
      const teamRes = await apiRequest(`/exams/${selectedExamId}/teams`);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    } else {
      setError(res.message || 'Không thể lưu điểm.');
    }
  };


  const handleSaveGithub = async (teamId: string, studentId: string) => {
    if (!editingMemberGithub) return;
    setSavingGithub(true);
    const res = await apiRequest(`/teams/${teamId}/members/${studentId}/github`, {
      method: 'PUT',
      body: JSON.stringify({ githubUsername: editingMemberGithub.username }),
    });
    setSavingGithub(false);
    if (res.success) {
      setEditingMemberGithub(null);
      const teamRes = await apiRequest(`/exams/${selectedExamId}/teams`);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    } else {
      setError(res.message || 'Không thể lưu GitHub username.');
    }
  };

  const handleSaveRepo = async (teamId: string) => {
    if (!editingRepoUrl) return;
    setSavingRepo(true);
    const res = await apiRequest(`/teams/${teamId}/repo`, {
      method: 'PUT',
      body: JSON.stringify({ repoUrl: editingRepoUrl.repoUrl }),
    });
    setSavingRepo(false);
    if (res.success) {
      setEditingRepoUrl(null);
      const teamRes = await apiRequest(`/exams/${selectedExamId}/teams`);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    } else {
      setError(res.message || 'Không thể lưu repo URL.');
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!selectedStudentId) {
      setError('Vui lòng chọn sinh viên cần thêm vào nhóm.');
      return;
    }
    setSavingMember(true);
    setError('');
    const res = await apiRequest(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        studentId: selectedStudentId,
        role: memberRole,
        githubUsername: memberGithub.trim() || undefined,
      }),
    });
    setSavingMember(false);
    if (res.success) {
      setAddingMemberTeamId(null);
      setSelectedStudentId('');
      setMemberRole('MEMBER');
      setMemberGithub('');
      const teamRes = await apiRequest(`/exams/${selectedExamId}/teams`);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    } else {
      setError(res.message || 'Không thể thêm thành viên vào nhóm.');
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhóm "${teamName}"?`)) return;
    setDeletingTeamId(teamId);
    const res = await apiRequest(`/teams/${teamId}`, { method: 'DELETE' });
    setDeletingTeamId(null);
    if (res.success) {
      const teamRes = await apiRequest(`/exams/${selectedExamId}/teams`);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    } else {
      setError(res.message || 'Không thể xóa nhóm.');
    }
  };

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
      const [examRes, classRes] = await Promise.all([
        apiRequest(`/exams/class/${classId}`),
        apiRequest(`/classes/${classId}`),
      ]);
      if (examRes.success && examRes.data) {
        setExams(examRes.data);
        if (examRes.data.length > 0) {
          setSelectedExamId(examRes.data[0].id);
        }
      }
      if (classRes.success && classRes.data?.enrollments) {
        const activeStudents = classRes.data.enrollments
          .filter((e: any) => e.status === 'ACTIVE' && e.student)
          .map((e: any) => e.student);
        setClassStudents(activeStudents);
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
    const timer = setInterval(fetchSubmissions, 10000);
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
                {ex.title} {ex.examType === 'GROUP' && ' (Nhóm)'}
              </button>
            ))}
          </div>

          {selectedExam && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', background: '#090d16', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                ⏰ Thời gian: <strong style={{ color: '#60a5fa' }}>{new Date(selectedExam.startTime).toLocaleString('vi-VN')}</strong> — <strong style={{ color: '#f87171' }}>{new Date(selectedExam.endTime).toLocaleString('vi-VN')}</strong>
                {selectedExam.timeLimitMs && <span> • CPU: <strong>{selectedExam.timeLimitMs}ms</strong></span>}
                {selectedExam.memoryLimitMb && <span> • RAM: <strong>{selectedExam.memoryLimitMb}MiB</strong></span>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Link className="btn btn-secondary btn-sm" to={`/lecturer/classes/${classId}/exams/${selectedExam.id}/edit`}>Sửa đề và test case</Link>
                <button className="btn btn-ghost-danger btn-sm" disabled={selectedExam._count?.submissions > 0} title="Không thể xóa đề đã có bài nộp" onClick={() => setConfirmDeleteExam(true)}>Xóa đề</button>
                {selectedExam.examType === 'GROUP' && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowCreateTeam(!showCreateTeam)}>
                    {showCreateTeam ? 'Đóng form tạo nhóm' : '+ Thêm nhóm mới'}
                  </button>
                )}
              </div>
            </div>
          )}

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
            <div className="card team-analysis-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 className="team-analysis-title">Phân tích đóng góp Git và điểm cá nhân</h3>
                  <p className="team-analysis-description">
                    Tỷ lệ đóng góp Git (commit và dòng mã) được dùng để phân bổ điểm cá nhân từ điểm nhóm.
                  </p>
                </div>
              </div>

              {teams.length === 0 ? (
                <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Chưa có nhóm nào được tạo cho bài kiểm tra này. Hãy bấm "+ Thêm nhóm mới" ở trên.</p>
              ) : (
                <div className="team-analysis-list">
                  {teams.map(team => {
                    const latestSub = team.submissions?.[0];
                    return (
                      <div key={team.id} className="team-analysis-card">
                        <div className="team-analysis-card-header">
                          <div>
                            <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{team.name}</strong>
                            <button
                              className="btn btn-ghost-danger btn-sm"
                              title="Xóa nhóm này"
                              disabled={deletingTeamId === team.id}
                              onClick={() => handleDeleteTeam(team.id, team.name)}
                            >Xóa</button>
                            {editingRepoUrl?.teamId === team.id ? (
                              <span style={{ marginLeft: '1rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                                <input
                                  className="form-control"
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', width: '250px' }}
                                  value={editingRepoUrl ? editingRepoUrl.repoUrl : ''}
                                  onChange={e => setEditingRepoUrl({ teamId: team.id, repoUrl: e.target.value })}
                                  placeholder="https://github.com/owner/repo"
                                />
                                <button className="btn btn-primary btn-sm" disabled={savingRepo} onClick={() => handleSaveRepo(team.id)}>Lưu</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingRepoUrl(null)}>Hủy</button>
                              </span>
                            ) : (
                              <span>
                                {team.repoUrl ? (
                                  <a href={team.repoUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#38bdf8' }}>
                                    {team.repoUrl}
                                  </a>
                                ) : (
                                  <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#64748b' }}>(Chưa gắn link repo)</span>
                                )}
                                <button
                                  className="btn btn-secondary btn-sm"
                                  title="Sửa Link GitHub Repo"
                                  onClick={() => setEditingRepoUrl({ teamId: team.id, repoUrl: team.repoUrl || '' })}
                                >Sửa</button>
                              </span>
                            )}
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                              Điểm bài nộp nhóm (Docker): <strong style={{ color: latestSub?.status === 'COMPLETED' ? '#34d399' : '#e2e8f0' }}>{latestSub ? `${latestSub.totalScore} pts (${latestSub.status})` : 'Chưa nộp bài'}</strong>
                            </div>
                          </div>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={syncingGit === team.id}
                            onClick={() => handleSyncGit(team.id)}
                          >
                            {syncingGit === team.id ? 'Đang đồng bộ...' : 'Đồng bộ Git và tính điểm'}
                          </button>
                        </div>

                        {(!team.members || team.members.length === 0) ? (
                          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0' }}>Nhóm chưa có thành viên nào.</p>
                        ) : (
                          <table className="table" style={{ fontSize: '0.875rem' }}>
                            <thead>
                              <tr>
                                <th>Thành viên</th>
                                <th>Vai trò</th>
                                <th>GitHub</th>
                                <th>Commits / LOC</th>
                                <th>% Đóng góp</th>
                                <th>Điểm cá nhân / Chấm tay</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(team.members || []).map((m: any) => {
                                const contrib = m.contributions?.[0];
                                return (
                                  <tr key={m.id}>
                                    <td>
                                      <strong>{m.student?.fullName || 'Sinh viên'}</strong>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.student?.email || ''}</div>
                                    </td>
                                    <td>
                                      <span className={`badge ${m.role === 'LEADER' ? 'badge-yellow' : 'badge-blue'}`}>
                                        {m.role === 'LEADER' ? 'Trưởng nhóm (Leader)' : 'Thành viên'}
                                      </span>
                                    </td>
                                    <td>
                                      {editingMemberGithub?.studentId === m.studentId ? (
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                          <input
                                            className="form-control"
                                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', width: '120px' }}
                                            value={editingMemberGithub ? editingMemberGithub.username : ''}
                                            onChange={e => setEditingMemberGithub({ teamId: team.id, studentId: m.studentId, username: e.target.value })}
                                            placeholder="GitHub username"
                                            autoFocus
                                          />
                                          <button className="btn btn-primary btn-sm" disabled={savingGithub} onClick={() => handleSaveGithub(team.id, m.studentId)}>Lưu</button>
                                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingMemberGithub(null)}>Hủy</button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <span>{m.githubUsername || <span style={{ color: '#64748b' }}>Chưa cập nhật</span>}</span>
                                          <button
                                            className="btn btn-secondary btn-sm"
                                            title="Sửa GitHub username"
                                            onClick={() => setEditingMemberGithub({ teamId: team.id, studentId: m.studentId, username: m.githubUsername || '' })}
                                          >Sửa</button>
                                        </div>
                                      )}
                                    </td>
                                    <td>{contrib ? `${contrib.commitsCount} commits / +${contrib.locAdded} -${contrib.locDeleted}` : '-'}</td>
                                    <td>
                                      {contrib ? (
                                        <div>
                                          <strong>{contrib.contributionPercent}%</strong>
                                          <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '4px', width: '100px' }}>
                                            <div style={{ background: '#3b82f6', height: '100%', width: `${Math.min(100, contrib.contributionPercent)}%`, borderRadius: '3px' }} />
                                          </div>
                                        </div>
                                      ) : '-'}
                                    </td>
                                    <td style={{ minWidth: '130px' }}>
                                      {editingMemberScore?.studentId === m.studentId ? (
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                          <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="12"
                                            className="form-control"
                                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', width: '65px' }}
                                            value={editingMemberScore ? editingMemberScore.score : ''}
                                            onChange={e => setEditingMemberScore({ teamId: team.id, studentId: m.studentId, score: e.target.value })}
                                            autoFocus
                                          />
                                          <button className="btn btn-primary btn-sm" disabled={savingScore} onClick={() => handleSaveScore(team.id, m.studentId)}>Lưu</button>
                                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingMemberScore(null)}>Hủy</button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                          <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: (contrib && contrib.personalScore != null) ? '#34d399' : '#94a3b8' }}>
                                            {(contrib && contrib.personalScore != null) ? `${contrib.personalScore} pts` : latestSub?.status === 'COMPLETED' ? 'Chưa tính' : '-'}
                                          </span>
                                          <button
                                            className="btn btn-secondary btn-sm"
                                            title="Chấm điểm thủ công / Ghi đè điểm cho SV này"
                                            onClick={() => setEditingMemberScore({ teamId: team.id, studentId: m.studentId, score: String(contrib?.personalScore != null ? contrib.personalScore : (latestSub?.totalScore || 0)) })}
                                          >Sửa điểm</button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}

                        {/* FORM: THÊM THÀNH VIÊN VÀO NHÓM */}
                        {addingMemberTeamId === team.id ? (
                          <div style={{ marginTop: '0.75rem', padding: '0.85rem', background: '#1e293b', borderRadius: '6px', border: '1px solid #475569' }}>
                            <h5 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '0.95rem' }}>+ Thêm sinh viên vào {team.name}</h5>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto', gap: '0.5rem', alignItems: 'flex-end' }}>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Chọn sinh viên trong lớp</label>
                                <select
                                  className="form-control"
                                  style={{ fontSize: '0.85rem', width: '100%' }}
                                  value={selectedStudentId}
                                  onChange={e => setSelectedStudentId(e.target.value)}
                                >
                                  <option value="">-- Chọn sinh viên --</option>
                                  {classStudents
                                    .filter(s => !team.members?.some((m: any) => m.studentId === s.id))
                                    .map(s => (
                                      <option key={s.id} value={s.id}>
                                        {s.fullName} ({s.email})
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Vai trò</label>
                                <select
                                  className="form-control"
                                  style={{ fontSize: '0.85rem', width: '100%' }}
                                  value={memberRole}
                                  onChange={e => setMemberRole(e.target.value as any)}
                                >
                                  <option value="MEMBER">Thành viên (Member)</option>
                                  <option value="LEADER">Trưởng nhóm (Leader)</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>GitHub Username (tuỳ chọn)</label>
                                <input
                                  className="form-control"
                                  style={{ fontSize: '0.85rem', width: '100%' }}
                                  placeholder="vd: octocat"
                                  value={memberGithub}
                                  onChange={e => setMemberGithub(e.target.value)}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  disabled={savingMember}
                                  onClick={() => handleAddMember(team.id)}
                                >
                                  {savingMember ? 'Đang thêm...' : 'Lưu'}
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setAddingMemberTeamId(null);
                                    setSelectedStudentId('');
                                  }}
                                >
                                  Hủy
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: '0.75rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.8rem', background: '#1e293b', color: '#38bdf8', border: '1px dashed #38bdf8' }}
                              onClick={() => {
                                setAddingMemberTeamId(team.id);
                                setSelectedStudentId('');
                                setMemberRole('MEMBER');
                                setMemberGithub('');
                              }}
                            >
                              + Thêm thành viên vào nhóm này
                            </button>
                          </div>
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
                    <th>Điểm Test Cases</th>
                    <th>Clean Code (AI)</th>
                    <th>AST</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <strong>{sub.student?.fullName || 'Sinh viên'}</strong>
                        {sub.team && <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>👥 Nhóm: {sub.team.name}</div>}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sub.student?.email || ''}</div>
                      </td>
                      <td>{formatDate(sub.submittedAt)}</td>
                      <td>
                        <span className={`badge ${sub.status === 'COMPLETED' ? 'badge-green' : sub.status === 'COMPILE_ERROR' ? 'badge-red' : sub.status === 'RUNNING' ? 'badge-yellow' : 'badge-blue'}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '1.05rem', color: '#34d399' }}>
                        {sub.totalScore} pts
                      </td>
                      <td>
                        {sub.aiReviews?.[0] ? (
                          <span className={`badge ${sub.aiReviews[0].cleanCodeScore >= 8.5 ? 'badge-green' : sub.aiReviews[0].cleanCodeScore >= 7.0 ? 'badge-blue' : sub.aiReviews[0].cleanCodeScore >= 5.0 ? 'badge-yellow' : 'badge-red'}`}>
                            ✨ {sub.aiReviews[0].cleanCodeScore}/10
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Chưa review</span>
                        )}
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
                <td><Link to={`/student/submissions/${report.submissionAId}`}>{report.submissionA?.student?.fullName || report.submissionAId?.slice(0, 8)}</Link><div>{report.submissionAId?.slice(0, 8)}</div></td>
                <td><Link to={`/student/submissions/${report.submissionBId}`}>{report.submissionB?.student?.fullName || report.submissionBId?.slice(0, 8)}</Link><div>{report.submissionBId?.slice(0, 8)}</div></td>
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
