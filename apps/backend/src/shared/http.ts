import { ErrorRequestHandler, NextFunction, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export function asyncRoute(handler: (req: any, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) res.status(error.status).json({ success: false, message: error.message, details: error.details });
  else if (error.code === 'LIMIT_FILE_SIZE') res.status(413).json({ success: false, message: 'File vượt giới hạn tải lên (Excel 10 MiB, ZIP 25 MiB).' });
  else if (error.code?.startsWith('LIMIT_')) res.status(400).json({ success: false, message: 'Chỉ gửi một file ở trường file và các trường cấu hình được hỗ trợ.' });
  else if (error.code === 'P2002') res.status(409).json({ success: false, message: 'Dữ liệu đã tồn tại. Vui lòng kiểm tra và thử lại.' });
  else if (error instanceof SyntaxError && 'body' in error) res.status(400).json({ success: false, message: 'JSON không hợp lệ.' });
  else { console.error('[API]', error.message); res.status(500).json({ success: false, message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' }); }
};
