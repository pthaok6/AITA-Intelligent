"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamService = exports.TeamService = void 0;
exports.normalizeRepoUrl = normalizeRepoUrl;
const team_repository_1 = require("./team.repository");
const git_analytics_service_1 = require("./git-analytics.service");
const prisma_1 = require("../../infrastructure/database/prisma");
const http_1 = require("../../shared/http");
function normalizeRepoUrl(raw) {
    if (!raw || typeof raw !== 'string')
        throw new http_1.HttpError(400, 'Link repository không được để trống.');
    const trimmed = raw.trim();
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
        throw new http_1.HttpError(400, 'Link repository GitHub không hợp lệ.');
    }
    if (parsed.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(parsed.hostname.toLowerCase())) {
        throw new http_1.HttpError(400, 'Link repository phải có dạng https://github.com/owner/repository.');
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
        throw new http_1.HttpError(400, 'Link repository phải có dạng https://github.com/owner/repository.');
    }
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, '');
    return `https://github.com/${owner}/${repo}`;
}
class TeamService {
    teamRepo;
    gitAnalytics;
    constructor(teamRepo = team_repository_1.teamRepository, gitAnalytics = git_analytics_service_1.gitAnalyticsService) {
        this.teamRepo = teamRepo;
        this.gitAnalytics = gitAnalytics;
    }
    async createTeam(examId, name, repoUrl) {
        if (!name || !name.trim())
            throw new http_1.HttpError(400, 'Tên nhóm không được để trống.');
        const exam = await prisma_1.prisma.exam.findUnique({ where: { id: examId } });
        if (!exam)
            throw new http_1.HttpError(404, 'Không tìm thấy bài thi.');
        if (exam.examType !== 'GROUP')
            throw new http_1.HttpError(400, 'Bài thi này không phải loại bài tập nhóm.');
        const existing = await prisma_1.prisma.team.findUnique({ where: { examId_name: { examId, name: name.trim() } } });
        if (existing)
            throw new http_1.HttpError(409, `Nhóm "${name}" đã tồn tại trong bài thi này.`);
        return this.teamRepo.createTeam(examId, name.trim(), repoUrl?.trim() || undefined);
    }
    async createStudentTeam(examId, studentId, name) {
        if (!name || !name.trim())
            throw new http_1.HttpError(400, 'Tên nhóm không được để trống.');
        const exam = await prisma_1.prisma.exam.findUnique({ where: { id: examId }, select: { id: true, classId: true, examType: true } });
        if (!exam)
            throw new http_1.HttpError(404, 'Không tìm thấy bài thi.');
        if (exam.examType !== 'GROUP')
            throw new http_1.HttpError(400, 'Chỉ có thể tạo nhóm cho bài thi nhóm.');
        const enrollment = await prisma_1.prisma.classEnrollment.findUnique({
            where: { classId_studentId: { classId: exam.classId, studentId } },
        });
        if (!enrollment || enrollment.status !== 'ACTIVE')
            throw new http_1.HttpError(403, 'Bạn cần đang tham gia lớp để tạo nhóm cho bài thi này.');
        const existingTeam = await this.teamRepo.findTeamByStudent(examId, studentId);
        if (existingTeam)
            throw new http_1.HttpError(409, `Bạn đã thuộc nhóm "${existingTeam.name}" cho bài thi này.`);
        const duplicateName = await prisma_1.prisma.team.findUnique({ where: { examId_name: { examId, name: name.trim() } } });
        if (duplicateName)
            throw new http_1.HttpError(409, `Nhóm "${name.trim()}" đã tồn tại trong bài thi này.`);
        return prisma_1.prisma.$transaction(async (tx) => {
            const team = await tx.team.create({ data: { examId, name: name.trim() } });
            await tx.teamMember.create({ data: { teamId: team.id, studentId, role: 'LEADER' } });
            return tx.team.findUnique({
                where: { id: team.id },
                include: { members: { include: { student: { select: { id: true, fullName: true, email: true } } } } },
            });
        });
    }
    async addMember(teamId, studentId, role = 'MEMBER', githubUsername) {
        const team = await this.teamRepo.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        // Verify student is active in class
        const enrollment = await prisma_1.prisma.classEnrollment.findUnique({
            where: { classId_studentId: { classId: team.exam.classId, studentId } },
        });
        if (!enrollment || enrollment.status !== 'ACTIVE') {
            throw new http_1.HttpError(400, 'Sinh viên này chưa tham gia hoặc không còn hoạt động trong lớp.');
        }
        let assignedRole = role.toUpperCase() === 'LEADER' ? 'LEADER' : 'MEMBER';
        if (assignedRole === 'LEADER') {
            const hasLeader = team.members.some(m => m.role === 'LEADER');
            if (hasLeader) {
                throw new http_1.HttpError(400, 'Nhóm này đã có Trưởng nhóm (Leader). Mỗi nhóm chỉ có duy nhất 1 Leader (BR-11).');
            }
        }
        else if (team.members.length === 0) {
            assignedRole = 'LEADER';
        }
        return prisma_1.prisma.$transaction(async (tx) => {
            // Check if student already in another team of this exam
            const existingInExam = await tx.teamMember.findFirst({
                where: { studentId, team: { examId: team.examId } },
                include: { team: true },
            });
            if (existingInExam) {
                throw new http_1.HttpError(400, `Sinh viên này đã thuộc nhóm "${existingInExam.team.name}".`);
            }
            // Enforce max team size limit according to Exam configuration
            const currentCount = await tx.teamMember.count({ where: { teamId } });
            const maxMembers = team.exam?.maxTeamSize || 5;
            if (currentCount >= maxMembers) {
                throw new http_1.HttpError(400, `Nhóm đã đạt số lượng thành viên tối đa (tối đa ${maxMembers} thành viên theo cấu hình bài thi).`);
            }
            return tx.teamMember.create({
                data: {
                    teamId,
                    studentId,
                    role: assignedRole,
                    githubUsername: githubUsername?.trim() || null,
                },
                include: { student: { select: { id: true, fullName: true, email: true } } },
            });
        });
    }
    async removeMember(teamId, studentId) {
        const member = await prisma_1.prisma.teamMember.findUnique({
            where: { teamId_studentId: { teamId, studentId } },
        });
        if (!member)
            throw new http_1.HttpError(404, 'Không tìm thấy thành viên trong nhóm.');
        if (member.role === 'LEADER') {
            throw new http_1.HttpError(400, 'Không thể xóa Trưởng nhóm. Vui lòng chuyển quyền Leader cho thành viên khác trước (BR-11).');
        }
        return this.teamRepo.removeMember(teamId, studentId);
    }
    // BR-13: Only Lecturer may change a team's Team Leader; records audit log in database
    async changeLeader(teamId, newLeaderStudentId, lecturerId, reason) {
        const team = await this.teamRepo.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        const newLeaderMember = team.members.find(m => m.studentId === newLeaderStudentId);
        if (!newLeaderMember)
            throw new http_1.HttpError(400, 'Sinh viên được chọn không thuộc nhóm này.');
        const oldLeader = team.members.find(m => m.role === 'LEADER');
        await prisma_1.prisma.$transaction(async (tx) => {
            if (oldLeader) {
                await tx.teamMember.update({
                    where: { id: oldLeader.id },
                    data: { role: 'MEMBER' },
                });
            }
            await tx.teamMember.update({
                where: { id: newLeaderMember.id },
                data: { role: 'LEADER' },
            });
            // Record BR-13 audit log
            await tx.auditLog.create({
                data: {
                    action: 'CHANGE_LEADER',
                    entityType: 'TEAM',
                    entityId: teamId,
                    actorId: lecturerId,
                    oldValue: oldLeader?.studentId || null,
                    newValue: newLeaderStudentId,
                    reason: reason || 'Giảng viên chỉ định trưởng nhóm mới (BR-13)',
                },
            });
        });
        console.log(`[BR-13 Audit] Lecturer ${lecturerId} changed Team ${teamId} Leader from ${oldLeader?.studentId || 'None'} to ${newLeaderStudentId}. Reason: ${reason || 'N/A'}`);
        return this.teamRepo.findTeamById(teamId);
    }
    async updateRepoUrl(teamId, repoUrl, actorId, reason) {
        const team = await this.getTeamById(teamId);
        const normalized = normalizeRepoUrl(repoUrl);
        // Enforce uniqueness within this Exam
        const existing = await prisma_1.prisma.team.findFirst({
            where: {
                examId: team.examId,
                repoUrl: normalized,
                id: { not: teamId },
            },
        });
        if (existing) {
            throw new http_1.HttpError(400, `Repository này đã được sử dụng bởi nhóm "${existing.name}".`);
        }
        const updated = await this.teamRepo.updateRepoUrl(teamId, normalized);
        if (actorId) {
            await prisma_1.prisma.auditLog.create({
                data: {
                    action: 'UPDATE_REPO',
                    entityType: 'TEAM',
                    entityId: teamId,
                    actorId,
                    oldValue: team.repoUrl,
                    newValue: normalized,
                    reason: reason || 'Cập nhật repository nhóm',
                },
            });
        }
        return updated;
    }
    async updateMemberGithub(teamId, studentId, githubUsername) {
        const member = await prisma_1.prisma.teamMember.findUnique({
            where: { teamId_studentId: { teamId, studentId } },
        });
        if (!member)
            throw new http_1.HttpError(404, 'Thành viên không thuộc nhóm này.');
        const trimmed = (githubUsername || '').trim();
        if (trimmed && !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(trimmed)) {
            throw new http_1.HttpError(400, 'GitHub username không hợp lệ.');
        }
        return this.teamRepo.updateMemberGithub(teamId, studentId, trimmed || '');
    }
    async getTeamsByExam(examId) {
        return this.teamRepo.findTeamsByExam(examId);
    }
    async getTeamById(teamId) {
        const team = await this.teamRepo.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        return team;
    }
    async getTeamCandidates(teamId) {
        const team = await this.getTeamById(teamId);
        const [enrollments, assignedMembers] = await Promise.all([
            prisma_1.prisma.classEnrollment.findMany({
                where: { classId: team.exam.classId, status: 'ACTIVE', student: { role: 'STUDENT', isActive: true } },
                include: { student: { select: { id: true, fullName: true, email: true } } },
            }),
            prisma_1.prisma.teamMember.findMany({ where: { team: { examId: team.examId } }, select: { studentId: true } }),
        ]);
        const assignedStudentIds = new Set(assignedMembers.map(member => member.studentId));
        return enrollments.filter(enrollment => !assignedStudentIds.has(enrollment.studentId)).map(enrollment => enrollment.student);
    }
    async deleteTeam(teamId) {
        const team = await this.teamRepo.findTeamById(teamId);
        if (!team)
            throw new http_1.HttpError(404, 'Không tìm thấy nhóm.');
        const submissionsCount = await prisma_1.prisma.submission.count({ where: { teamId } });
        if (submissionsCount > 0)
            throw new http_1.HttpError(400, 'Không thể xóa nhóm đã có bài nộp.');
        await prisma_1.prisma.team.delete({ where: { id: teamId } });
        return { message: 'Đã xóa nhóm thành công.' };
    }
    // Lecturer manually overrides/grades a student's score
    async updateMemberScore(teamId, studentId, score, actorId, reason) {
        if (isNaN(score) || score < 0 || score > 10)
            throw new http_1.HttpError(400, 'Điểm số phải là số hợp lệ từ 0 đến 10.');
        const member = await prisma_1.prisma.teamMember.findUnique({
            where: { teamId_studentId: { teamId, studentId } },
            include: { contributions: true },
        });
        if (!member)
            throw new http_1.HttpError(404, 'Không tìm thấy thành viên trong nhóm.');
        const oldScore = member.contributions?.[0]?.personalScore != null ? String(member.contributions[0].personalScore) : null;
        const result = await prisma_1.prisma.gitContribution.upsert({
            where: { teamId_memberId: { teamId, memberId: member.id } },
            update: { personalScore: score, isManualOverride: true, syncedAt: new Date() },
            create: {
                teamId,
                memberId: member.id,
                commitsCount: 0,
                locAdded: 0,
                locDeleted: 0,
                contributionPercent: 0,
                personalScore: score,
                isWarning: false,
                isManualOverride: true,
            },
        });
        if (actorId) {
            await prisma_1.prisma.auditLog.create({
                data: {
                    action: 'OVERRIDE_SCORE',
                    entityType: 'TEAM',
                    entityId: teamId,
                    actorId,
                    oldValue: oldScore,
                    newValue: String(score),
                    reason: reason || 'Giảng viên chấm/ghi đè điểm thủ công',
                },
            });
        }
        return result;
    }
    async syncGitAnalytics(teamId) {
        return this.gitAnalytics.syncTeamContributions(teamId);
    }
    async getTeamContributions(teamId) {
        return this.teamRepo.getContributions(teamId);
    }
}
exports.TeamService = TeamService;
exports.teamService = new TeamService();
