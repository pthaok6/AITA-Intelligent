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
    res.status(201).json({ success: true, data: { ...submission, sourceCodeUrl: undefined } });
  }));

async function authorizedSubmission(req: AuthRequest) {
  const submission = await submissionService.getSubmission(String(req.params.id));
  if (submission.studentId !== req.user!.userId) await classAccess(submission.exam.classId, req.user!, true);
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
  res.json({ success: true, data: { ...submission, sourceCodeUrl: undefined,
    testResults: submission.testResults.map(result => studentView && result.testCase.isHidden ? { ...result, actualOutput: null, stderr: null } : result) } });
}));
submissionRouter.get('/exams/:examId/submissions', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const exam = await examService.getExamById(String(req.params.examId));
  await classAccess(exam.classId, req.user!, true);
  res.json({ success: true, data: (await submissionService.getSubmissionsByExam(exam.id)).map(submission => ({ ...submission, sourceCodeUrl: undefined })) });
}));
submissionRouter.get('/exams/:examId/plagiarism', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const exam = await examService.getExamById(String(req.params.examId));
  await classAccess(exam.classId, req.user!, true);
  const reports = await prisma.plagiarismReport.findMany({ where: { examId: exam.id }, orderBy: { similarityScore: 'desc' },
    include: { submissionA: { select: { id: true, student: { select: { fullName: true, email: true } } } }, submissionB: { select: { id: true, student: { select: { fullName: true, email: true } } } } } });
  res.json({ success: true, data: reports });
}));
submissionRouter.get('/submissions/:id/fingerprints', authenticateJwt, asyncRoute(async (req: AuthRequest, res) => {
  const submission = await authorizedSubmission(req);
  const fingerprints = await prisma.aSTFingerprint.findMany({ where: { submissionId: submission.id }, orderBy: [{ sourcePath: 'asc' }, { tokenStart: 'asc' }], take: 1000 });
  res.json({ success: true, data: { total: submission._count.fingerprints, limit: 1000, items: fingerprints.map(fp => ({ ...fp, hashValue: fp.hashValue.toString() })) } });
}));
