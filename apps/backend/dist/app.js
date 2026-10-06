"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const config_1 = require("./config");
const http_1 = require("./shared/http");
const roster_import_controller_1 = require("./modules/classes/roster-import.controller");
const auth_controller_1 = require("./modules/auth/auth.controller");
const class_controller_1 = require("./modules/classes/class.controller");
const exam_controller_1 = require("./modules/exams/exam.controller");
const submission_controller_1 = require("./modules/submissions/submission.controller");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)({ credentials: true, origin: (origin, callback) => {
        if (!origin || (0, config_1.allowedOrigins)().includes(origin))
            callback(null, true);
        else
            callback(new http_1.HttpError(403, 'Nguồn yêu cầu không được cho phép.'));
    } }));
exports.app.use((0, cookie_parser_1.default)());
exports.app.use(express_1.default.json({ limit: '1mb' }));
// A custom header requires CORS preflight and blocks cookie-based form/login CSRF.
exports.app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-AITA-Request') !== '1' && !req.get('Authorization')?.startsWith('Bearer ')) {
        res.status(403).json({ success: false, message: 'Yêu cầu thiếu header xác thực nguồn.' });
        return;
    }
    next();
});
// API Routes
exports.app.use('/api/auth', auth_controller_1.authRouter);
exports.app.use('/api/classes', roster_import_controller_1.rosterImportRouter);
exports.app.use('/api/classes', class_controller_1.classRouter);
exports.app.use('/api/exams', exam_controller_1.examRouter);
exports.app.use('/api', submission_controller_1.submissionRouter);
exports.app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'AITA Backend API', time: new Date().toISOString() });
});
exports.app.use(http_1.errorHandler);
