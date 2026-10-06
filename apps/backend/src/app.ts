import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { allowedOrigins } from './config';
import { HttpError, errorHandler } from './shared/http';
import { rosterImportRouter } from './modules/classes/roster-import.controller';
import { authRouter } from './modules/auth/auth.controller';
import { classRouter } from './modules/classes/class.controller';
import { examRouter } from './modules/exams/exam.controller';
import { submissionRouter } from './modules/submissions/submission.controller';

export const app = express();

app.use(cors({ credentials: true, origin: (origin, callback) => {
  if (!origin || allowedOrigins().includes(origin)) callback(null, true);
  else callback(new HttpError(403, 'Nguồn yêu cầu không được cho phép.'));
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
app.use('/api/classes', rosterImportRouter);
app.use('/api/classes', classRouter);
app.use('/api/exams', examRouter);
app.use('/api', submissionRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'AITA Backend API', time: new Date().toISOString() });
});
app.use(errorHandler);
