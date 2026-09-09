"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = require("./app");
const autograding_worker_1 = require("./workers/autograding.worker");
const PORT = process.env.PORT || 5000;
// Khởi động Autograding Worker lắng nghe hàng đợi
autograding_worker_1.autogradingWorker.init();
app_1.app.listen(PORT, () => {
    console.log(`🚀 AITA Backend Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});
