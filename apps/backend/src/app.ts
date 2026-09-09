import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.controller';
import { classRouter } from './modules/classes/class.controller';
import { examRouter } from './modules/exams/exam.controller';
import { submissionRouter } from './modules/submissions/submission.controller';

export const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/classes', classRouter);
app.use('/api/exams', examRouter);
app.use('/api', submissionRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'AITA Backend API', time: new Date().toISOString() });
});
