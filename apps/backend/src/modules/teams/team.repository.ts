import { prisma } from '../../infrastructure/database/prisma';

export class TeamRepository {
  async createTeam(examId: string, name: string, repoUrl?: string) {
    return prisma.team.create({
      data: { examId, name, repoUrl },
      include: { members: { include: { student: { select: { id: true, fullName: true, email: true } } } } },
    });
  }

  async findTeamById(id: string) {
    return prisma.team.findUnique({
      where: { id },
      include: {
        exam: { select: { id: true, title: true, classId: true, examType: true } },
        members: {
          include: {
            student: { select: { id: true, fullName: true, email: true } },
            contributions: { orderBy: { syncedAt: 'desc' }, take: 1 },
          },
        },
        submissions: { orderBy: { attemptNumber: 'desc' }, take: 1 },
      },
    });
  }

  async findTeamsByExam(examId: string) {
    return prisma.team.findMany({
      where: { examId },
      include: {
        members: {
          include: {
            student: { select: { id: true, fullName: true, email: true } },
            contributions: { orderBy: { syncedAt: 'desc' }, take: 1 },
          },
        },
        submissions: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
          select: { id: true, attemptNumber: true, status: true, totalScore: true, submittedAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findTeamByStudent(examId: string, studentId: string) {
    return prisma.team.findFirst({
      where: {
        examId,
        members: { some: { studentId } },
      },
      include: {
        members: {
          include: { student: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
  }

  async findTeamsByStudent(studentId: string) {
    return prisma.team.findMany({
      where: { members: { some: { studentId } } },
      include: {
        exam: { select: { id: true, title: true, classId: true, class: { select: { classCode: true, name: true } } } },
        members: {
          include: { student: { select: { id: true, fullName: true, email: true } } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addMember(teamId: string, studentId: string, role: string = 'MEMBER', githubUsername?: string) {
    return prisma.teamMember.create({
      data: { teamId, studentId, role, githubUsername },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async removeMember(teamId: string, studentId: string) {
    return prisma.teamMember.delete({
      where: { teamId_studentId: { teamId, studentId } },
    });
  }

  async updateMemberRole(teamId: string, studentId: string, role: string) {
    return prisma.teamMember.update({
      where: { teamId_studentId: { teamId, studentId } },
      data: { role },
    });
  }

  async updateMemberGithub(teamId: string, studentId: string, githubUsername: string) {
    return prisma.teamMember.update({
      where: { teamId_studentId: { teamId, studentId } },
      data: { githubUsername },
    });
  }

  async updateRepoUrl(teamId: string, repoUrl: string) {
    return prisma.team.update({
      where: { id: teamId },
      data: { repoUrl },
    });
  }

  async saveContribution(data: {
    teamId: string;
    memberId: string;
    commitsCount: number;
    locAdded: number;
    locDeleted: number;
    contributionPercent: number;
    personalScore?: number | null;
    isWarning: boolean;
  }) {
    return prisma.gitContribution.upsert({
      where: { teamId_memberId: { teamId: data.teamId, memberId: data.memberId } },
      update: {
        commitsCount: data.commitsCount,
        locAdded: data.locAdded,
        locDeleted: data.locDeleted,
        contributionPercent: data.contributionPercent,
        personalScore: data.personalScore,
        isWarning: data.isWarning,
        syncedAt: new Date(),
      },
      create: {
        teamId: data.teamId,
        memberId: data.memberId,
        commitsCount: data.commitsCount,
        locAdded: data.locAdded,
        locDeleted: data.locDeleted,
        contributionPercent: data.contributionPercent,
        personalScore: data.personalScore,
        isWarning: data.isWarning,
      },
    });
  }

  async getContributions(teamId: string) {
    return prisma.gitContribution.findMany({
      where: { teamId },
      include: {
        member: {
          include: { student: { select: { id: true, fullName: true, email: true } } },
        },
      },
      orderBy: { contributionPercent: 'desc' },
    });
  }
}

export const teamRepository = new TeamRepository();
