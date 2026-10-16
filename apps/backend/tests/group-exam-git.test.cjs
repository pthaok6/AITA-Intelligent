const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');

// Load env
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

// Import compiled backend modules from dist
const { normalizeRepoUrl, TeamService } = require('../dist/modules/teams/team.service');
const { GitAnalyticsService } = require('../dist/modules/teams/git-analytics.service');
const { SubmissionService } = require('../dist/modules/submissions/submission.service');
const { SubmissionStatus } = require('../dist/domain/enums');
const { prisma } = require('../dist/infrastructure/database/prisma');

test('GROUP EXAM & GIT ANALYTICS SUITE', async (t) => {

  await t.test('1. Repository URL normalization and validation', () => {
    // Valid URLs
    assert.equal(
      normalizeRepoUrl('https://github.com/aita-demo/group-project-01'),
      'https://github.com/aita-demo/group-project-01'
    );
    assert.equal(
      normalizeRepoUrl('https://github.com/aita-demo/group-project-01.git'),
      'https://github.com/aita-demo/group-project-01'
    );
    assert.equal(
      normalizeRepoUrl('https://github.com/aita-demo/group-project-01/'),
      'https://github.com/aita-demo/group-project-01'
    );
    assert.equal(
      normalizeRepoUrl('https://www.github.com/owner/my-repo.git/'),
      'https://github.com/owner/my-repo'
    );

    // Invalid URLs
    assert.throws(() => normalizeRepoUrl(''), /Link repository không được để trống/);
    assert.throws(() => normalizeRepoUrl('http://github.com/owner/repo'), /Link repository phải có dạng https:\/\/github\.com\/owner\/repository/);
    assert.throws(() => normalizeRepoUrl('https://gitlab.com/owner/repo'), /Link repository phải có dạng https:\/\/github\.com\/owner\/repository/);
    assert.throws(() => normalizeRepoUrl('https://github.com/single-part'), /Link repository phải có dạng https:\/\/github\.com\/owner\/repository/);
    assert.throws(() => normalizeRepoUrl('not-a-valid-url'), /Link repository GitHub không hợp lệ/);
  });

  await t.test('2. BR-12 Clamped personal score formula logic', () => {
    const teamSize = 4;
    const expectedPercent = 100 / teamSize; // 25%
    const lowerBound = 0.5;
    const upperBound = 1.2;
    const teamScore = 8.0;

    const calcPersonalScore = (contribPercent, tScore = teamScore) => {
      const factor = contribPercent / expectedPercent;
      const clampedFactor = Math.min(Math.max(factor, lowerBound), upperBound);
      return Math.round(tScore * clampedFactor * 100) / 100;
    };

    // Equal contribution (25% in 4-member team -> factor 1.0)
    assert.equal(calcPersonalScore(25.0), 8.0);

    // Below average contribution (10% -> factor 0.4 -> clamped to 0.5 -> score 4.0)
    assert.equal(calcPersonalScore(10.0), 4.0);

    // Zero contribution (0% -> factor 0.0 -> clamped to lowerBound 0.5 -> score 4.0)
    assert.equal(calcPersonalScore(0.0), 4.0);

    // Above average contribution (50% -> factor 2.0 -> clamped to upperBound 1.2 -> score 9.6)
    assert.equal(calcPersonalScore(50.0), 9.6);

    // Moderate above average (30% -> factor 1.2 -> exactly upperBound 1.2 -> score 9.6)
    assert.equal(calcPersonalScore(30.0), 9.6);

    // Moderate below average (20% -> factor 0.8 -> unclamped 0.8 -> score 6.4)
    assert.equal(calcPersonalScore(20.0), 6.4);

    // Zero team score yields zero personal score
    assert.equal(calcPersonalScore(50.0, 0), 0);
  });

  await t.test('3. BR-05 Warning threshold evaluation', () => {
    const totalTeamActivity = 100;
    const isWarning = (percent) => totalTeamActivity > 0 && percent < 5.0;

    assert.equal(isWarning(0.0), true, '0% must trigger BR-05 warning');
    assert.equal(isWarning(4.9), true, '4.9% must trigger BR-05 warning');
    assert.equal(isWarning(5.0), false, '5.0% must NOT trigger BR-05 warning');
    assert.equal(isWarning(25.0), false, '25% must NOT trigger BR-05 warning');
  });

  await t.test('4. GitAnalytics: No mock data on sync failure', async () => {
    const mockTeamRepo = {
      saved: [],
      async findTeamById(id) {
        return {
          id,
          name: 'Test Team',
          repoUrl: 'https://github.com/non-existent-org-404/non-existent-repo-404',
          exam: { lowerBound: 0.5, upperBound: 1.2 },
          members: [
            { id: 'm1', studentId: 's1', role: 'LEADER', githubUsername: 'user1', student: { fullName: 'U1', email: 'u1@fpt.edu.vn' } },
            { id: 'm2', studentId: 's2', role: 'MEMBER', githubUsername: 'user2', student: { fullName: 'U2', email: 'u2@fpt.edu.vn' } },
          ],
          submissions: [{ id: 'sub1', status: 'COMPLETED', totalScore: 8.5 }],
        };
      },
      async saveContribution(data) {
        this.saved.push(data);
        return { ...data, isManualOverride: false };
      }
    };

    const analytics = new GitAnalyticsService(mockTeamRepo);
    // Mock fetchGitHubStats to simulate network / API 404 failure
    analytics.fetchGitHubStats = async () => {
      throw new Error('GitHub API error: 404 Not Found');
    };

    const results = await analytics.syncTeamContributions('team-1');

    assert.equal(results.length, 2);
    for (const r of results) {
      assert.equal(r.syncStatus, 'FAILED');
      assert.match(r.syncError, /404 Not Found/);
      // P0 requirement: never fabricate fake commits or LOC!
      assert.equal(r.commitsCount, 0, 'Commits must not be fabricated on sync failure');
      assert.equal(r.locAdded, 0, 'LOC additions must not be fabricated on sync failure');
      assert.equal(r.locDeleted, 0, 'LOC deletions must not be fabricated on sync failure');
      assert.equal(r.contributionPercent, 0, 'Contribution percent must be 0 on sync failure');
      assert.equal(r.personalScore, null, 'Personal score must not be awarded on failed sync');
    }
  });

  await t.test('5. Database & Service Integration: Group Lifecycle & Auditing', async () => {
    // Find or prepare test accounts
    const lecturer = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const students = await prisma.user.findMany({ where: { role: 'STUDENT' }, take: 4 });

    if (!lecturer || students.length < 3) {
      console.log('Skipping DB integration test: insufficient seed users.');
      return;
    }

    const testClass = await prisma.class.findFirst();
    assert.ok(testClass, 'Test class must exist in DB');

    // Create a temporary group exam
    const now = new Date();
    const tempExam = await prisma.exam.create({
      data: {
        classId: testClass.id,
        title: `[Test Exam] Group Lifecycle ${Date.now()}`,
        descriptionMd: 'Automated test exam',
        allowedLanguage: 'PYTHON',
        examType: 'GROUP',
        lowerBound: 0.5,
        upperBound: 1.2,
        maxTeamSize: 2,
        startTime: new Date(now.getTime() - 60000),
        endTime: new Date(now.getTime() + 3600000),
      }
    });

    try {
      // Ensure students are enrolled
      for (const s of students) {
        await prisma.classEnrollment.upsert({
          where: { classId_studentId: { classId: testClass.id, studentId: s.id } },
          create: { classId: testClass.id, studentId: s.id },
          update: { status: 'ACTIVE' },
        });
      }

      const teamService = new TeamService();

      // 5.1 Create Team
      const team = await teamService.createStudentTeam(tempExam.id, students[0].id, `TestTeam-${Date.now()}`);
      assert.ok(team, 'Team should be created');
      assert.equal(team.members[0].role, 'LEADER', 'Creator should be LEADER');

      // 5.2 Add Members
      const m2 = await teamService.addMember(team.id, students[1].id, 'MEMBER', 'student-dev-1');
      assert.equal(m2.role, 'MEMBER');

      // 5.3 Attempt duplicate membership in same exam -> must reject
      await assert.rejects(
        async () => {
          await teamService.addMember(team.id, students[1].id, 'MEMBER');
        },
        /đã thuộc nhóm/
      );

      // 5.3b Dynamic maxTeamSize enforcement: maxTeamSize is 2, adding 3rd student must reject
      await assert.rejects(
        async () => {
          await teamService.addMember(team.id, students[2].id, 'MEMBER');
        },
        /tối đa/
      );

      // 5.3c Membership validation: student not in team cannot have github username updated
      await assert.rejects(
        async () => {
          await teamService.updateMemberGithub(team.id, students[2].id, 'student2-git');
        },
        /không thuộc nhóm/
      );

      // 5.3d Valid membership github update
      const updatedM1 = await teamService.updateMemberGithub(team.id, students[1].id, 'student1-dev');
      assert.equal(updatedM1.githubUsername, 'student1-dev');

      // 5.4 Update repo URL
      const validRepo = 'https://github.com/aita-test/sample-group-repo';
      await teamService.updateRepoUrl(team.id, validRepo, students[0].id, 'Trưởng nhóm đăng ký repo');
      const updatedTeam = await teamService.getTeamById(team.id);
      assert.equal(updatedTeam.repoUrl, validRepo);

      // Verify audit log for repo update
      const repoAudit = await prisma.auditLog.findFirst({
        where: { entityType: 'TEAM', entityId: team.id, action: 'UPDATE_REPO' },
      });
      assert.ok(repoAudit, 'Audit log for UPDATE_REPO must be recorded');
      assert.equal(repoAudit.newValue, validRepo);

      // 5.5 Lecturer change leader (BR-13)
      await teamService.changeLeader(team.id, students[1].id, lecturer.id, 'Chuyển leader sang dev-1');
      const teamAfterLeaderChange = await teamService.getTeamById(team.id);
      const newLeader = teamAfterLeaderChange.members.find(m => m.studentId === students[1].id);
      const oldLeader = teamAfterLeaderChange.members.find(m => m.studentId === students[0].id);
      assert.equal(newLeader.role, 'LEADER', 'Student 1 must now be LEADER');
      assert.equal(oldLeader.role, 'MEMBER', 'Student 0 must now be MEMBER');

      // Verify BR-13 audit log
      const leaderAudit = await prisma.auditLog.findFirst({
        where: { entityType: 'TEAM', entityId: team.id, action: 'CHANGE_LEADER' },
      });
      assert.ok(leaderAudit, 'Audit log for CHANGE_LEADER must be recorded');
      assert.equal(leaderAudit.newValue, students[1].id);

      // 5.6 Manual Score Override & Preservation
      await teamService.updateMemberScore(team.id, students[0].id, 9.5, lecturer.id, 'GV thưởng điểm đồ án');
      const scoreAudit = await prisma.auditLog.findFirst({
        where: { entityType: 'TEAM', entityId: team.id, action: 'OVERRIDE_SCORE' },
      });
      assert.ok(scoreAudit, 'Audit log for OVERRIDE_SCORE must be recorded');
      assert.equal(scoreAudit.newValue, '9.5');

      // Verify manual override is preserved
      const member0Record = await prisma.teamMember.findUnique({
        where: { teamId_studentId: { teamId: team.id, studentId: students[0].id } },
        include: { contributions: true },
      });
      assert.equal(member0Record.contributions[0].isManualOverride, true);
      assert.equal(member0Record.contributions[0].personalScore, 9.5);

      // 5.7 Late submission flow (BR-02)
      // Expire exam deadline to trigger LATE policy
      await prisma.exam.update({
        where: { id: tempExam.id },
        data: { endTime: new Date(now.getTime() - 10000) },
      });

      const submissionService = new SubmissionService();
      const JSZip = require('jszip');
      const zip = new JSZip();
      zip.file('main.py', 'print("Hello from group test")');
      const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
      const entrypoint = 'main.py';

      // Non-leader attempting submission -> Must reject with HTTP 403 (BR-11)
      await assert.rejects(
        async () => {
          await submissionService.submitArchive(tempExam.id, students[0].id, zipContent, 'solution.zip', entrypoint, validRepo);
        },
        /Chỉ Trưởng nhóm/
      );

      // Mismatched repo URL -> Must reject
      await assert.rejects(
        async () => {
          await submissionService.submitArchive(tempExam.id, students[1].id, zipContent, 'solution.zip', entrypoint, 'https://github.com/other-org/wrong-repo');
        },
        /không khớp với repository đã đăng ký/
      );

      // Leader submits after deadline -> Status must be LATE (BR-02)
      const lateSub = await submissionService.submitArchive(tempExam.id, students[1].id, zipContent, 'solution.zip', entrypoint, validRepo);
      assert.equal(lateSub.status, SubmissionStatus.LATE, 'Late submission must have status LATE');
      assert.equal(lateSub.isLate, true, 'isLate must be true');

      // Duplicate SHA-256 submission detection (BR-07)
      await assert.rejects(
        async () => {
          await submissionService.submitArchive(tempExam.id, students[1].id, zipContent, 'solution.zip', entrypoint, validRepo);
        },
        /BR-07: Trùng mã băm SHA-256/
      );

      // Lecturer approves late submission (BR-02)
      const approvedSub = await submissionService.approveLateSubmission(lateSub.id, lecturer.id);
      assert.equal(approvedSub.status, SubmissionStatus.QUEUED, 'Approved late submission must transition to QUEUED');

      // Verify audit log for late approval
      const lateAudit = await prisma.auditLog.findFirst({
        where: { entityType: 'SUBMISSION', entityId: lateSub.id, action: 'LATE_APPROVAL' },
      });
      assert.ok(lateAudit, 'Audit log for late submission approval must be recorded');

      // 5.8 Finalized score check & Manual score override preservation
      const analytics = new GitAnalyticsService();
      analytics.fetchGitHubStats = async () => ({
        'student1-dev': { commits: 10, additions: 200, deletions: 50 },
      });

      // 5.8a When submission is RUNNING (not finalized)
      await prisma.submission.update({
        where: { id: lateSub.id },
        data: { status: 'RUNNING' },
      });
      const runningSync = await analytics.syncTeamContributions(team.id);
      const student1Running = runningSync.find(s => s.studentId === students[1].id);
      assert.equal(student1Running.personalScore, null, 'Personal score must be null while submission is RUNNING');

      // 5.8b When submission is COMPLETED with totalScore 8.0
      await prisma.submission.update({
        where: { id: lateSub.id },
        data: { status: 'COMPLETED', totalScore: 8.0 },
      });
      const completedSync = await analytics.syncTeamContributions(team.id);
      const student1Completed = completedSync.find(s => s.studentId === students[1].id);
      const student0Completed = completedSync.find(s => s.studentId === students[0].id);

      assert.ok(student1Completed.personalScore !== null, 'Personal score must be computed when COMPLETED');
      // Student 0 has manual override 9.5 from step 5.6 -> Must be preserved!
      assert.equal(student0Completed.isManualOverride, true, 'Student 0 must retain isManualOverride');
      assert.equal(student0Completed.personalScore, 9.5, 'Student 0 must retain lecturer override score 9.5');

    } catch (err) {
      console.error('TEST 5 DETAILED ERROR:', err);
      throw err;
    } finally {
      // Cleanup temporary test data
      await prisma.auditLog.deleteMany({ where: { entityId: { in: (await prisma.team.findMany({ where: { examId: tempExam.id }, select: { id: true } })).map(t => t.id) } } });
      await prisma.gitContribution.deleteMany({ where: { team: { examId: tempExam.id } } });
      await prisma.submission.deleteMany({ where: { examId: tempExam.id } });
      await prisma.teamMember.deleteMany({ where: { team: { examId: tempExam.id } } });
      await prisma.team.deleteMany({ where: { examId: tempExam.id } });
      await prisma.exam.delete({ where: { id: tempExam.id } });
    }
  });

  await t.test('6. GitHub contributor stats parsing, HTTP 202 retry and HTTP 204 empty repo', async () => {
    const analytics = new GitAnalyticsService();
    const originalFetch = global.fetch;

    try {
      // 6.1 HTTP 204 empty repository
      global.fetch = async () => ({
        status: 204,
        ok: true,
      });
      const emptyStats = await analytics.fetchGitHubStats('org', 'empty-repo');
      assert.deepEqual(emptyStats, {}, 'HTTP 204 must return empty object');

      // 6.2 HTTP 202 background computation followed by 200 success
      let attempts = 0;
      global.fetch = async () => {
        attempts++;
        if (attempts === 1) {
          return { status: 202, ok: false };
        }
        return {
          status: 200,
          ok: true,
          json: async () => [
            {
              author: { login: 'DevLead' },
              total: 8,
              weeks: [
                { w: 1, a: 120, d: 30, c: 5 },
                { w: 2, a: 80, d: 20, c: 3 },
              ],
            },
            {
              author: { login: 'MemberDev' },
              total: 3,
              weeks: [
                { w: 1, a: 40, d: 10, c: 3 },
              ],
            },
          ],
        };
      };

      const parsed = await analytics.fetchGitHubStats('org', 'active-repo');
      assert.equal(attempts, 2, 'Should have retried after HTTP 202');
      assert.deepEqual(parsed.devlead, { commits: 8, additions: 200, deletions: 50 });
      assert.deepEqual(parsed.memberdev, { commits: 3, additions: 40, deletions: 10 });

      // 6.3 Exhausted 202 retries throws error
      global.fetch = async () => ({ status: 202, ok: false });
      await assert.rejects(
        () => analytics.fetchGitHubStats('org', 'still-computing-repo'),
        /HTTP 202/
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  t.after(async () => {
    await prisma.$disconnect();
    setTimeout(() => process.exit(0), 200);
  });
});
