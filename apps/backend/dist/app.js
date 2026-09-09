"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_controller_1 = require("./modules/auth/auth.controller");
const class_controller_1 = require("./modules/classes/class.controller");
const exam_controller_1 = require("./modules/exams/exam.controller");
const submission_controller_1 = require("./modules/submissions/submission.controller");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
// API Routes
exports.app.use('/api/auth', auth_controller_1.authRouter);
exports.app.use('/api/classes', class_controller_1.classRouter);
exports.app.use('/api/exams', exam_controller_1.examRouter);
exports.app.use('/api', submission_controller_1.submissionRouter);
exports.app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'AITA Backend API', time: new Date().toISOString() });
});
