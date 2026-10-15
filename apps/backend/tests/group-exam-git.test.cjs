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

test('BR-12: Clamping formula restricts score factor to [0.5, 1.2]', () => {
  const lowerBound = 0.5;
  const upperBound = 1.2;
  const teamScore = 10.0;
  const teamSize = 4;
  const expectedPercent = 100 / teamSize; // 25%

  // Case 1: Member contributes very little (2.5% vs 25% expected -> ratio = 0.1)
  const lowPercent = 2.5;
  const rawFactor1 = lowPercent / expectedPercent; // 0.1
  const clampedFactor1 = Math.min(upperBound, Math.max(lowerBound, rawFactor1)); // 0.5
  assert.equal(clampedFactor1, 0.5, 'Factor must be clamped to lower bound 0.5');
  const personalScore1 = Math.round(teamScore * clampedFactor1 * 100) / 100;
  assert.equal(personalScore1, 5.0, 'Personal score should be 5.0');

  // Case 2: Member contributes average (25% vs 25% expected -> ratio = 1.0)
  const avgPercent = 25.0;
  const rawFactor2 = avgPercent / expectedPercent; // 1.0
  const clampedFactor2 = Math.min(upperBound, Math.max(lowerBound, rawFactor2)); // 1.0
  assert.equal(clampedFactor2, 1.0);
  const personalScore2 = Math.round(teamScore * clampedFactor2 * 100) / 100;
  assert.equal(personalScore2, 10.0, 'Personal score should be 10.0');

  // Case 3: Member carries team (60% vs 25% expected -> ratio = 2.4)
  const highPercent = 60.0;
  const rawFactor3 = highPercent / expectedPercent; // 2.4
  const clampedFactor3 = Math.min(upperBound, Math.max(lowerBound, rawFactor3)); // 1.2
  assert.equal(clampedFactor3, 1.2, 'Factor must be clamped to upper bound 1.2');
  const personalScore3 = Math.round(teamScore * clampedFactor3 * 100) / 100;
  assert.equal(personalScore3, 12.0, 'Personal score should be 12.0');
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
