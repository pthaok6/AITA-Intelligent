import { teamRepository, TeamRepository } from './team.repository';
import { gitAnalyticsService, GitAnalyticsService } from './git-analytics.service';
import { prisma } from '../../infrastructure/database/prisma';
import { HttpError } from '../../shared/http';

export class TeamService {
  constructor(
    private teamRepo: TeamRepository = teamRepository,
    private gitAnalytics: GitAnalyticsService = gitAnalyticsService
  ) {}

  async createTeam(examId: string, name: string, repoUrl?: string) {
    if (!name || !name.trim()) throw new HttpError(400, 'Tên nhóm không được để trống.');
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new HttpError(404, 'Không tìm thấy bài thi.');
    if (exam.examType !== 'GROUP') throw new HttpError(400, 'Bài thi này không phải loại bài tập nhóm.');

    const existing = await prisma.team.findUnique({ where: { examId_name: { examId, name: name.trim() } } });
    if (existing) throw new HttpError(409, `Nhóm "${name}" đã tồn tại trong bài thi này.`);

    return this.teamRepo.createTeam(examId, name.trim(), repoUrl?.trim() || undefined);
  }

  async addMember(teamId: string, studentId: string, role: string = 'MEMBER', githubUsername?: string) {
    const team = await this.teamRepo.findTeamById(teamId);
    if (!team) throw new HttpError(404, 'Không tìm thấy nhóm.');

    // Verify student is active in class
    const enrollment = await prisma.classEnrollment.findUnique({
      where: { classId_studentId: { classId: team.exam.classId, studentId } },
    });
    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new HttpError(400, 'Sinh viên này chưa tham gia hoặc không còn hoạt động trong lớp.');
    }

    // Check if student already in any team of this exam
    const existingTeam = await this.teamRepo.findTeamByStudent(team.examId, studentId);
    if (existingTeam) {
      throw new HttpError(400, `Sinh viên này đã thuộc nhóm "${existingTeam.name}".`);
    }

    // BR-11: Each team has exactly one active Leader
    let assignedRole = role.toUpperCase() === 'LEADER' ? 'LEADER' : 'MEMBER';
    if (assignedRole === 'LEADER') {
      const hasLeader = team.members.some(m => m.role === 'LEADER');
      if (hasLeader) {
        throw new HttpError(400, 'Nhóm này đã có Trưởng nhóm (Leader). Mỗi nhóm chỉ có duy nhất 1 Leader (BR-11).');
      }
    } else if (team.members.length === 0) {
      // First member defaults to LEADER
      assignedRole = 'LEADER';
    }

    return this.teamRepo.addMember(teamId, studentId, assignedRole, githubUsername?.trim() || undefined);
  }

  async removeMember(teamId: string, studentId: string) {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_studentId: { teamId, studentId } },
    });
    if (!member) throw new HttpError(404, 'Không tìm thấy thành viên trong nhóm.');
    if (member.role === 'LEADER') {
      throw new HttpError(400, 'Không thể xóa Trưởng nhóm. Vui lòng chuyển quyền Leader cho thành viên khác trước (BR-11).');
    }
    return this.teamRepo.removeMember(teamId, studentId);
  }

  // BR-13: Only Lecturer may change a team's Team Leader; records audit
  async changeLeader(teamId: string, newLeaderStudentId: string, lecturerId: string, reason?: string) {
    const team = await this.teamRepo.findTeamById(teamId);
    if (!team) throw new HttpError(404, 'Không tìm thấy nhóm.');

    const newLeaderMember = team.members.find(m => m.studentId === newLeaderStudentId);
    if (!newLeaderMember) throw new HttpError(400, 'Sinh viên được chọn không thuộc nhóm này.');

    const oldLeader = team.members.find(m => m.role === 'LEADER');

    await prisma.$transaction(async (tx) => {
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
    });

    console.log(`[BR-13 Audit] Lecturer ${lecturerId} changed Team ${teamId} Leader from ${oldLeader?.studentId || 'None'} to ${newLeaderStudentId}. Reason: ${reason || 'N/A'}`);

    return this.teamRepo.findTeamById(teamId);
  }

  async updateRepoUrl(teamId: string, repoUrl: string) {
    return this.teamRepo.updateRepoUrl(teamId, repoUrl.trim());
  }

  async updateMemberGithub(teamId: string, studentId: string, githubUsername: string) {
    return this.teamRepo.updateMemberGithub(teamId, studentId, githubUsername.trim());
  }

  async getTeamsByExam(examId: string) {
    return this.teamRepo.findTeamsByExam(examId);
  }

  async getTeamById(teamId: string) {
    const team = await this.teamRepo.findTeamById(teamId);
    if (!team) throw new HttpError(404, 'Không tìm thấy nhóm.');
    return team;
  }

  async syncGitAnalytics(teamId: string, options?: { lowerBound?: number; upperBound?: number }) {
    return this.gitAnalytics.syncTeamContributions(teamId, options);
  }

  async getTeamContributions(teamId: string) {
    return this.teamRepo.getContributions(teamId);
  }
}

export const teamService = new TeamService();
