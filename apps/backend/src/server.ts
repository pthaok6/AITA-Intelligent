import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { autogradingWorker } from './workers/autograding.worker';

const PORT = process.env.PORT || 5000;

// Khởi động Autograding Worker lắng nghe hàng đợi
autogradingWorker.init();

app.listen(PORT, () => {
  console.log(`🚀 AITA Backend Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});
