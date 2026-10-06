"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = require("./app");
const config_1 = require("./config");
const prisma_1 = require("./infrastructure/database/prisma");
const bullmq_job_queue_1 = require("./infrastructure/queue/bullmq-job-queue");
const PORT = process.env.PORT || 5000;
(0, config_1.jwtSecret)();
const server = app_1.app.listen(PORT, () => {
    console.log(`🚀 AITA Backend Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});
server.on('error', error => { console.error(error.message); process.exit(1); });
let stopping = false;
async function stop() {
    if (stopping)
        return;
    stopping = true;
    server.close(async () => {
        await bullmq_job_queue_1.defaultJobQueue.close();
        await prisma_1.prisma.$disconnect();
        process.exit(0);
    });
}
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
