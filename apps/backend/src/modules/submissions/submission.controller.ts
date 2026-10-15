import { Router } from 'express';
import multer from 'multer';
import { submissionService } from './submission.service';
import { authenticateJwt, AuthRequest } from '../../middlewares/auth.middleware';
import { classAccess } from '../classes/class-access';
import { examService } from '../exams/exam.service';
import { asyncRoute, HttpError } from '../../shared/http';
import { archivePath, ZIP_LIMIT } from '../../infrastructure/storage/submission-archive';
import { prisma } from '../../infrastructure/database/prisma';

export const submissionRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ZIP_LIMIT, files: 1, fields: 1, fieldSize: 512, parts: 2 },
  fileFilter: (_req, file, done) => /\.zip$/i.test(file.originalname) ? done(null, true) : done(new HttpError(400, 'Chỉ nhận bài nộp .zip.')) });

submissionRouter.post('/exams/:examId/submissions', authenticateJwt,
  asyncRoute(async (req: AuthRequest, _res, next) => { await submissionService.authorizeSubmission(String(req.params.examId), req.user!.userId); next(); }),
  upload.single('file'), asyncRoute(async (req: AuthRequest, res) => {
    if (!req.file) throw new HttpError(400, 'Gửi ZIP ở trường file, dùng multipart/form-data.');
    const submission = await submissionService.submitArchive(String(req.params.examId), req.user!.userId, req.file.buffer, req.file.originalname, req.body.entrypoint);
    res.status(201).json({ success: true, data: {
      id: submission.id, examId: submission.examId, submittedAt: submission.submittedAt,
      status: submission.status, scoreReleased: false,
    } });
  }));

async function authorizedSubmission(req: AuthRequest) {
  const submission = await submissionService.getSubmission(String(req.params.id));
  if (submission.studentId !== req.user!.userId) await classAccess(submission.exam.classId, req.user!, true);
  else if (await submissionService.getLatestSubmissionId(submission.examId, req.user!.userId) !== submission.id) throw new HttpError(404, 'KhÃ´ng tÃ¬m tháº¥y bÃ i ná»™p hiá»‡n hÃ nh.');
  return submission;
}
submissionRouter.get('/submissions/:id/archive', authenticateJwt, asyncRoute(async (req: AuthRequest, res, next) => {
  const submission = await authorizedSubmission(req);
  if (submission.artifactType !== 'ZIP') throw new HttpError(404, 'Bài nộp cũ không có ZIP.');
  res.download(archivePath(submission.sourceCodeUrl), 'submission-' + submission.id + '.zip', error => { if (error) next(error); });
}));
submissionRouter.get('/submissions/:id', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const submission = await authorizedSubmission(req);
  const studentView = req.user!.role === 'STUDENT';
  const scoreReleased = !studentView || new Date() >= submission.exam.endTime;
  if (studentView && !scoreReleased) {
    const isCompileError = submission.status === 'COMPILE_ERROR';
    res.json({ success: true, data: {
      id: submission.id, examId: submission.examId, studentId: submission.studentId,
      exam: submission.exam, student: submission.student, sourceFiles: submission.sourceFiles,
      fileHashSha256: submission.fileHashSha256, artifactType: submission.artifactType,
      originalFilename: submission.originalFilename, entrypoint: submission.entrypoint,
      submittedAt: submission.submittedAt, status: submission.status,
      scoreReleased: false, scoreReleaseAt: submission.exam.endTime,
      totalScore: null,
      compileMessage: isCompileError ? submission.compileMessage : null,
      aiReviews: isCompileError ? submission.aiReviews : [],
      testResults: [], astStatus: null,
      astMessage: null, astVersion: null, astK: null, astW: null, _count: { fingerprints: 0 },
    } });
    return;
  }
  res.json({ success: true, data: { ...submission, sourceCodeUrl: undefined,
    scoreReleased,
    aiReviews: submission.aiReviews || [],
    astStatus: studentView ? null : submission.astStatus,
    astMessage: studentView ? null : submission.astMessage,
    astVersion: studentView ? null : submission.astVersion,
    astK: studentView ? null : submission.astK,
    astW: studentView ? null : submission.astW,
    _count: studentView ? { fingerprints: 0 } : submission._count,
    testResults: submission.testResults.map(result => studentView && result.testCase.isHidden ? { ...result, actualOutput: null, stderr: null } : result) } });
}));
submissionRouter.get('/exams/:examId/submissions', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const exam = await examService.getExamById(String(req.params.examId));
  const studentView = req.user!.role === 'STUDENT';
  await classAccess(exam.classId, req.user!, !studentView);
  const submissions = await submissionService.getSubmissionsByExam(exam.id, studentView ? req.user!.userId : undefined);
  const scoreReleased = !studentView || new Date() >= exam.endTime;
  res.json({ success: true, data: submissions.map(submission => {
    if (studentView && !scoreReleased) return {
      id: submission.id, examId: submission.examId, studentId: submission.studentId,
      student: submission.student, submittedAt: submission.submittedAt, status: submission.status,
      scoreReleased: false, totalScore: null, astStatus: null, compileMessage: null,
      _count: { testResults: 0 },
    };
    if (studentView) return {
      id: submission.id, examId: submission.examId, studentId: submission.studentId,
      student: submission.student, submittedAt: submission.submittedAt, status: submission.status,
      scoreReleased: true, totalScore: submission.totalScore,
    };
    return { ...submission, sourceCodeUrl: undefined, scoreReleased };
  }) });
}));
submissionRouter.get('/exams/:examId/plagiarism', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const exam = await examService.getExamById(String(req.params.examId));
  await classAccess(exam.classId, req.user!, true);
  const latest = await submissionService.getSubmissionsByExam(exam.id);
  const latestIds = latest.map(submission => submission.id);
  const reports = await prisma.plagiarismReport.findMany({ where: { examId: exam.id, submissionAId: { in: latestIds }, submissionBId: { in: latestIds } }, orderBy: { similarityScore: 'desc' },
    include: { submissionA: { select: { id: true, student: { select: { fullName: true, email: true } } } }, submissionB: { select: { id: true, student: { select: { fullName: true, email: true } } } } } });
  res.json({ success: true, data: reports });
}));
submissionRouter.get('/submissions/:id/fingerprints', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  if (req.user!.role === 'STUDENT') throw new HttpError(403, 'Báo cáo fingerprint chỉ dành cho giảng viên.');
  const submission = await authorizedSubmission(req);
  const fingerprints = await prisma.aSTFingerprint.findMany({ where: { submissionId: submission.id }, orderBy: [{ sourcePath: 'asc' }, { tokenStart: 'asc' }], take: 1000 });
  res.json({ success: true, data: { total: submission._count.fingerprints, limit: 1000, items: fingerprints.map(fp => ({ ...fp, hashValue: fp.hashValue.toString() })) } });
}));
