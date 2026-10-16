"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitAnalyticsService = exports.GitAnalyticsService = void 0;
const team_repository_1 = require("./team.repository");
class GitAnalyticsService {
    teamRepo;
    constructor(teamRepo = team_repository_1.teamRepository) {
        this.teamRepo = teamRepo;
    }
    parseRepoOwnerAndName(repoUrl) {
        if (!repoUrl)
            return null;
        const cleanUrl = repoUrl.trim().replace(/\.git$/, '');
        const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/) || cleanUrl.match(/^([^/]+)\/([^/]+)$/);
        if (!match)
            return null;
        return { owner: match[1], repo: match[2] };
    }
    async fetchGitHubStats(owner, repo) {
        const token = process.env.GITHUB_TOKEN;
        const headers = {
            'User-Agent': 'AITA-Intelligent-GitAnalytics',
            Accept: 'application/vnd.github.v3+json',
        };
        if (token)
            headers['Authorization'] = `token ${token}`;
        const url = `https://api.github.com/repos/${owner}/${repo}/contributors`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        const contributors = (await response.json());
        const stats = {};
        for (const c of contributors) {
            if (c && c.login) {
                stats[c.login.toLowerCase()] = {
                    commits: c.contributions || 1,
                    additions: (c.contributions || 1) * 25, // Estimated LOC ratio from contributions count
                    deletions: (c.contributions || 1) * 5,
                };
            }
        }
        return stats;
    }
    async syncTeamContributions(teamId) {
        const team = await this.teamRepo.findTeamById(teamId);
        if (!team)
            throw new Error('Không tìm thấy nhóm.');
        const members = team.members;
        if (members.length === 0)
            return [];
        let gitStats = {};
        const parsed = team.repoUrl ? this.parseRepoOwnerAndName(team.repoUrl) : null;
        let gitFetchSuccess = false;
        let syncError = null;
        if (!team.repoUrl) {
            syncError = 'Nhóm chưa đăng ký repository GitHub.';
        }
        else if (!parsed) {
            syncError = 'URL repository GitHub không hợp lệ.';
        }
        else {
            try {
                gitStats = await this.fetchGitHubStats(parsed.owner, parsed.repo);
                gitFetchSuccess = true;
            }
            catch (error) {
                syncError = error.message;
                console.warn(`[GitAnalytics] Không thể tải dữ liệu từ GitHub (${error.message}). Ghi nhận đồng bộ thất bại, không tạo số liệu giả.`);
            }
        }
        const syncStatus = gitFetchSuccess ? 'SUCCESS' : 'FAILED';
        // Map stats to members
        const memberRecords = members.map((m) => {
            const username = m.githubUsername?.trim().toLowerCase();
            let stats = { commits: 0, additions: 0, deletions: 0 };
            if (gitFetchSuccess) {
                // When real GitHub data is fetched: if student has no commits on repo, stats must be 0!
                if (username && gitStats[username]) {
                    stats = gitStats[username];
                }
                else {
                    stats = { commits: 0, additions: 0, deletions: 0 };
                }
            }
            else {
                // Never fabricate mock stats when offline/error!
                stats = { commits: 0, additions: 0, deletions: 0 };
            }
            const activityWeight = stats.additions + stats.deletions + stats.commits * 10;
            return {
                member: m,
                commits: stats.commits,
                additions: stats.additions,
                deletions: stats.deletions,
                activityWeight,
            };
        });
        const totalTeamActivity = memberRecords.reduce((sum, r) => sum + r.activityWeight, 0);
        // Latest team submission score
        const latestSubmission = team.submissions && team.submissions.length > 0 ? team.submissions[0] : null;
        const teamScore = latestSubmission && latestSubmission.status === 'COMPLETED' ? latestSubmission.totalScore : null;
        const teamSize = members.length;
        const expectedPercent = teamSize > 0 ? 100 / teamSize : 100;
        const lowerBound = team.exam?.lowerBound ?? 0.5;
        const upperBound = team.exam?.upperBound ?? 1.2;
        const contributionRecords = memberRecords.map(rec => {
            const contributionPercent = totalTeamActivity > 0
                ? Math.round((rec.activityWeight / totalTeamActivity) * 1000) / 10
                : 0.0;
            return {
                ...rec,
                contributionPercent,
                isWarning: totalTeamActivity > 0 && contributionPercent < 5.0,
            };
        });
        const results = [];
        for (const rec of contributionRecords) {
            // BR-12: PersonalScore = TeamScore * clamp(ContributionPercent / (100 / TeamSize), LowerBound, UpperBound)
            let personalScore = null;
            if (gitFetchSuccess && teamScore !== null && totalTeamActivity > 0) {
                const factor = expectedPercent > 0 ? rec.contributionPercent / expectedPercent : 1.0;
                const clampedFactor = Math.min(Math.max(factor, lowerBound), upperBound);
                personalScore = Math.round(teamScore * clampedFactor * 100) / 100;
            }
            const saved = await this.teamRepo.saveContribution({
                teamId,
                memberId: rec.member.id,
                commitsCount: rec.commits,
                locAdded: rec.additions,
                locDeleted: rec.deletions,
                contributionPercent: rec.contributionPercent,
                personalScore,
                isWarning: rec.isWarning,
                syncStatus,
                syncError,
            });
            results.push({
                memberId: rec.member.id,
                studentId: rec.member.studentId,
                fullName: rec.member.student.fullName,
                email: rec.member.student.email,
                githubUsername: rec.member.githubUsername,
                role: rec.member.role,
                commitsCount: rec.commits,
                locAdded: rec.additions,
                locDeleted: rec.deletions,
                contributionPercent: rec.contributionPercent,
                personalScore: saved.personalScore,
                isWarning: rec.isWarning,
                isManualOverride: saved.isManualOverride,
                syncStatus,
                syncError,
            });
        }
        return results;
    }
}
exports.GitAnalyticsService = GitAnalyticsService;
exports.gitAnalyticsService = new GitAnalyticsService();
