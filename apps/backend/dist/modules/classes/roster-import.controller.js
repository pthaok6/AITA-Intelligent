"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rosterImportRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const http_1 = require("../../shared/http");
const roster_import_service_1 = require("./roster-import.service");
exports.rosterImportRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: roster_import_service_1.MAX_IMPORT_BYTES, files: 1, fields: 2, fieldSize: 20000 },
    fileFilter: (_req, file, callback) => {
        if (!/\.xlsx$/i.test(file.originalname)) {
            callback(new http_1.HttpError(400, 'Chỉ hỗ trợ file .xlsx.'));
            return;
        }
        callback(null, true);
    },
});
function mapping(value) {
    if (value === undefined || value === '')
        return undefined;
    try {
        return JSON.parse(String(value));
    }
    catch {
        throw new http_1.HttpError(400, 'Mapping không hợp lệ.');
    }
}
// Authorization precedes reading the multipart body.
exports.rosterImportRouter.use('/:classId/students/import', auth_middleware_1.authenticateJwt, (0, auth_middleware_1.requireRoles)('LECTURER'), (0, http_1.asyncRoute)(async (req, _res, next) => {
    await roster_import_service_1.rosterImportService.authorize(String(req.params.classId), req.user);
    next();
}));
exports.rosterImportRouter.post('/:classId/students/import/preview', upload.single('file'), (0, http_1.asyncRoute)(async (req, res) => {
    if (!req.file)
        throw new http_1.HttpError(400, 'Vui lòng chọn file Excel.');
    res.json({ success: true, data: await roster_import_service_1.rosterImportService.preview(String(req.params.classId), req.user, req.file.buffer, mapping(req.body.mapping)) });
}));
exports.rosterImportRouter.post('/:classId/students/import', upload.single('file'), (0, http_1.asyncRoute)(async (req, res) => {
    if (!req.file)
        throw new http_1.HttpError(400, 'Vui lòng chọn file Excel.');
    res.json({ success: true, data: await roster_import_service_1.rosterImportService.commit(String(req.params.classId), req.user, req.file.buffer, mapping(req.body.mapping), req.body.previewToken) });
}));
