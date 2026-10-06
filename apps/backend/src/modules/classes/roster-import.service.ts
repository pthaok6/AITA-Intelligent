import ExcelJS from 'exceljs';
import yauzl from 'yauzl';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { institutionalEmail } from '../auth/auth.service';
import { jwtSecret } from '../../config';
import { HttpError } from '../../shared/http';

export interface ColumnMapping { email: number; fullName: number }
export interface RosterRow { row: number; email: string; fullName: string }
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024 - 1;
const MAX_ROWS = 5000;

async function validateArchive(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) { reject(new HttpError(400, 'File XLSX không hợp lệ.')); return; }
      let expanded = 0, entries = 0;
      let failed = false;
      const fail = () => { if (!failed) { failed = true; zip.close(); reject(new HttpError(400, 'File Excel vượt giới hạn giải nén an toàn.')); } };
      zip.on('error', fail);
      zip.on('entry', entry => {
        expanded += entry.uncompressedSize;
        entries++;
        if (entries > 2000 || expanded > 50 * 1024 * 1024 || entry.uncompressedSize > Math.max(1024 * 1024, entry.compressedSize * 100)) { fail(); return; }
        zip.readEntry();
      });
      zip.on('end', () => { if (!failed) resolve(); });
      zip.readEntry();
    });
  });
}
function cellText(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) throw new Error('Không chấp nhận ô công thức hoặc ô lỗi.');
  return cell.text.trim();
}
export async function readRoster(buffer: Buffer, mappingInput?: unknown) {
  if (!buffer.length || buffer.length > MAX_IMPORT_BYTES) throw new HttpError(413, 'File Excel phải nhỏ hơn 10 MB.');
  await validateArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as any); } catch { throw new HttpError(400, 'Không thể đọc file Excel. Chỉ hỗ trợ .xlsx không mã hóa.'); }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) throw new HttpError(400, 'File cần một dòng tiêu đề và ít nhất một sinh viên.');
  if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 100) throw new HttpError(400, 'Tối đa 5.000 dòng sinh viên và 100 cột.');
  const headers: Array<{ index: number; label: string }> = [];
  sheet.getRow(1).eachCell((cell, index) => { headers.push({ index, label: cell.text.trim() || 'Cột ' + index }); });
  const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
  const emailColumn = headers.find(header => ['email', 'emailfpt', 'emailaddress'].includes(normalized(header.label)))?.index;
  const nameColumn = headers.find(header => ['fullname', 'name', 'hovaten', 'hoten'].includes(normalized(header.label)))?.index;
  const mapping = (mappingInput ?? { email: emailColumn, fullName: nameColumn }) as ColumnMapping;
  if (!mapping || typeof mapping !== 'object' || !Number.isInteger(mapping.email) || !Number.isInteger(mapping.fullName) ||
      mapping.email === mapping.fullName || !headers.some(h => h.index === mapping.email) || !headers.some(h => h.index === mapping.fullName)) {
    return { headers, mapping: null, rows: [] as RosterRow[], errors: [{ row: 1, message: 'Vui lòng chọn hai cột Email và Họ tên khác nhau.' }] };
  }
  const canonicalMapping = { email: mapping.email, fullName: mapping.fullName };
  const rows: RosterRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const seen = new Set<string>();
  for (let number = 2; number <= sheet.rowCount; number++) {
    const line = sheet.getRow(number);
    if (!line.hasValues) continue;
    try {
      const email = institutionalEmail(cellText(line.getCell(mapping.email)));
      const fullName = cellText(line.getCell(mapping.fullName));
      if (!fullName || fullName.length > 100) throw new Error('Họ tên cần từ 1 đến 100 ký tự.');
      if (seen.has(email)) throw new Error('Email trùng trong file: ' + email);
      seen.add(email);
      rows.push({ row: number, email, fullName });
    } catch (error: any) { errors.push({ row: number, message: error.message }); }
  }
  if (!rows.length && !errors.length) errors.push({ row: 2, message: 'Không có sinh viên trong các cột đã chọn.' });
  return { headers, mapping: canonicalMapping, rows, errors };
}
const fileHash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

