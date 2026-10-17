"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamRouter = void 0;
const express_1 = require("express");
const team_service_1 = require("./team.service");
const team_repository_1 = require("./team.repository");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const class_access_1 = require("../classes/class-access");
const http_1 = require("../../shared/http");
exports.teamRouter = (0, express_1.Router)();
async function authorizeTeamManagement(teamId, user) {
    const team = await team_repository_1.teamRepository.findTeamById(teamId);
    if (!team)
        throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
    if (user.role === 'LECTURER' || user.role === 'ADMIN') {
        await (0, class_access_1.classAccess)(team.exam.classId, user, true);
        return;
    }
    if (user.role !== 'STUDENT' || !team.members.some(member => member.studentId === user.userId && member.role === 'LEADER')) {
        throw new http_1.HttpError(403, 'Chỉ trưởng nhóm hoặc giảng viên phụ trách mới có thể quản lý thành viên.');
    }
}
// Lecturer-created teams, or student-created teams with the creator assigned as leader.
exports.teamRouter.post('/exams/:examId/teams', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const examId = req.params.examId;
        const { name, repoUrl } = req.body;
        let team;
        if (req.user.role === 'STUDENT') {
            team = await team_service_1.teamService.createStudentTeam(examId, req.user.userId, name);
        }
        else if (req.user.role === 'LECTURER' || req.user.role === 'ADMIN') {
            team = await team_service_1.teamService.createTeam(examId, name, repoUrl);
        }
        else {
            throw new http_1.HttpError(403, 'Bạn không có quyền tạo nhóm.');
        }
        res.status(201).json({ success: true, data: team });
    }
    catch (error) {
        next(error);
    }
});
// LECTURER: Delete empty team
exports.teamRouter.delete('/teams/:teamId', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)('LECTURER', 'ADMIN'), async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const result = await team_service_1.teamService.deleteTeam(teamId);
        res.status(200).json({ success: true, message: result.message });
    }
    catch (error) {
        next(error);
    }
});
// GET all teams for an exam (Lecturer or Student in class)
exports.teamRouter.get('/exams/:examId/teams', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const examId = req.params.examId;
        const teams = await team_service_1.teamService.getTeamsByExam(examId);
        res.status(200).json({ success: true, data: teams });
    }
    catch (error) {
        next(error);
    }
});
// GET student's own team for an exam
exports.teamRouter.get('/exams/:examId/my-team', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const examId = req.params.examId;
        const team = await team_repository_1.teamRepository.findTeamByStudent(examId, req.user.userId);
        res.status(200).json({ success: true, data: team });
    }
    catch (error) {
        next(error);
    }
});
// GET all teams the current student belongs to
exports.teamRouter.get('/teams/my', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teams = await team_repository_1.teamRepository.findTeamsByStudent(req.user.userId);
        const data = teams.map((team) => {
            const { submissions, ...teamData } = team;
            const latest = submissions?.[0];
            const scoreReleased = req.user.role !== 'STUDENT' || (team.exam && new Date() >= team.exam.endTime);
            return {
                ...teamData,
                latestSubmission: latest ? {
                    id: latest.id,
                    attemptNumber: latest.attemptNumber,
                    status: latest.status,
                    submittedAt: latest.submittedAt,
                    commitSha: latest.commitSha,
                    repoMatchStatus: latest.repoMatchStatus,
                    repoMatchPercent: latest.repoMatchPercent,
                    scoreReleased,
                    totalScore: scoreReleased ? latest.totalScore : null,
                } : null,
                scoreReleaseAt: team.exam?.endTime,
            };
        });
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
// ADD member to team
exports.teamRouter.post('/teams/:teamId/members', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const { studentId, role, githubUsername } = req.body;
        if (!studentId)
            throw new http_1.HttpError(400, 'studentId không được để trống.');
        await authorizeTeamManagement(teamId, req.user);
        const assignedRole = req.user.role === 'STUDENT' ? 'MEMBER' : role;
        const member = await team_service_1.teamService.addMember(teamId, studentId, assignedRole, githubUsername);
        res.status(201).json({ success: true, data: member });
    }
    catch (error) {
        next(error);
    }
});
exports.teamRouter.get('/teams/:teamId/candidates', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        await authorizeTeamManagement(teamId, req.user);
        const candidates = await team_service_1.teamService.getTeamCandidates(teamId);
        res.status(200).json({ success: true, data: candidates });
    }
    catch (error) {
        next(error);
    }
});
// REMOVE member from team
exports.teamRouter.delete('/teams/:teamId/members/:studentId', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const studentId = req.params.studentId;
        await authorizeTeamManagement(teamId, req.user);
        if (req.user.role === 'STUDENT' && req.user.userId === studentId) {
            throw new http_1.HttpError(400, 'Không thể tự xóa mình khỏi nhóm này.');
        }
        await team_service_1.teamService.removeMember(teamId, studentId);
        res.status(200).json({ success: true, message: 'Đã xóa thành viên khỏi nhóm.' });
    }
    catch (error) {
        next(error);
    }
});
// BR-13: LECTURER changes team leader
exports.teamRouter.put('/teams/:teamId/leader', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)('LECTURER', 'ADMIN'), async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const { newLeaderStudentId, reason } = req.body;
        if (!newLeaderStudentId)
            throw new http_1.HttpError(400, 'newLeaderStudentId không được để trống.');
        const team = await team_repository_1.teamRepository.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        await (0, class_access_1.classAccess)(team.exam.classId, req.user, true);
        const updated = await team_service_1.teamService.changeLeader(teamId, newLeaderStudentId, req.user.userId, reason);
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// UPDATE team GitHub Repo URL
exports.teamRouter.put('/teams/:teamId/repo', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const { repoUrl, reason } = req.body;
        if (!repoUrl)
            throw new http_1.HttpError(400, 'repoUrl không được để trống.');
        const team = await team_repository_1.teamRepository.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        const isLecturer = req.user.role === 'LECTURER' || req.user.role === 'ADMIN';
        if (isLecturer) {
            await (0, class_access_1.classAccess)(team.exam.classId, req.user, true);
        }
        else {
            const isLeader = team.members.some(member => member.studentId === req.user.userId && member.role === 'LEADER');
            if (!isLeader) {
                throw new http_1.HttpError(403, 'Chỉ Trưởng nhóm (Team Leader) hoặc giảng viên phụ trách mới có quyền cập nhật repository.');
            }
        }
        const updated = await team_service_1.teamService.updateRepoUrl(teamId, repoUrl, req.user.userId, reason);
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// UPDATE student's GitHub username (Lecturer, Leader, or self)
exports.teamRouter.put('/teams/:teamId/members/:studentId/github', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const studentId = req.params.studentId;
        const { githubUsername } = req.body;
        const team = await team_repository_1.teamRepository.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        const targetMember = team.members.find(member => member.studentId === studentId);
        if (!targetMember)
            throw new http_1.HttpError(404, 'Thành viên không thuộc nhóm này.');
        const isLecturer = req.user.role === 'LECTURER' || req.user.role === 'ADMIN';
        if (isLecturer) {
            await (0, class_access_1.classAccess)(team.exam.classId, req.user, true);
        }
        else {
            const isSelf = req.user.userId === studentId;
            const isLeader = team.members.some(member => member.studentId === req.user.userId && member.role === 'LEADER');
            if (!isSelf && !isLeader) {
                throw new http_1.HttpError(403, 'Chỉ trưởng nhóm, giảng viên phụ trách hoặc chính sinh viên mới có quyền cập nhật GitHub username.');
            }
        }
        const member = await team_service_1.teamService.updateMemberGithub(teamId, studentId, (githubUsername || '').trim());
        res.status(200).json({ success: true, data: member });
    }
    catch (error) {
        next(error);
    }
});
// LECTURER: Manual grade override for a team member
exports.teamRouter.put('/teams/:teamId/members/:studentId/score', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)('LECTURER', 'ADMIN'), async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const studentId = req.params.studentId;
        const { score, reason } = req.body;
        const team = await team_repository_1.teamRepository.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        await (0, class_access_1.classAccess)(team.exam.classId, req.user, true);
        const targetMember = team.members.find(member => member.studentId === studentId);
        if (!targetMember)
            throw new http_1.HttpError(404, 'Thành viên không thuộc nhóm này.');
        const updated = await team_service_1.teamService.updateMemberScore(teamId, studentId, Number(score), req.user.userId, reason);
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// UPDATE student's own GitHub username (alias)
exports.teamRouter.put('/teams/:teamId/my-github', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const { githubUsername } = req.body;
        if (!githubUsername)
            throw new http_1.HttpError(400, 'githubUsername không được để trống.');
        const member = await team_service_1.teamService.updateMemberGithub(teamId, req.user.userId, githubUsername);
        res.status(200).json({ success: true, data: member });
    }
    catch (error) {
        next(error);
    }
});
// UC19: Trigger Git Analytics sync & BR-12 scoring
exports.teamRouter.post('/teams/:teamId/sync-git', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const team = await team_repository_1.teamRepository.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        const isLecturer = req.user.role === 'LECTURER' || req.user.role === 'ADMIN';
        if (isLecturer) {
            await (0, class_access_1.classAccess)(team.exam.classId, req.user, true);
        }
        else {
            if (!team.members.some(m => m.studentId === req.user.userId)) {
                throw new http_1.HttpError(403, 'Bạn không thuộc nhóm này.');
            }
        }
        const contributions = await team_service_1.teamService.syncGitAnalytics(teamId);
        res.status(200).json({ success: true, data: contributions });
    }
    catch (error) {
        next(error);
    }
});
// UC20: View Teamwork Contribution Report
exports.teamRouter.get('/teams/:teamId/contributions', auth_middleware_1.authenticateJwt, async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const team = await team_repository_1.teamRepository.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        const isLecturer = req.user.role === 'LECTURER' || req.user.role === 'ADMIN';
        if (isLecturer) {
            await (0, class_access_1.classAccess)(team.exam.classId, req.user, true);
        }
        else {
            if (!team.members.some(m => m.studentId === req.user.userId)) {
                throw new http_1.HttpError(403, 'Bạn không thuộc nhóm này.');
            }
        }
        const contributions = await team_service_1.teamService.getTeamContributions(teamId);
        res.status(200).json({ success: true, data: contributions });
    }
    catch (error) {
        next(error);
    }
});
