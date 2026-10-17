import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export const MyTeamsPage: React.FC = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [groupExams, setGroupExams] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<Record<string, any[]>>({});
  const [selectedStudents, setSelectedStudents] = useState<Record<string, string>>({});
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [repoUrls, setRepoUrls] = useState<Record<string, string>>({});
  const [createExamId, setCreateExamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingTeamId, setSavingTeamId] = useState('');
  const [savingRepoId, setSavingRepoId] = useState('');
  const [syncingTeamId, setSyncingTeamId] = useState('');
  const [notice, setNotice] = useState('');

  const loadTeams = useCallback(async () => {
    setLoading(true);
    const [res, classesRes] = await Promise.all([apiRequest('/teams/my'), apiRequest('/classes')]);
    if (classesRes.success && classesRes.data) {
      setGroupExams(classesRes.data.flatMap((classItem: any) => (classItem.exams || [])
        .filter((exam: any) => exam.examType === 'GROUP')
        .map((exam: any) => ({ ...exam, classCode: classItem.classCode }))));
    }
    if (res.success && res.data) {
      setTeams(res.data);
      setUsernames(Object.fromEntries(res.data.flatMap((team: any) => (team.members || [])
        .map((member: any) => [`${team.id}:${member.studentId}`, member.githubUsername || '']))));
      setRepoUrls(Object.fromEntries(res.data.map((team: any) => [team.id, team.repoUrl || ''])));

      const candidateData = await Promise.all(res.data.map(async (team: any) => {
        const isLeader = team.members?.some((member: any) => member.studentId === user?.id && member.role === 'LEADER');
        if (!isLeader) return [team.id, []] as const;
        const candidatesRes = await apiRequest(`/teams/${team.id}/candidates`);
        return [team.id, candidatesRes.success ? candidatesRes.data || [] : []] as const;
      }));
      setCandidates(Object.fromEntries(candidateData));
    } else {
      setNotice(res.message || 'Không tải được danh sách nhóm.');
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void loadTeams(); }, [loadTeams]);

  const createTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createExamId || !newTeamName.trim()) return;
    setCreatingTeam(true);
    setNotice('');
    const res = await apiRequest(`/exams/${createExamId}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name: newTeamName.trim() }),
    });
    setCreatingTeam(false);
    if (res.success) {
      setNewTeamName('');
      setCreateExamId('');
      setNotice('Đã tạo nhóm. Bạn là trưởng nhóm.');
      await loadTeams();
    } else {
      setNotice(res.message || 'Không tạo được nhóm.');
    }
  };

  const addMember = async (event: React.FormEvent, team: any) => {
    event.preventDefault();
    const studentId = selectedStudents[team.id];
    if (!studentId) return;
    setNotice('');
    const res = await apiRequest(`/teams/${team.id}/members`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
    if (res.success) {
      setSelectedStudents(current => ({ ...current, [team.id]: '' }));
      setNotice(`Đã thêm thành viên vào nhóm ${team.name}.`);
      await loadTeams();
    } else {
      setNotice(res.message || 'Không thêm được thành viên.');
    }
  };

  const removeMember = async (team: any, member: any) => {
    if (!window.confirm(`Xóa ${member.student?.fullName} khỏi nhóm ${team.name}?`)) return;
    setNotice('');
    const res = await apiRequest(`/teams/${team.id}/members/${member.studentId}`, { method: 'DELETE' });
    if (res.success) {
      setNotice(`Đã xóa ${member.student?.fullName} khỏi nhóm ${team.name}.`);
      await loadTeams();
    } else {
      setNotice(res.message || 'Không xóa được thành viên.');
    }
  };

  const saveUsername = async (event: React.FormEvent, team: any, member: any) => {
    event.preventDefault();
    if (!member?.studentId) return;
    setNotice('');
    const memberKey = `${team.id}:${member.studentId}`;
    setSavingTeamId(memberKey);
    const username = (usernames[memberKey] || '').trim();
    const res = await apiRequest(`/teams/${team.id}/members/${member.studentId}/github`, {
      method: 'PUT',
      body: JSON.stringify({ githubUsername: username }),
    });
    setSavingTeamId('');
    if (res.success) {
      setTeams(current => current.map(item => item.id !== team.id ? item : {
        ...item,
        members: item.members.map((itemMember: any) => itemMember.studentId === member.studentId
          ? { ...itemMember, githubUsername: username }
          : itemMember),
      }));
      setUsernames(current => ({ ...current, [memberKey]: username }));
      setNotice(`Đã cập nhật GitHub username của ${member.student?.fullName || 'thành viên'}.`);
    } else {
      setNotice(res.message || 'Không cập nhật được GitHub username.');
    }
  };

  const saveRepo = async (event: React.FormEvent, team: any) => {
    event.preventDefault();
    const url = (repoUrls[team.id] || '').trim();
    if (!url) return;
    setNotice('');
    setSavingRepoId(team.id);
    const res = await apiRequest(`/teams/${team.id}/repo`, {
      method: 'PUT',
      body: JSON.stringify({ repoUrl: url }),
    });
    setSavingRepoId('');
    if (res.success) {
      setNotice(`Đã cập nhật link repository cho nhóm ${team.name}.`);
      await loadTeams();
    } else {
      setNotice(res.message || 'Không cập nhật được repository.');
    }
  };

  const syncGit = async (teamId: string) => {
    setSyncingTeamId(teamId);
    setNotice('');
    const res = await apiRequest(`/teams/${teamId}/sync-git`, { method: 'POST' });
    setSyncingTeamId('');
    if (res.success) {
      setNotice('Đã đồng bộ đóng góp Git và cập nhật điểm cá nhân (BR-12).');
      await loadTeams();
    } else {
      setNotice(res.message || 'Không đồng bộ được Git.');
    }
  };

  const availableGroupExams = groupExams.filter(exam => !teams.some(team => team.examId === exam.id));

  return (
    <div className="container" style={{ maxWidth: 1050 }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/student">← Quay lại Dashboard</Link>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Nhóm của tôi</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Tạo nhóm, quản lý thành viên, GitHub repository và theo dõi phân tích đóng góp Git.</p>
      </div>

      {notice && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-control)', background: notice.startsWith('Đã ') ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${notice.startsWith('Đã ') ? '#34d399' : '#f87171'}`, color: notice.startsWith('Đã ') ? '#34d399' : '#fca5a5' }}>
          {notice}
        </div>
      )}

      {availableGroupExams.length > 0 && (
        <form className="card" onSubmit={createTeam} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Tạo nhóm cho bài thi</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 16rem', marginBottom: 0 }}>
              <label htmlFor="create-team-exam">Bài thi nhóm</label>
              <select id="create-team-exam" className="form-control" value={createExamId} onChange={event => setCreateExamId(event.target.value)} required>
                <option value="">Chọn bài thi</option>
                {availableGroupExams.map(exam => <option key={exam.id} value={exam.id}>{exam.classCode} · {exam.title}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 14rem', marginBottom: 0 }}>
              <label htmlFor="new-team-name">Tên nhóm</label>
              <input id="new-team-name" className="form-control" value={newTeamName} onChange={event => setNewTeamName(event.target.value)} placeholder="Ví dụ: Nhóm 1" required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={creatingTeam}>
              {creatingTeam ? 'Đang tạo...' : 'Tạo nhóm'}
            </button>
          </div>
          <small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Người tạo nhóm sẽ tự động được đặt làm trưởng nhóm (BR-11).</small>
        </form>
      )}

      {loading ? (
        <p>Đang tải danh sách nhóm...</p>
      ) : teams.length === 0 ? (
        <div className="card"><p>Bạn chưa được thêm vào nhóm nào.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {teams.map(team => {
            const leader = team.members?.find((member: any) => member.role === 'LEADER');
            const isLeader = leader?.studentId === user?.id;
            const latestSubmission = team.latestSubmission;
            const scoreReady = latestSubmission?.scoreReleased && ['COMPLETED', 'COMPILE_ERROR', 'FAILED'].includes(latestSubmission.status);
            const teamFailedSync = team.members?.find((m: any) => m.contributions?.[0]?.syncStatus === 'FAILED');

            return (
              <section key={team.id} className="card" style={{ border: isLeader ? '1px solid rgba(56, 189, 248, 0.4)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <span className="badge badge-blue">{team.exam?.class?.classCode || 'Lớp học'}</span>
                    {isLeader && <span className="badge badge-yellow" style={{ marginLeft: '0.5rem' }}>👑 Bạn là Trưởng nhóm</span>}
                    <h3 style={{ marginTop: '0.5rem' }}>{team.name}</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Đề: <strong>{team.exam?.title}</strong> · Trưởng nhóm: <strong>{leader?.student?.fullName || 'Chưa chỉ định'}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {team.repoUrl && (
                      <a className="btn btn-secondary btn-sm" href={team.repoUrl} target="_blank" rel="noreferrer">
                        Mở GitHub
                      </a>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={syncingTeamId === team.id}
                      onClick={() => void syncGit(team.id)}
                      title="Đồng bộ commit và cập nhật tỷ lệ đóng góp từ GitHub"
                    >
                      {syncingTeamId === team.id ? 'Đang đồng bộ...' : '🔄 Đồng bộ Git'}
                    </button>
                  </div>
                </div>

                {/* REPO URL REGISTRATION / INLINE EDIT (BR-11: Leader only) */}
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-inset)', borderRadius: 'var(--radius-control)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>GitHub Repository chính thức:</strong>{' '}
                      {team.repoUrl ? (
                        <a href={team.repoUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{team.repoUrl}</a>
                      ) : (
                        <span style={{ color: '#f87171', fontSize: '0.85rem' }}>Chưa đăng ký repository</span>
                      )}
                    </div>
                  </div>
                  {isLeader && (
                    <form onSubmit={e => saveRepo(e, team)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        className="form-control"
                        style={{ flex: '1 1 20rem', minHeight: '2.15rem', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                        placeholder="https://github.com/owner/repository"
                        value={repoUrls[team.id] ?? ''}
                        onChange={e => setRepoUrls(curr => ({ ...curr, [team.id]: e.target.value }))}
                        pattern="https://github\.com/[^/]+/[^/]+"
                        title="Dạng: https://github.com/owner/repository"
                      />
                      <button className="btn btn-primary btn-sm" type="submit" disabled={savingRepoId === team.id}>
                        {savingRepoId === team.id ? 'Đang lưu...' : 'Lưu link Repo'}
                      </button>
                      <small style={{ color: 'var(--text-secondary)', display: 'block', width: '100%', fontSize: '0.75rem' }}>
                        * Chỉ Trưởng nhóm có quyền đăng ký/thay đổi repository chính thức. Link nộp bài sẽ được đối chiếu với link này.
                      </small>
                    </form>
                  )}
                </div>

                {/* TEAM SCORE SUMMARY */}
                <div className="team-score-summary" style={{ marginTop: '1rem' }}>
                  <strong>Điểm bài nộp nhóm</strong>
                  {!latestSubmission ? (
                    <span>Chưa có bài nộp nào</span>
                  ) : scoreReady ? (
                    <span className="team-score-value">{latestSubmission.totalScore} điểm <span className="team-score-status">· {latestSubmission.status}</span></span>
                  ) : latestSubmission.scoreReleased ? (
                    <span>Đang chấm bài nhóm…</span>
                  ) : (
                    <span>Đã nộp bài · Điểm công bố sau {new Date(team.scoreReleaseAt).toLocaleString('vi-VN')}</span>
                  )}
                  {latestSubmission?.commitSha && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      · Commit: <code style={{ color: '#38bdf8' }}>{latestSubmission.commitSha.slice(0, 7)}</code>
                      {latestSubmission.repoMatchStatus === 'VERIFIED' && (
                        <span className="badge badge-green" style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>🟢 Khớp Repo 100%</span>
                      )}
                      {latestSubmission.repoMatchStatus === 'PARTIAL' && (
                        <span className="badge badge-yellow" style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>🟡 Khớp Repo {latestSubmission.repoMatchPercent}%</span>
                      )}
                      {latestSubmission.repoMatchStatus === 'MISMATCH' && (
                        <span className="badge badge-red" style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>🔴 Lệch Repo (0%)</span>
                      )}
                    </span>
                  )}
                  {scoreReady && latestSubmission?.id && (
                    <Link className="btn btn-secondary btn-sm" to={`/student/submissions/${latestSubmission.id}`}>
                      Xem chi tiết bài nộp
                    </Link>
                  )}
                </div>

                {/* SYNC ERROR BANNER (P0: No mock data on failure) */}
                {teamFailedSync && (
                  <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 'var(--radius-control)', color: '#fca5a5', fontSize: '0.85rem' }}>
                    ⚠️ <strong>Đồng bộ Git không thành công:</strong> {teamFailedSync.contributions[0].syncError || 'Không thể kết nối với GitHub API'}. Hệ thống không tạo số liệu giả mạo.
                  </div>
                )}

                {/* GIT ANALYTICS & CONTRIBUTIONS TABLE (BR-05, BR-12) */}
                <h4 style={{ margin: '1.25rem 0 0.5rem', color: 'var(--text-secondary)' }}>
                  Bảng đóng góp Git & Điểm cá nhân ({team.members?.length || 0}/{team.exam?.maxTeamSize || 5} thành viên)
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.875rem', width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Thành viên</th>
                        <th>Vai trò</th>
                        <th>GitHub Username</th>
                        <th>Commits / LOC</th>
                        <th>% Đóng góp</th>
                        <th>Cảnh báo (BR-05)</th>
                        <th>Điểm cá nhân (BR-12)</th>
                        {isLeader && <th>Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(team.members || []).map((member: any) => {
                        const contrib = member.contributions?.[0];
                        const memberKey = `${team.id}:${member.studentId}`;
                        const canEditGithub = isLeader || member.studentId === user?.id;

                        return (
                          <tr key={member.id}>
                            <td>
                              <strong>{member.student?.fullName}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{member.student?.email}</div>
                            </td>
                            <td>
                              <span className={`badge ${member.role === 'LEADER' ? 'badge-yellow' : 'badge-blue'}`}>
                                {member.role === 'LEADER' ? 'Trưởng nhóm' : 'Thành viên'}
                              </span>
                            </td>
                            <td>
                              {canEditGithub ? (
                                <form onSubmit={event => saveUsername(event, team, member)} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                  <input
                                    className="form-control"
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', width: '120px' }}
                                    aria-label={`GitHub username của ${member.student?.fullName}`}
                                    value={usernames[memberKey] ?? ''}
                                    onChange={event => setUsernames(current => ({ ...current, [memberKey]: event.target.value }))}
                                    placeholder="octocat"
                                  />
                                  <button className="btn btn-secondary btn-sm" type="submit" disabled={savingTeamId === memberKey}>
                                    {savingTeamId === memberKey ? '...' : 'Lưu'}
                                  </button>
                                </form>
                              ) : (
                                <span>{member.githubUsername ? `@${member.githubUsername}` : <span style={{ color: 'var(--text-secondary)' }}>Chưa có</span>}</span>
                              )}
                            </td>
                            <td>
                              {contrib ? `${contrib.commitsCount} commits / +${contrib.locAdded} -${contrib.locDeleted}` : '-'}
                            </td>
                            <td>
                              {contrib ? (
                                <div>
                                  <strong>{contrib.contributionPercent}%</strong>
                                  <div style={{ background: 'var(--surface-inset)', height: '6px', borderRadius: '3px', marginTop: '3px', width: '80px', overflow: 'hidden' }}>
                                    <div style={{ background: contrib.isWarning ? '#ef4444' : '#3b82f6', height: '100%', width: `${Math.min(100, contrib.contributionPercent)}%` }} />
                                  </div>
                                </div>
                              ) : '-'}
                            </td>
                            <td>
                              {contrib?.isWarning ? (
                                <span className="badge badge-red" title="Đóng góp dưới 5% tổng hoạt động nhóm">
                                  ⚠️ &lt; 5% (BR-05)
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Hợp lệ</span>
                              )}
                            </td>
                            <td>
                              {scoreReady ? (
                                <div>
                                  <strong style={{ color: contrib?.personalScore != null ? '#34d399' : undefined }}>
                                    {contrib?.personalScore != null ? `${contrib.personalScore} pts` : 'Chưa tính'}
                                  </strong>
                                  {contrib?.isManualOverride && (
                                    <span className="badge badge-yellow" style={{ fontSize: '0.65rem', marginLeft: '0.35rem' }} title="Điểm đã được giảng viên điều chỉnh">
                                      GV chấm tay
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Chờ công bố</span>
                              )}
                            </td>
                            {isLeader && (
                              <td>
                                {member.role !== 'LEADER' && (
                                  <button className="btn btn-ghost-danger btn-sm" type="button" onClick={() => void removeMember(team, member)}>
                                    Xóa
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ADD MEMBER SECTION (Leader only, max members) */}
                {isLeader && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    {(team.members?.length || 0) >= (team.exam?.maxTeamSize || 5) ? (
                      <div className="badge badge-yellow">
                        Nhóm đã đạt số lượng thành viên tối đa ({team.exam?.maxTeamSize || 5} thành viên).
                      </div>
                    ) : (
                      <form onSubmit={event => addMember(event, team)} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 18rem', marginBottom: 0 }}>
                          <label htmlFor={`team-member-${team.id}`}>Thêm sinh viên cùng lớp vào nhóm</label>
                          <select
                            id={`team-member-${team.id}`}
                            className="form-control"
                            value={selectedStudents[team.id] || ''}
                            onChange={event => setSelectedStudents(current => ({ ...current, [team.id]: event.target.value }))}
                          >
                            <option value="">-- Chọn sinh viên chưa có nhóm --</option>
                            {(candidates[team.id] || []).map((candidate: any) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.fullName} ({candidate.email})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button className="btn btn-secondary" type="submit" disabled={!selectedStudents[team.id]}>
                          + Thêm thành viên
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
