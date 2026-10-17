import { teamRepository, TeamRepository } from './team.repository';
import { prisma } from '../../infrastructure/database/prisma';

export interface MemberStats {
  memberId: string;
  studentId: string;
  fullName: string;
  email: string;
  githubUsername?: string | null;
  role: string;
  commitsCount: number;
  locAdded: number;
  locDeleted: number;
  contributionPercent: number;
  personalScore: number | null;
  isWarning: boolean;
  isManualOverride?: boolean;
  syncStatus?: string;
  syncError?: string | null;
}

export class GitAnalyticsService {
  constructor(private teamRepo: TeamRepository = teamRepository) {}

  parseRepoOwnerAndName(repoUrl: string): { owner: string; repo: string } | null {
    if (!repoUrl) return null;
    const cleanUrl = repoUrl.trim().replace(/\.git$/, '');
    const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/) || cleanUrl.match(/^([^/]+)\/([^/]+)$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  }

  async fetchGitHubStats(owner: string, repo: string, cutoffDate?: Date): Promise<Record<string, { commits: number; additions: number; deletions: number }>> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'AITA-Intelligent-GitAnalytics',
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const url = `https://api.github.com/repos/${owner}/${repo}/stats/contributors`;
    let response: any = null;

    // Retry loop for HTTP 202 (GitHub stats computing in background)
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(url, { headers });
      if (response.status === 200 || response.status === 204) break;
      if (response.status === 202) {
        // Wait 1.5s for GitHub to generate contributor stats
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }
      break;
    }

    if (!response) {
      throw new Error('Không thể kết nối đến GitHub API.');
    }
    if (response.status === 204) {
      // Empty repository with no commits
      return {};
    }
    if (response.status === 202) {
      throw new Error('GitHub đang tổng hợp thống kê đóng góp (HTTP 202). Vui lòng thử lại sau giây lát.');
    }
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.json();
    if (!Array.isArray(rawData)) {
      return {};
    }

    const stats: Record<string, { commits: number; additions: number; deletions: number }> = {};
    for (const item of rawData) {
      if (item && item.author && item.author.login) {
        const login = item.author.login.toLowerCase();
        const commits = Number.isInteger(item.total)
          ? item.total
          : (item.weeks || []).reduce((acc: number, w: any) => acc + (w.c || 0), 0);
        const additions = (item.weeks || []).reduce((acc: number, w: any) => acc + (w.a || 0), 0);
        const deletions = (item.weeks || []).reduce((acc: number, w: any) => acc + (w.d || 0), 0);

        stats[login] = { commits, additions, deletions };
      }
    }

    // Enforce Commit Cutoff (commits created strictly before cutoffDate)
    if (cutoffDate && !isNaN(cutoffDate.getTime())) {
      try {
        const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?until=${cutoffDate.toISOString()}&per_page=100`;
        const commitsRes = await fetch(commitsUrl, { headers });
        if (commitsRes.ok) {
          const commitsList: any = await commitsRes.json();
          if (Array.isArray(commitsList)) {
            const validCommitCounts: Record<string, number> = {};
            for (const c of commitsList) {
              const login = c?.author?.login?.toLowerCase();
              if (login) {
                validCommitCounts[login] = (validCommitCounts[login] || 0) + 1;
              }
            }
            for (const login of Object.keys(stats)) {
              if (validCommitCounts[login] !== undefined) {
                stats[login].commits = validCommitCounts[login];
              } else {
                stats[login].commits = 0;
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[GitAnalytics cutoff check error] ${err.message}`);
      }
    }

    return stats;
  }

  async syncTeamContributions(teamId: string): Promise<MemberStats[]> {
    const team = await this.teamRepo.findTeamById(teamId);
    if (!team) throw new Error('Không tìm thấy nhóm.');

    const members = team.members;
    if (members.length === 0) return [];

    // Cutoff timestamp: commits made after submission (or after exam deadline) should not be counted
    const latestSubmission = team.submissions && team.submissions.length > 0 ? team.submissions[0] : null;
    const examEndTime = (team.exam as any)?.endTime ? new Date((team.exam as any).endTime) : null;
    const cutoffDate: Date | undefined = latestSubmission?.submittedAt
      ? new Date(latestSubmission.submittedAt)
      : (examEndTime || undefined);

    let gitStats: Record<string, { commits: number; additions: number; deletions: number }> = {};
    const parsed = team.repoUrl ? this.parseRepoOwnerAndName(team.repoUrl) : null;
    let gitFetchSuccess = false;
    let syncError: string | null = null;

    if (!team.repoUrl) {
      syncError = 'Nhóm chưa đăng ký repository GitHub chính thức.';
    } else if (!parsed) {
      syncError = 'URL repository GitHub không hợp lệ.';
    } else {
      try {
        gitStats = await this.fetchGitHubStats(parsed.owner, parsed.repo, cutoffDate);
        gitFetchSuccess = true;
      } catch (error: any) {
        syncError = error.message;
        console.warn(`[GitAnalytics] Không thể tải dữ liệu từ GitHub (${error.message}). Ghi nhận đồng bộ thất bại, không tạo số liệu giả.`);
      }
    }

    // Author Mapping check: Detect unrecognized external GitHub accounts
    if (gitFetchSuccess) {
      const registeredLogins = new Set(
        members.map(m => m.githubUsername?.trim().toLowerCase()).filter(Boolean)
      );
      const unrecognized = Object.keys(gitStats).filter(u => !registeredLogins.has(u));
      if (unrecognized.length > 0) {
        const warnText = `⚠️ Có đóng góp từ tài khoản GitHub lạ không thuộc nhóm: @${unrecognized.join(', @')}`;
        syncError = syncError ? `${syncError} · ${warnText}` : warnText;
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
        } else {
          stats = { commits: 0, additions: 0, deletions: 0 };
        }
      } else {
        // Never fabricate mock stats when offline or on error!
        stats = { commits: 0, additions: 0, deletions: 0 };
      }

      // Total activity without arbitrary multipliers: real additions + real deletions + real commits
      const activityWeight = (stats.additions + stats.deletions) + stats.commits;
      return {
        member: m,
        commits: stats.commits,
        additions: stats.additions,
        deletions: stats.deletions,
        activityWeight,
      };
    });

    const totalTeamActivity = memberRecords.reduce((sum, r) => sum + r.activityWeight, 0);

    // Latest team submission score (only finalized when status is COMPLETED or COMPILE_ERROR)
    const isGradingFinalized = latestSubmission && ['COMPLETED', 'COMPILE_ERROR'].includes(latestSubmission.status);
    const teamScore = isGradingFinalized ? latestSubmission.totalScore : null;

    const teamSize = members.length;
    const expectedPercent = teamSize > 0 ? 100 / teamSize : 100;
    const lowerBound = (team.exam as any)?.lowerBound ?? 0.5;
    const upperBound = (team.exam as any)?.upperBound ?? 1.2;

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

    const results: MemberStats[] = [];

    for (const rec of contributionRecords) {
      // Personal score is the team score adjusted by contribution and configured bounds.
      // Only compute official score when sync succeeded, team score is finalized, and team has activity!
      let personalScore: number | null = null;
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

export const gitAnalyticsService = new GitAnalyticsService();