export class RosterImportService {
  constructor(private db: PrismaClient = prisma) {}
  async authorize(classId: string, actor: { userId: string; role: string }) {
    const cls = await this.db.class.findUnique({ where: { id: classId } });
    if (!cls) throw new HttpError(404, 'Không tìm thấy lớp học.');
    if (actor.role !== 'ADMIN' && (actor.role !== 'LECTURER' || cls.lecturerId !== actor.userId)) throw new HttpError(403, 'Bạn không có quyền import vào lớp này.');
  }
  async preview(classId: string, actor: { userId: string; role: string }, buffer: Buffer, mapping?: unknown) {
    await this.authorize(classId, actor);
    const parsed = await readRoster(buffer, mapping);
    const previewToken = !parsed.errors.length && parsed.mapping ? jwt.sign({
      classId, userId: actor.userId, hash: fileHash(buffer), mapping: parsed.mapping,
    }, jwtSecret(), { algorithm: 'HS256', expiresIn: '15m', issuer: 'aita-import', audience: 'aita-import' }) : null;
    return { ...parsed, totalRows: parsed.rows.length + parsed.errors.length, previewToken };
  }
  async commit(classId: string, actor: { userId: string; role: string }, buffer: Buffer, mapping: unknown, previewToken: unknown) {
    await this.authorize(classId, actor);
    const parsed = await readRoster(buffer, mapping);
    if (parsed.errors.length || !parsed.mapping) throw new HttpError(422, 'Dữ liệu không hợp lệ. Không có sinh viên nào được import.', parsed.errors);
    let receipt: jwt.JwtPayload;
    try {
      if (typeof previewToken !== 'string') throw new Error();
      const verified = jwt.verify(previewToken, jwtSecret(), { algorithms: ['HS256'], issuer: 'aita-import', audience: 'aita-import' });
      if (typeof verified === 'string') throw new Error();
      receipt = verified;
    } catch { throw new HttpError(409, 'Vui lòng xem trước file trước khi xác nhận import.'); }
    if (receipt.classId !== classId || receipt.userId !== actor.userId || receipt.hash !== fileHash(buffer) || JSON.stringify(receipt.mapping) !== JSON.stringify(parsed.mapping)) {
      throw new HttpError(409, 'File hoặc mapping đã thay đổi. Vui lòng xem trước lại.');
    }
    try {
      return await this.db.$transaction(async tx => {
        // Recheck ownership inside the same transaction as every user/enrollment write.
        const cls = await tx.class.findUnique({ where: { id: classId } });
        if (!cls || (actor.role !== 'ADMIN' && cls.lecturerId !== actor.userId)) throw new HttpError(403, 'Bạn không có quyền import vào lớp này.');
        let added = 0, skipped = 0, createdUsers = 0;
        for (const row of parsed.rows) {
          let user = await tx.user.findUnique({ where: { email: row.email } });
          if (user && (user.role !== 'STUDENT' || !user.isActive)) throw new HttpError(422, 'Import đã được rollback.', [{ row: row.row, message: 'Email thuộc tài khoản bị khóa hoặc không phải sinh viên.' }]);
          if (!user) {
            user = await tx.user.create({ data: { email: row.email, fullName: row.fullName, role: 'STUDENT' } });
            createdUsers++;
          }
          const existing = await tx.classEnrollment.findUnique({ where: { classId_studentId: { classId, studentId: user.id } } });
          if (existing?.status === 'ACTIVE') { skipped++; continue; }
          await tx.classEnrollment.upsert({ where: { classId_studentId: { classId, studentId: user.id } }, create: { classId, studentId: user.id }, update: { status: 'ACTIVE' } });
          added++;
        }
        return { added, skipped, createdUsers, total: parsed.rows.length, errors: [] };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 });
    } catch (error: any) {
      if (error.code === 'P2034' || error.code === 'P2002') throw new HttpError(409, 'Có thay đổi dữ liệu đồng thời; import đã rollback. Vui lòng xem trước và thử lại.');
      throw error;
    }
  }
}
export const rosterImportService = new RosterImportService();
