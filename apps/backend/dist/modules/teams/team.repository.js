"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamRepository = exports.TeamRepository = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
class TeamRepository {
    async createTeam(examId, name, repoUrl) {
        return prisma_1.prisma.team.create({
            data: { examId, name, repoUrl },
            include: { members: { include: { student: { select: { id: true, fullName: true, email: true } } } } },
        });
    }
    async findTeamById(id) {
        return prisma_1.prisma.team.findUnique({
            where: { id },
            include: {
                exam: { select: { id: true, title: true, classId: true, examType: true, lowerBound: true, upperBound: true, maxTeamSize: true } },
                members: {
                    include: {
                        student: { select: { id: true, fullName: true, email: true } },
                        contributions: { orderBy: { syncedAt: 'desc' }, take: 1 },
                    },
                },
                submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
            },
        });
    }
    async findTeamsByExam(examId) {
        return prisma_1.prisma.team.findMany({
            where: { examId },
            include: {
                exam: { select: { id: true, title: true, classId: true, examType: true, lowerBound: true, upperBound: true, maxTeamSize: true } },
                members: {
                    include: {
                        student: { select: { id: true, fullName: true, email: true } },
                        contributions: { orderBy: { syncedAt: 'desc' }, take: 1 },
                    },
                },
                submissions: {
                    orderBy: { submittedAt: 'desc' },
                    take: 1,
                    select: { id: true, attemptNumber: true, status: true, totalScore: true, submittedAt: true, commitSha: true, repoMatchStatus: true, repoMatchPercent: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async findTeamByStudent(examId, studentId) {
        return prisma_1.prisma.team.findFirst({
            where: {
                examId,
                members: { some: { studentId } },
            },
            include: {
                exam: { select: { id: true, title: true, classId: true, examType: true, lowerBound: true, upperBound: true, maxTeamSize: true } },
                members: {
                    include: { student: { select: { id: true, fullName: true, email: true } } },
                },
            },
        });
    }
    async findTeamsByStudent(studentId) {
        return prisma_1.prisma.team.findMany({
            where: { members: { some: { studentId } } },
            include: {
                exam: { select: { id: true, title: true, classId: true, endTime: true, lowerBound: true, upperBound: true, maxTeamSize: true, class: { select: { classCode: true, name: true } } } },
                members: {
                    include: {
                        student: { select: { id: true, fullName: true, email: true } },
                        contributions: { orderBy: { syncedAt: 'desc' }, take: 1 },
                    },
                    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
                },
                submissions: {
                    orderBy: { submittedAt: 'desc' },
                    take: 1,
                    select: { id: true, attemptNumber: true, status: true, totalScore: true, submittedAt: true, commitSha: true, repoMatchStatus: true, repoMatchPercent: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async addMember(teamId, studentId, role = 'MEMBER', githubUsername) {
        return prisma_1.prisma.teamMember.create({
            data: { teamId, studentId, role, githubUsername },
            include: { student: { select: { id: true, fullName: true, email: true } } },
        });
    }
    async removeMember(teamId, studentId) {
        return prisma_1.prisma.teamMember.delete({
            where: { teamId_studentId: { teamId, studentId } },
        });
    }
    async updateMemberRole(teamId, studentId, role) {
        return prisma_1.prisma.teamMember.update({
            where: { teamId_studentId: { teamId, studentId } },
            data: { role },
        });
    }
    async updateMemberGithub(teamId, studentId, githubUsername) {
        return prisma_1.prisma.teamMember.update({
            where: { teamId_studentId: { teamId, studentId } },
            data: { githubUsername },
        });
    }
    async updateRepoUrl(teamId, repoUrl) {
        return prisma_1.prisma.team.update({
            where: { id: teamId },
            data: { repoUrl },
        });
    }
    async saveContribution(data) {
        const existing = await prisma_1.prisma.gitContribution.findUnique({
            where: { teamId_memberId: { teamId: data.teamId, memberId: data.memberId } },
        });
        const effectiveScore = existing?.isManualOverride
            ? existing.personalScore
            : data.personalScore;
        return prisma_1.prisma.gitContribution.upsert({
            where: { teamId_memberId: { teamId: data.teamId, memberId: data.memberId } },
            update: {
                commitsCount: data.commitsCount,
                locAdded: data.locAdded,
                locDeleted: data.locDeleted,
                contributionPercent: data.contributionPercent,
                personalScore: effectiveScore,
                isWarning: data.isWarning,
                syncStatus: data.syncStatus || 'SUCCESS',
                syncError: data.syncError !== undefined ? data.syncError : null,
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
                syncStatus: data.syncStatus || 'SUCCESS',
                syncError: data.syncError !== undefined ? data.syncError : null,
            },
        });
    }
    async getContributions(teamId) {
        return prisma_1.prisma.gitContribution.findMany({
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
exports.TeamRepository = TeamRepository;
exports.teamRepository = new TeamRepository();
