import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlagiarismInvestigationModal } from './PlagiarismInvestigationModal';

const formatDate = (value?: string) => {
  if (!value) return '-';
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  const [approvingLateId, setApprovingLateId] = useState<string | null>(null);

  // AST Plagiarism states
  const [investigatingReportId, setInvestigatingReportId] = useState<string | null>(null);
  const [scanningPlagiarism, setScanningPlagiarism] = useState(false);
  const [plagiarismScanMessage, setPlagiarismScanMessage] = useState('');
  const [plagiarismFilterStatus, setPlagiarismFilterStatus] = useState<string>('ALL');
  const [plagiarismMinScore, setPlagiarismMinScore] = useState<number>(0);
  const [plagiarismSearch, setPlagiarismSearch] = useState<string>('');

  const selectedExam = exams.find(exam => exam.id === selectedExamId);

  const handleScanPlagiarism = async () => {
    if (!selectedExamId) return;
    setScanningPlagiarism(true);
    setPlagiarismScanMessage('');
    try {
      const res = await apiRequest(`/exams/${selectedExamId}/plagiarism/scan`, { method: 'POST' });
      if (res.success) {
        setPlagiarismScanMessage(`Quét thành công: ${res.data?.totalSubmissions || 0} bài nộp, ${res.data?.reportsCount || 0} cặp đối soát (${res.data?.suspectedCount || 0} nghi vấn cao).`);
        const reportRes = await apiRequest(`/exams/${selectedExamId}/plagiarism`);
        if (reportRes.success && reportRes.data) setReports(reportRes.data);
        setTimeout(() => setPlagiarismScanMessage(''), 5000);
      } else {
        setError(res.message || 'Quét đạo văn thất bại.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi quét đạo văn.');
    } finally {
      setScanningPlagiarism(false);
    }
  };

  const handleApproveLate = async (submissionId: string) => {
    setApprovingLateId(submissionId);
    setError('');
    const res = await apiRequest(`/submissions/${submissionId}/approve-late`, { method: 'POST' });
    setApprovingLateId(null);
    if (res.success) {
      const [subRes, teamRes] = await Promise.all([
        apiRequest(`/exams/${selectedExamId}/submissions`),
        apiRequest(`/exams/${selectedExamId}/teams`),
      ]);
      if (subRes.success && subRes.data) setSubmissions(subRes.data);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    } else {
      setError(res.message || 'Không thể duyệt bài nộp muộn.');
    }
  };

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
    <div className="container" style={{ paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/lecturer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Quay lại Dashboard
        </Link>
      </div>

      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 0.4rem' }}>Danh sách Đề thi & Kết quả Bài nộp</h2>
      {error && (
        <div role="alert" style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-control)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="lecturer-class-list" style={{ marginTop: '1.5rem' }}>
          {[1, 2].map(n => (
            <div key={n} className="skeleton-box" style={{ height: '160px' }}>
              <div className="skeleton-line" style={{ width: '45%' }} />
              <div className="skeleton-line" style={{ width: '70%', height: '1.3rem', margin: '0.75rem 0' }} />
              <div className="skeleton-line" style={{ width: '35%' }} />
            </div>
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="empty-state-box" style={{ marginTop: '1.5rem' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" style={{ marginBottom: '0.75rem' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Lớp học này chưa có đề thi nào</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Hãy tạo đề thi mới từ Dashboard giảng viên.</p>
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
              <div style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Thời gian: <strong style={{ color: '#60a5fa' }}>{new Date(selectedExam.startTime).toLocaleString('vi-VN')}</strong> — <strong style={{ color: '#f87171' }}>{new Date(selectedExam.endTime).toLocaleString('vi-VN')}</strong>
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

          {/* GROUP TEAMS & GIT ANALYTICS */}
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
                                    <td>
                                      {contrib ? (
                                        contrib.syncStatus === 'FAILED' ? (
                                          <span style={{ color: '#f87171', fontSize: '0.8rem' }} title={contrib.syncError || 'Lỗi đồng bộ'}>
                                            ⚠️ Lỗi sync
                                          </span>
                                        ) : (
                                          `${contrib.commitsCount} commits / +${contrib.locAdded} -${contrib.locDeleted}`
                                        )
                                      ) : '-'}
                                    </td>
                                    <td>
                                      {contrib ? (
                                        <div>
                                          <strong>{contrib.contributionPercent}%</strong>
                                          <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '4px', width: '100px' }}>
                                            <div style={{ background: contrib.isWarning ? '#ef4444' : '#3b82f6', height: '100%', width: `${Math.min(100, contrib.contributionPercent)}%`, borderRadius: '3px' }} />
                                          </div>
                                          {contrib.isWarning && (
                                            <span className="badge badge-red" style={{ fontSize: '0.68rem', display: 'inline-block', marginTop: '3px' }} title="Đóng góp dưới 5% tổng hoạt động nhóm">
                                              ⚠️ &lt; 5%
                                            </span>
                                          )}
                                        </div>
                                      ) : '-'}
                                    </td>
                                    <td style={{ minWidth: '140px' }}>
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: (contrib && contrib.personalScore != null) ? '#34d399' : '#94a3b8' }}>
                                            {(contrib && contrib.personalScore != null) ? `${contrib.personalScore} pts` : latestSub?.status === 'COMPLETED' ? 'Chưa tính' : '-'}
                                          </span>
                                          {contrib?.isManualOverride && (
                                            <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }} title="Điểm đã được GV chỉnh tay">
                                              GV sửa
                                            </span>
                                          )}
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
                                    .filter(s => !teams.some(t => t.members?.some((m: any) => m.studentId === s.id)))
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
                        {sub.team && (
                          <div style={{ fontSize: '0.8rem', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            Nhóm: {sub.team.name}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sub.student?.email || ''}</div>
                      </td>
                      <td>{formatDate(sub.submittedAt)}</td>
                      <td>
                        <span className={`badge ${sub.status === 'COMPLETED' ? 'badge-green' : sub.status === 'COMPILE_ERROR' ? 'badge-red' : sub.status === 'RUNNING' ? 'badge-yellow' : sub.status === 'LATE' ? 'badge-yellow' : 'badge-blue'}`}>
                          {sub.status === 'LATE' ? 'NỘP MUỘN (Chờ duyệt)' : sub.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '1.05rem', color: '#34d399' }}>
                        {sub.totalScore} pts
                      </td>
                      <td>
                        {sub.aiReviews?.[0] ? (
                          <span className={`badge ${sub.aiReviews[0].cleanCodeScore >= 8.5 ? 'badge-green' : sub.aiReviews[0].cleanCodeScore >= 7.0 ? 'badge-blue' : sub.aiReviews[0].cleanCodeScore >= 5.0 ? 'badge-yellow' : 'badge-red'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            {sub.aiReviews[0].cleanCodeScore}/10
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Chưa review</span>
                        )}
                      </td>
                      <td>{sub.astStatus}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <Link to={`/student/submissions/${sub.id}`} className="btn btn-secondary btn-sm">
                            Xem chi tiết
                          </Link>
                          {sub.status === 'LATE' && (
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={approvingLateId === sub.id}
                              onClick={() => handleApproveLate(sub.id)}
                            >
                              {approvingLateId === sub.id ? 'Đang duyệt...' : 'Duyệt bài muộn'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* PLAGIARISM & AST MONITORING CENTER */}
          <div className="card" style={{ marginTop: '1.5rem', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ backgroundColor: '#1e3a8a', color: '#93c5fd', padding: '0.2rem 0.6rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700 }}>
                    AST WINNOWING
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>Trung tâm Giám sát & Đối soát Đạo văn</h3>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.3rem 0 0 0' }}>
                  Đối soát cấu trúc trừu tượng (AST) và dấu vân tay mã nguồn k-gram giữa các bài nộp mới nhất của sinh viên.
                </p>
              </div>

              <button
                className="btn btn-primary"
                disabled={scanningPlagiarism || submissions.length < 2}
                onClick={handleScanPlagiarism}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                title={submissions.length < 2 ? 'Cần ít nhất 2 bài nộp để đối soát đạo văn' : 'Chạy lại toàn bộ thuật toán AST Winnowing'}
              >
                {scanningPlagiarism ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Đang quét...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Quét lại toàn bộ bài thi
                  </>
                )}
              </button>
            </div>

            {plagiarismScanMessage && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#064e3b', border: '1px solid #059669', borderRadius: '0.5rem', color: '#a7f3d0', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                {plagiarismScanMessage}
              </div>
            )}

            {/* METRICS SUMMARY */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ backgroundColor: '#0f172a', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Tổng cặp đối soát</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>{reports.length}</div>
              </div>

              <div style={{ backgroundColor: '#0f172a', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #450a0a' }}>
                <div style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 600 }}>Nghi vấn cao (≥ 75%)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem' }}>
                  {reports.filter(r => r.similarityScore >= 75).length}
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #7f1d1d' }}>
                <div style={{ fontSize: '0.75rem', color: '#fca5a5', textTransform: 'uppercase', fontWeight: 600 }}>Đã xác nhận (CONFIRMED)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>
                  {reports.filter(r => r.status === 'CONFIRMED').length}
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #064e3b' }}>
                <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Đã bỏ qua (DISMISSED)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                  {reports.filter(r => r.status === 'DISMISSED').length}
                </div>
              </div>
            </div>

            {/* FILTER & SEARCH TOOLBAR */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc email sinh viên..."
                  value={plagiarismSearch}
                  onChange={(e) => setPlagiarismSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.75rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Trạng thái:</span>
                <select
                  value={plagiarismFilterStatus}
                  onChange={(e) => setPlagiarismFilterStatus(e.target.value)}
                  style={{ padding: '0.45rem 0.65rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem' }}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="SUSPECTED">Nghi vấn (SUSPECTED)</option>
                  <option value="CONFIRMED">Đã xác nhận (CONFIRMED)</option>
                  <option value="DISMISSED">Đã bỏ qua (DISMISSED)</option>
                  <option value="MODERATE">Trung bình (MODERATE)</option>
                  <option value="LOW">Mức thấp (LOW)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Độ trùng:</span>
                <select
                  value={plagiarismMinScore}
                  onChange={(e) => setPlagiarismMinScore(Number(e.target.value))}
                  style={{ padding: '0.45rem 0.65rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem' }}
                >
                  <option value={0}>Tất cả mức độ</option>
                  <option value={50}>≥ 50% trùng lặp</option>
                  <option value={75}>≥ 75% trùng lặp</option>
                  <option value={90}>≥ 90% trùng lặp</option>
                </select>
              </div>
            </div>

            {/* TABLE */}
            {(() => {
              const filtered = reports.filter(r => {
                if (plagiarismFilterStatus !== 'ALL' && r.status !== plagiarismFilterStatus) return false;
                if (r.similarityScore < plagiarismMinScore) return false;
                if (plagiarismSearch.trim()) {
                  const q = plagiarismSearch.toLowerCase();
                  const nameA = r.submissionA?.student?.fullName?.toLowerCase() || '';
                  const emailA = r.submissionA?.student?.email?.toLowerCase() || '';
                  const nameB = r.submissionB?.student?.fullName?.toLowerCase() || '';
                  const emailB = r.submissionB?.student?.email?.toLowerCase() || '';
                  if (!nameA.includes(q) && !emailA.includes(q) && !nameB.includes(q) && !emailB.includes(q)) return false;
                }
                return true;
              });

              if (!filtered.length) {
                return (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    {reports.length === 0
                      ? 'Chưa có cặp bài nào hoàn tất phân tích AST. Bạn có thể nhấn nút "Quét lại toàn bộ bài thi" ở trên để bắt đầu.'
                      : 'Không có cặp bài nộp nào phù hợp với bộ lọc hiện tại.'}
                  </div>
                );
              }

              return (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Sinh viên A</th>
                        <th>Sinh viên B</th>
                        <th style={{ width: '180px' }}>Độ tương đồng</th>
                        <th>Hash chung</th>
                        <th>Trạng thái</th>
                        <th>Ghi chú của GV</th>
                        <th style={{ textAlign: 'right' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(report => {
                        const score = report.similarityScore;
                        const isRed = score >= 75;
                        const isYellow = score >= 50 && score < 75;
                        const barColor = isRed ? '#ef4444' : isYellow ? '#f59e0b' : '#10b981';

                        return (
                          <tr key={report.id} style={{ backgroundColor: report.status === 'CONFIRMED' ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                            <td>
                              <div style={{ fontWeight: 600, color: '#60a5fa' }}>
                                {report.submissionA?.student?.fullName || 'Sinh viên A'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {report.submissionA?.student?.email}
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: 600, color: '#f472b6' }}>
                                {report.submissionB?.student?.fullName || 'Sinh viên B'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {report.submissionB?.student?.email}
                              </div>
                            </td>

                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ flex: 1, height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, score)}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px' }} />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: barColor, minWidth: '45px' }}>
                                  {score.toFixed(1)}%
                                </span>
                              </div>
                            </td>

                            <td>
                              <span style={{ fontWeight: 600 }}>{report.matchedHashesCount}</span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}> k-grams</span>
                            </td>

                            <td>
                              <span
                                className={`badge ${
                                  report.status === 'CONFIRMED'
                                    ? 'badge-red'
                                    : report.status === 'DISMISSED'
                                    ? 'badge-green'
                                    : report.status === 'SUSPECTED'
                                    ? 'badge-yellow'
                                    : 'badge-blue'
                                }`}
                              >
                                {report.status === 'CONFIRMED' ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    GIAN LẬN
                                  </span>
                                ) : report.status === 'DISMISSED' ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                    HỢP LỆ
                                  </span>
                                ) : report.status === 'SUSPECTED' ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    NGHI VẤN
                                  </span>
                                ) : report.status}
                              </span>
                            </td>

                            <td style={{ maxWidth: '200px', fontSize: '0.8rem', color: report.lecturerNote ? '#cbd5e1' : '#64748b', fontStyle: report.lecturerNote ? 'normal' : 'italic' }}>
                              {report.lecturerNote || 'Chưa có ghi chú'}
                            </td>

                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setInvestigatingReportId(report.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                So sánh chi tiết
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* PLAGIARISM INVESTIGATION MODAL */}
      {investigatingReportId && selectedExamId && (
        <PlagiarismInvestigationModal
          examId={selectedExamId}
          reportId={investigatingReportId}
          onClose={() => setInvestigatingReportId(null)}
          onStatusUpdated={(updatedReport) => {
            setReports(prev => prev.map(r => r.id === updatedReport.id ? { ...r, ...updatedReport } : r));
          }}
        />
      )}

      <ConfirmDialog open={confirmDeleteExam} title="Xóa đề thi?" description={selectedExam ? `Xóa đề “${selectedExam.title}” cùng các test case và báo cáo liên quan? Chỉ đề chưa có bài nộp mới được xóa.` : ''} confirmLabel="Xóa đề" busy={deletingExam} onConfirm={deleteExam} onCancel={() => setConfirmDeleteExam(false)} />
    </div>
  );
};
