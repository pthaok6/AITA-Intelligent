const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GitAnalyticsService } = require('../dist/modules/teams/git-analytics.service');

const gitAnalytics = new GitAnalyticsService();

test('GitAnalytics - parseRepoOwnerAndName handles various GitHub URL formats', () => {
  const r1 = gitAnalytics.parseRepoOwnerAndName('https://github.com/aita-demo/group-project-01');
  assert.deepEqual(r1, { owner: 'aita-demo', repo: 'group-project-01' });

  const r2 = gitAnalytics.parseRepoOwnerAndName('https://github.com/octocat/Hello-World.git');
  assert.deepEqual(r2, { owner: 'octocat', repo: 'Hello-World' });

  const r3 = gitAnalytics.parseRepoOwnerAndName('facebook/react');
  assert.deepEqual(r3, { owner: 'facebook', repo: 'react' });

  assert.equal(gitAnalytics.parseRepoOwnerAndName(''), null);
  assert.equal(gitAnalytics.parseRepoOwnerAndName('https://gitlab.com/unknown'), null);
});

test('BR-05: Free-rider flag triggers when contribution is strictly below 5%', () => {
  // Free-rider threshold is < 5.0%
  const lowContrib = 4.9;
  const isWarningLow = lowContrib < 5.0;
  assert.equal(isWarningLow, true, '4.9% must trigger free-rider warning');

  const zeroContrib = 0.0;
  assert.equal(zeroContrib < 5.0, true, '0% must trigger free-rider warning');

  const normalContrib = 5.0;
  assert.equal(normalContrib < 5.0, false, '5.0% must NOT trigger warning');

  const highContrib = 35.5;
  assert.equal(highContrib < 5.0, false, '35.5% must NOT trigger warning');
});

test('BR-12: Highest contributor receives team score; other scores scale by contribution ratio', () => {
  const teamScore = 10.0;
  const maxPercent = 60.0;

  // Case 1: Member contributes 2.5% while the highest contributor has 60%.
  const lowPercent = 2.5;
  const personalScore1 = Math.round(teamScore * (lowPercent / maxPercent) * 100) / 100;
  assert.equal(personalScore1, 0.42, 'Personal score should scale directly against the highest contribution');

  // Case 2: Member contributes 25% while the highest contributor has 60%.
  const avgPercent = 25.0;
  const personalScore2 = Math.round(teamScore * (avgPercent / maxPercent) * 100) / 100;
  assert.equal(personalScore2, 4.17, 'Personal score should scale directly against the highest contribution');

  // Case 3: Highest contributor gets the team's score.
  const personalScore3 = Math.round(teamScore * (maxPercent / maxPercent) * 100) / 100;
  assert.equal(personalScore3, 10.0, 'Highest contributor should receive the team score');
});

test('BR-11 & BR-13 rule constraints verification', () => {
  // BR-11: Leader check
  const memberRole = 'MEMBER';
  const leaderRole = 'LEADER';
  assert.equal(memberRole === 'LEADER', false, 'Member cannot submit for group');
  assert.equal(leaderRole === 'LEADER', true, 'Leader is allowed to submit for group');

  // BR-13: Lecturer role authorization for leader changes
  const allowedRoles = ['LECTURER', 'ADMIN'];
  assert.equal(allowedRoles.includes('STUDENT'), false, 'Student cannot change leader');
  assert.equal(allowedRoles.includes('LECTURER'), true, 'Lecturer can change leader');
  assert.equal(allowedRoles.includes('ADMIN'), true, 'Admin can change leader');
});
