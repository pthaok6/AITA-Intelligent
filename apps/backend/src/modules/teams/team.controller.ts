import { Router, Response } from 'express';
import { teamService } from './team.service';
import { teamRepository } from './team.repository';
import { authenticateJwt, requireRoles, AuthRequest } from '../../middlewares/auth.middleware';
import { HttpError } from '../../shared/http';

export const teamRouter = Router();

// LECTURER: Create a team for a group exam
teamRouter.post('/exams/:examId/teams', authenticateJwt, requireRoles('LECTURER', 'ADMIN'), async (req: AuthRequest, res: Response, next) => {
  try {
    const examId = req.params.examId as string;
    const { name, repoUrl } = req.body;
    const team = await teamService.createTeam(examId, name, repoUrl);
    res.status(201).json({ success: true, data: team });
  } catch (error) { next(error); }
});

// LECTURER: Delete empty team
teamRouter.delete('/teams/:teamId', authenticateJwt, requireRoles('LECTURER', 'ADMIN'), async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const result = await teamService.deleteTeam(teamId);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) { next(error); }
});


// GET all teams for an exam (Lecturer or Student in class)
teamRouter.get('/exams/:examId/teams', authenticateJwt, async (req: AuthRequest, res: Response, next) => {
  try {
    const examId = req.params.examId as string;
    const teams = await teamService.getTeamsByExam(examId);
    res.status(200).json({ success: true, data: teams });
  } catch (error) { next(error); }
});

// GET student's own team for an exam
teamRouter.get('/exams/:examId/my-team', authenticateJwt, async (req: AuthRequest, res: Response, next) => {
  try {
    const examId = req.params.examId as string;
    const team = await teamRepository.findTeamByStudent(examId, req.user!.userId);
    res.status(200).json({ success: true, data: team });
  } catch (error) { next(error); }
});

// ADD member to team
teamRouter.post('/teams/:teamId/members', authenticateJwt, requireRoles('LECTURER', 'ADMIN'), async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const { studentId, role, githubUsername } = req.body;
    if (!studentId) throw new HttpError(400, 'studentId không được để trống.');
    const member = await teamService.addMember(teamId, studentId, role, githubUsername);
    res.status(201).json({ success: true, data: member });
  } catch (error) { next(error); }
});

// REMOVE member from team
teamRouter.delete('/teams/:teamId/members/:studentId', authenticateJwt, requireRoles('LECTURER', 'ADMIN'), async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const studentId = req.params.studentId as string;
    await teamService.removeMember(teamId, studentId);
    res.status(200).json({ success: true, message: 'Đã xóa thành viên khỏi nhóm.' });
  } catch (error) { next(error); }
});

// BR-13: LECTURER changes team leader
teamRouter.put('/teams/:teamId/leader', authenticateJwt, requireRoles('LECTURER', 'ADMIN'), async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const { newLeaderStudentId, reason } = req.body;
    if (!newLeaderStudentId) throw new HttpError(400, 'newLeaderStudentId không được để trống.');
    const team = await teamService.changeLeader(teamId, newLeaderStudentId, req.user!.userId, reason);
    res.status(200).json({ success: true, data: team });
  } catch (error) { next(error); }
});

// UPDATE team GitHub Repo URL
teamRouter.put('/teams/:teamId/repo', authenticateJwt, async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const { repoUrl } = req.body;
    if (!repoUrl) throw new HttpError(400, 'repoUrl không được để trống.');
    const team = await teamService.updateRepoUrl(teamId, repoUrl);
    res.status(200).json({ success: true, data: team });
  } catch (error) { next(error); }
});

// UPDATE student's GitHub username (Lecturer or self)
teamRouter.put('/teams/:teamId/members/:studentId/github', authenticateJwt, async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const studentId = req.params.studentId as string;
    const { githubUsername } = req.body;
    const isLecturer = req.user!.role === 'LECTURER' || req.user!.role === 'ADMIN';
    if (!isLecturer && req.user!.userId !== studentId) {
      throw new HttpError(403, 'Bạn chỉ có thể cập nhật GitHub username của chính mình.');
    }
    const member = await teamService.updateMemberGithub(teamId, studentId, (githubUsername || '').trim());
    res.status(200).json({ success: true, data: member });
  } catch (error) { next(error); }
});

// LECTURER: Manual grade override for a team member
teamRouter.put('/teams/:teamId/members/:studentId/score', authenticateJwt, requireRoles('LECTURER', 'ADMIN'), async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const studentId = req.params.studentId as string;
    const { score } = req.body;
    const updated = await teamService.updateMemberScore(teamId, studentId, Number(score));
    res.status(200).json({ success: true, data: updated });
  } catch (error) { next(error); }
});


// UPDATE student's own GitHub username (alias)
teamRouter.put('/teams/:teamId/my-github', authenticateJwt, async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const { githubUsername } = req.body;
    if (!githubUsername) throw new HttpError(400, 'githubUsername không được để trống.');
    const member = await teamService.updateMemberGithub(teamId, req.user!.userId, githubUsername);
    res.status(200).json({ success: true, data: member });
  } catch (error) { next(error); }
});

// UC19: Trigger Git Analytics sync & BR-12 scoring
teamRouter.post('/teams/:teamId/sync-git', authenticateJwt, async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const { lowerBound, upperBound } = req.body;
    const contributions = await teamService.syncGitAnalytics(teamId, { lowerBound, upperBound });
    res.status(200).json({ success: true, data: contributions });
  } catch (error) { next(error); }
});

// UC20: View Teamwork Contribution Report
teamRouter.get('/teams/:teamId/contributions', authenticateJwt, async (req: AuthRequest, res: Response, next) => {
  try {
    const teamId = req.params.teamId as string;
    const contributions = await teamService.getTeamContributions(teamId);
    res.status(200).json({ success: true, data: contributions });
  } catch (error) { next(error); }
});
