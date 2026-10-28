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
      setGroupExams(
        classesRes.data.flatMap((classItem: any) =>
          (classItem.exams || [])
            .filter((exam: any) => exam.examType === 'GROUP')
            .map((exam: any) => ({ ...exam, classCode: classItem.classCode }))
        )
      );
    }
    if (res.success && res.data) {
      setTeams(res.data);
      setUsernames(
        Object.fromEntries(
          res.data.flatMap((team: any) =>
            (team.members || []).map((member: any) => [
              `${team.id}:${member.studentId}`,
              member.githubUsername || '',
            ])
          )
        )
      );
      const candidateData = await Promise.all(
        res.data.map(async (team: any) => {
          const isLeader = team.members?.some(
            (member: any) => member.studentId === user?.id && member.role === 'LEADER'
          );
          if (!isLeader) return [team.id, []] as const;
          const candidatesRes = await apiRequest(`/teams/${team.id}/candidates`);
          return [team.id, candidatesRes.success ? candidatesRes.data || [] : []] as const;
        })
      );
      setCandidates(Object.fromEntries(candidateData));
    } else {
      setNotice(res.message || 'Không tải được danh sách nhóm.');
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

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
      setNotice('Đã tạo nhóm thành công. Bạn đã được chỉ định làm trưởng nhóm.');
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
      setSelectedStudents((current) => ({ ...current, [team.id]: '' }));
      setNotice(`Đã thêm thành viên vào nhóm "${team.name}".`);
      await loadTeams();
    } else {
      setNotice(res.message || 'Không thêm được thành viên.');
    }
  };

  const removeMember = async (team: any, member: any) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${member.student?.fullName}" khỏi nhóm "${team.name}"?`))
      return;
    setNotice('');
    const res = await apiRequest(`/teams/${team.id}/members/${member.studentId}`, { method: 'DELETE' });
    if (res.success) {
      setNotice(`Đã xóa "${member.student?.fullName}" khỏi nhóm "${team.name}".`);
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
      setTeams((current) =>
        current.map((item) =>
          item.id !== team.id
            ? item
            : {
                ...item,
                members: item.members.map((itemMember: any) =>
                  itemMember.studentId === member.studentId
                    ? { ...itemMember, githubUsername: username }
                    : itemMember
                ),
              }
        )
      );
      setUsernames((current) => ({ ...current, [memberKey]: username }));
      setNotice(`Đã cập nhật GitHub username cho ${member.student?.fullName || 'thành viên'}.`);
    } else {
      setNotice(res.message || 'Không cập nhật được GitHub username.');
    }
  };

  const availableGroupExams = groupExams.filter(
    (exam) => !teams.some((team) => team.examId === exam.id)
  );

  return (
    <div className="container" style={{ maxWidth: 1050, paddingBottom: '3rem' }}>
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
          Quay lại Dashboard
        </Link>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>
          Nhóm của tôi
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Quản lý thành viên nhóm, đăng ký GitHub username để hệ thống đối soát đóng góp và phân bổ điểm công bằng.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-control)',
            background: notice.startsWith('Đã ')
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            border: notice.startsWith('Đã ')
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : '1px solid rgba(239, 68, 68, 0.3)',
            color: notice.startsWith('Đã ') ? '#34d399' : '#fca5a5',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
          }}
        >
          {notice.startsWith('Đã ') ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          <span>{notice}</span>
        </div>
      )}

      {/* CREATE NEW TEAM FORM */}
      {availableGroupExams.length > 0 && (
        <form
          className="card"
          onSubmit={createTeam}
          style={{ marginBottom: '1.75rem', border: '1px solid #334155' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ padding: '0.35rem', borderRadius: '0.35rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Tạo nhóm mới cho bài thi nhóm
            </h3>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Chọn đề bài kiểm tra nhóm và đặt tên nhóm để bắt đầu mời các bạn cùng lớp tham gia.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr)) auto', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="create-team-exam" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Đề thi nhóm *
              </label>
              <select
                id="create-team-exam"
                className="form-control"
                value={createExamId}
                onChange={(event) => setCreateExamId(event.target.value)}
                required
              >
                <option value="">-- Chọn bài thi nhóm --</option>
                {availableGroupExams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.classCode} · {exam.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="new-team-name" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Tên nhóm bài tập *
              </label>
              <input
                id="new-team-name"
                className="form-control"
                value={newTeamName}
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder="Ví dụ: Nhóm 1 - AITA Innovators"
                required
              />
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={creatingTeam}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              {creatingTeam ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Đang tạo...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Tạo nhóm
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TEAMS LIST */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2].map((n) => (
            <div key={n} className="card" style={{ padding: '2rem' }}>
              <div className="skeleton-line" style={{ width: '30%' }} />
              <div className="skeleton-line" style={{ width: '60%', height: '1.4rem', margin: '0.75rem 0' }} />
              <div className="skeleton-line" style={{ width: '45%' }} />
            </div>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="empty-state-box">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1.8"
            style={{ marginBottom: '0.75rem' }}
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Bạn chưa thuộc nhóm nào
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
            Khi có bài thi nhóm, bạn có thể tạo nhóm mới ở trên hoặc nhờ trưởng nhóm thêm vào danh sách thành viên.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {teams.map((team) => {
            const leader = team.members?.find((member: any) => member.role === 'LEADER');
            const isLeader = leader?.studentId === user?.id;
            const latestSubmission = team.latestSubmission;
            const scoreReady =
              latestSubmission?.scoreReleased &&
              ['COMPLETED', 'COMPILE_ERROR', 'FAILED'].includes(latestSubmission.status);

            return (
              <section
                key={team.id}
                className="card"
                style={{
                  border: isLeader ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Team Card Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-blue">
                        {team.exam?.class?.classCode || 'Lớp học'}
                      </span>
                      {isLeader && (
                        <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          Bạn là Trưởng nhóm
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {team.name}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Đề thi: <strong style={{ color: '#cbd5e1' }}>{team.exam?.title}</strong> · Trưởng nhóm:{' '}
                      <strong style={{ color: '#f8fafc' }}>{leader?.student?.fullName || 'Chưa chỉ định'}</strong>
                    </p>
                  </div>

                  {team.repoUrl ? (
                    <a
                      className="btn btn-secondary btn-sm"
                      href={team.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Mở repository
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chưa cấu hình repo</span>
                  )}
                </div>

                {/* Score Summary Box */}
                <div
                  style={{
                    margin: '1.25rem 0',
                    padding: '0.85rem 1.15rem',
                    background: 'var(--surface-inset)',
                    borderRadius: 'var(--radius-control)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.45rem', borderRadius: '0.4rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                        Điểm bài nộp nhóm
                      </span>
                      {!latestSubmission ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chưa có bài nộp nào</span>
                      ) : scoreReady ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>
                            {latestSubmission.totalScore} pts
                          </span>
                          <span className={`badge ${latestSubmission.status === 'COMPLETED' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.75rem' }}>
                            {latestSubmission.status}
                          </span>
                        </div>
                      ) : latestSubmission.scoreReleased ? (
                        <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>Đang chạy test cases tự động…</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                          Đã nộp · Điểm công bố sau {new Date(team.scoreReleaseAt).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>

                  {scoreReady && latestSubmission?.id && (
                    <Link
                      className="btn btn-secondary btn-sm"
                      to={`/student/submissions/${latestSubmission.id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <span>Xem điểm chi tiết & Khiếu nại</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </Link>
                  )}
                </div>

                {/* Team Members List */}
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      Thành viên nhóm ({team.members?.length || 0})
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {team.members?.map((member: any) => {
                      const isMe = member.studentId === user?.id;
                      const canEditGithub = isLeader || isMe;
                      const memberKey = `${team.id}:${member.studentId}`;

                      return (
                        <div
                          key={member.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            padding: '0.75rem 1rem',
                            background: isMe ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface-inset)',
                            border: isMe ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid var(--border)',
                            borderRadius: 'var(--radius-control)',
                          }}
                        >
                          <div style={{ flex: '1 1 240px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                {member.student?.fullName}
                              </strong>
                              {isMe && (
                                <span style={{ fontSize: '0.7rem', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                  Bạn
                                </span>
                              )}
                              <span
                                className={`badge ${member.role === 'LEADER' ? 'badge-yellow' : 'badge-blue'}`}
                                style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                              >
                                {member.role === 'LEADER' ? 'Trưởng nhóm' : 'Thành viên'}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                              {member.student?.email}
                            </div>

                            {/* GitHub Username Display or Input */}
                            {canEditGithub ? (
                              <form
                                onSubmit={(event) => saveUsername(event, team, member)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}
                              >
                                <div style={{ position: 'relative', width: 'min(16rem, 100%)' }}>
                                  <input
                                    className="form-control"
                                    style={{
                                      width: '100%',
                                      minHeight: '2rem',
                                      padding: '0.3rem 0.6rem 0.3rem 1.8rem',
                                      fontSize: '0.8rem',
                                      background: '#090d16',
                                    }}
                                    aria-label={`GitHub username của ${member.student?.fullName}`}
                                    value={usernames[memberKey] || ''}
                                    onChange={(event) =>
                                      setUsernames((current) => ({ ...current, [memberKey]: event.target.value }))
                                    }
                                    placeholder="GitHub username"
                                  />
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#64748b"
                                    strokeWidth="2"
                                    style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)' }}
                                  >
                                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                                  </svg>
                                </div>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  type="submit"
                                  disabled={savingTeamId === memberKey}
                                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                                >
                                  {savingTeamId === memberKey ? 'Đang lưu...' : 'Lưu'}
                                </button>
                              </form>
                            ) : member.githubUsername ? (
                              <div style={{ color: '#38bdf8', fontSize: '0.8rem', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                                <span>@{member.githubUsername}</span>
                              </div>
                            ) : null}
                          </div>

                          {/* Action Button: Remove Member */}
                          {isLeader && member.role !== 'LEADER' && (
                            <button
                              className="btn btn-ghost-danger btn-sm"
                              type="button"
                              onClick={() => void removeMember(team, member)}
                              title="Xóa thành viên khỏi nhóm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              Xóa
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add Member Form (Leader Only) */}
                {isLeader && (
                  <form
                    onSubmit={(event) => addMember(event, team)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px dashed var(--border)',
                    }}
                  >
                    <div className="form-group" style={{ flex: '1 1 18rem', marginBottom: 0 }}>
                      <label
                        htmlFor={`team-member-${team.id}`}
                        style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}
                      >
                        Thêm sinh viên cùng lớp chưa có nhóm
                      </label>
                      <select
                        id={`team-member-${team.id}`}
                        className="form-control"
                        value={selectedStudents[team.id] || ''}
                        onChange={(event) =>
                          setSelectedStudents((current) => ({ ...current, [team.id]: event.target.value }))
                        }
                      >
                        <option value="">-- Chọn sinh viên để thêm --</option>
                        {(candidates[team.id] || []).map((candidate: any) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.fullName} ({candidate.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="submit"
                      disabled={!selectedStudents[team.id]}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.9rem' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Thêm vào nhóm
                    </button>
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
