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
  const [createExamId, setCreateExamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingTeamId, setSavingTeamId] = useState('');
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

  const availableGroupExams = groupExams.filter(exam => !teams.some(team => team.examId === exam.id));

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/student">← Quay lại Dashboard</Link>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Nhóm của tôi</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Tạo nhóm, quản lý thành viên và GitHub username để hệ thống nhận diện commit.</p>
      </div>

      {notice && <p role="status" style={{ marginBottom: '1rem', color: notice.startsWith('Đã ') ? '#34d399' : '#fca5a5' }}>{notice}</p>}
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
          <small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Người tạo nhóm sẽ tự động được đặt làm trưởng nhóm.</small>
        </form>
      )}
      {loading ? (
        <p>Đang tải danh sách nhóm...</p>
      ) : teams.length === 0 ? (
        <div className="card"><p>Bạn chưa được thêm vào nhóm nào.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {teams.map(team => {
            const leader = team.members?.find((member: any) => member.role === 'LEADER');
            const isLeader = leader?.studentId === user?.id;
            const latestSubmission = team.latestSubmission;
            const scoreReady = latestSubmission?.scoreReleased && ['COMPLETED', 'COMPILE_ERROR', 'FAILED'].includes(latestSubmission.status);
            return (
              <section key={team.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <span className="badge badge-blue">{team.exam?.class?.classCode || 'Lớp học'}</span>
                    <h3 style={{ marginTop: '0.5rem' }}>{team.name}</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Đề: {team.exam?.title} · Trưởng nhóm: {leader?.student?.fullName || 'Chưa chỉ định'}
                    </p>
                  </div>
                  {team.repoUrl && <a className="btn btn-secondary btn-sm" href={team.repoUrl} target="_blank" rel="noreferrer">Mở repository</a>}
                </div>

                <div className="team-score-summary">
                  <strong>Điểm nhóm</strong>
                  {!latestSubmission ? (
                    <span>Chưa có bài nộp</span>
                  ) : scoreReady ? (
                    <span className="team-score-value">{latestSubmission.totalScore} điểm <span className="team-score-status">· {latestSubmission.status}</span></span>
                  ) : latestSubmission.scoreReleased ? (
                    <span>Đang chấm bài nhóm…</span>
                  ) : (
                    <span>Đã nộp · Điểm công bố sau {new Date(team.scoreReleaseAt).toLocaleString('vi-VN')}</span>
                  )}
                  {scoreReady && latestSubmission?.id && (
                    <Link className="btn btn-secondary btn-sm" to={`/student/submissions/${latestSubmission.id}`}>
                      Xem điểm chi tiết và khiếu nại
                    </Link>
                  )}
                </div>

                <h4 style={{ margin: '1.25rem 0 0.5rem', color: 'var(--text-secondary)' }}>
                  Thành viên ({team.members?.length || 0})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {team.members?.map((member: any) => (
                    <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.65rem 0.75rem', background: 'var(--surface-inset)', borderRadius: 'var(--radius-control)' }}>
                      <div>
                        <strong>{member.student?.fullName}</strong>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{member.student?.email}</span>
                        {!(isLeader || member.studentId === user?.id) && member.githubUsername && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>@{member.githubUsername}</div>}
                        {(isLeader || member.studentId === user?.id) && (
                          <form onSubmit={event => saveUsername(event, team, member)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                            <input
                              className="form-control"
                              style={{ width: 'min(16rem, 100%)', minHeight: '2.15rem', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              aria-label={`GitHub username của ${member.student?.fullName}`}
                              value={usernames[`${team.id}:${member.studentId}`] || ''}
                              onChange={event => setUsernames(current => ({ ...current, [`${team.id}:${member.studentId}`]: event.target.value }))}
                              placeholder="GitHub username"
                            />
                            <button className="btn btn-secondary btn-sm" type="submit" disabled={savingTeamId === `${team.id}:${member.studentId}`}>
                              {savingTeamId === `${team.id}:${member.studentId}` ? 'Đang lưu...' : 'Lưu username'}
                            </button>
                          </form>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <span className={`badge ${member.role === 'LEADER' ? 'badge-yellow' : 'badge-blue'}`}>
                        {member.role === 'LEADER' ? 'Trưởng nhóm' : 'Thành viên'}
                      </span>
                      {isLeader && member.role !== 'LEADER' && <button className="btn btn-ghost-danger btn-sm" type="button" onClick={() => void removeMember(team, member)}>Xóa</button>}
                      </div>
                    </div>
                  ))}
                </div>

                {isLeader && (
                  <form onSubmit={event => addMember(event, team)} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    <div className="form-group" style={{ flex: '1 1 16rem', marginBottom: 0 }}>
                      <label htmlFor={`team-member-${team.id}`}>Thêm thành viên cùng lớp</label>
                      <select
                        id={`team-member-${team.id}`}
                        className="form-control"
                        value={selectedStudents[team.id] || ''}
                        onChange={event => setSelectedStudents(current => ({ ...current, [team.id]: event.target.value }))}
                      >
                        <option value="">Chọn sinh viên</option>
                        {(candidates[team.id] || []).map((candidate: any) => <option key={candidate.id} value={candidate.id}>{candidate.fullName} ({candidate.email})</option>)}
                      </select>
                    </div>
                    <button className="btn btn-secondary" type="submit" disabled={!selectedStudents[team.id]}>Thêm thành viên</button>
                  </form>
                )}

              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
