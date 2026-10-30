import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { isAllowedOrigin } from './config';
import { HttpError, errorHandler } from './shared/http';
import { rosterImportRouter } from './modules/classes/roster-import.controller';
import { authRouter } from './modules/auth/auth.controller';
import { classRouter } from './modules/classes/class.controller';
import { examRouter } from './modules/exams/exam.controller';
import { submissionRouter } from './modules/submissions/submission.controller';
import { adminRouter } from './modules/auth/admin.controller';
import { teamRouter } from './modules/teams/team.controller';
import { appealRouter } from './modules/appeals/appeal.controller';
import { aiRouter } from './modules/ai/ai.controller';
import { notificationRouter } from './modules/notifications/notification.controller';

export const app = express();

app.use(cors({ credentials: true, origin: (origin, callback) => {
  if (isAllowedOrigin(origin)) callback(null, true);
  else callback(new HttpError(403, 'Nguồn yêu cầu không được phép.'));
} }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
// A custom header requires CORS preflight and blocks cookie-based form/login CSRF.
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-AITA-Request') !== '1' && !req.get('Authorization')?.startsWith('Bearer ')) {
    res.status(403).json({ success: false, message: 'Yêu cầu thiếu header xác thực nguồn.' }); return;
  }
  next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/classes', rosterImportRouter);
app.use('/api/classes', classRouter);
app.use('/api/exams', examRouter);
app.use('/api', teamRouter);
app.use('/api', submissionRouter);
app.use('/api/appeals', appealRouter);
app.use('/api/ai', aiRouter);
app.use('/api/notifications', notificationRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'AITA Backend API', time: new Date().toISOString() });
});
app.use(errorHandler);
