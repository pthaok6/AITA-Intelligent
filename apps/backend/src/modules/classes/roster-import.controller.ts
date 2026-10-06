import { Router } from 'express';
import multer from 'multer';
import { authenticateJwt, requireRoles } from '../../middlewares/auth.middleware';
import { asyncRoute, HttpError } from '../../shared/http';
import { MAX_IMPORT_BYTES, rosterImportService } from './roster-import.service';

export const rosterImportRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1, fields: 2, fieldSize: 20000 },
  fileFilter: (_req, file, callback) => {
    if (!/\.xlsx$/i.test(file.originalname)) { callback(new HttpError(400, 'Chỉ hỗ trợ file .xlsx.')); return; }
    callback(null, true);
  },
});
function mapping(value: unknown) {
  if (value === undefined || value === '') return undefined;
  try { return JSON.parse(String(value)); } catch { throw new HttpError(400, 'Mapping không hợp lệ.'); }
}
// Authorization precedes reading the multipart body.
rosterImportRouter.use('/:classId/students/import', authenticateJwt, requireRoles('LECTURER', 'ADMIN'), asyncRoute(async (req, _res, next) => {
  await rosterImportService.authorize(String(req.params.classId), req.user);
  next();
}));
rosterImportRouter.post('/:classId/students/import/preview', upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Vui lòng chọn file Excel.');
  res.json({ success: true, data: await rosterImportService.preview(String(req.params.classId), req.user, req.file.buffer, mapping(req.body.mapping)) });
}));
rosterImportRouter.post('/:classId/students/import', upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Vui lòng chọn file Excel.');
  res.json({ success: true, data: await rosterImportService.commit(String(req.params.classId), req.user, req.file.buffer, mapping(req.body.mapping), req.body.previewToken) });
}));
