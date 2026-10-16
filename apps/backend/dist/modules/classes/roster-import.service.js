"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rosterImportService = exports.RosterImportService = exports.MAX_IMPORT_BYTES = void 0;
exports.readRoster = readRoster;
const exceljs_1 = __importDefault(require("exceljs"));
const yauzl_1 = __importDefault(require("yauzl"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_1 = require("../../infrastructure/database/prisma");
const auth_service_1 = require("../auth/auth.service");
const config_1 = require("../../config");
const http_1 = require("../../shared/http");
exports.MAX_IMPORT_BYTES = 10 * 1024 * 1024 - 1;
const MAX_ROWS = 5000;
async function validateArchive(buffer) {
    await new Promise((resolve, reject) => {
        yauzl_1.default.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
            if (error || !zip) {
                reject(new http_1.HttpError(400, 'File XLSX không hợp lệ.'));
                return;
            }
            let expanded = 0, entries = 0;
            let failed = false;
            const fail = () => { if (!failed) {
                failed = true;
                zip.close();
                reject(new http_1.HttpError(400, 'File Excel vượt giới hạn giải nén an toàn.'));
            } };
            zip.on('error', fail);
            zip.on('entry', entry => {
                expanded += entry.uncompressedSize;
                entries++;
                if (entries > 2000 || expanded > 50 * 1024 * 1024 || entry.uncompressedSize > Math.max(1024 * 1024, entry.compressedSize * 100)) {
                    fail();
                    return;
                }
                zip.readEntry();
            });
            zip.on('end', () => { if (!failed)
                resolve(); });
            zip.readEntry();
        });
    });
}
function cellText(cell) {
    if (cell.type === exceljs_1.default.ValueType.Formula || cell.type === exceljs_1.default.ValueType.Error)
        throw new Error('Không chấp nhận ô công thức hoặc ô lỗi.');
    return cell.text.trim();
}
async function readRoster(buffer, mappingInput) {
    if (!buffer.length || buffer.length > exports.MAX_IMPORT_BYTES)
        throw new http_1.HttpError(413, 'File Excel phải nhỏ hơn 10 MB.');
    await validateArchive(buffer);
    const workbook = new exceljs_1.default.Workbook();
    try {
        await workbook.xlsx.load(buffer);
    }
    catch {
        throw new http_1.HttpError(400, 'Không thể đọc file Excel. Chỉ hỗ trợ .xlsx không mã hóa.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2)
        throw new http_1.HttpError(400, 'File cần một dòng tiêu đề và ít nhất một sinh viên.');
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 100)
        throw new http_1.HttpError(400, 'Tối đa 5.000 dòng sinh viên và 100 cột.');
    const headers = [];
    sheet.getRow(1).eachCell((cell, index) => { headers.push({ index, label: cell.text.trim() || 'Cột ' + index }); });
    const normalized = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
    const emailColumn = headers.find(header => ['email', 'emailfpt', 'emailaddress'].includes(normalized(header.label)))?.index;
    const nameColumn = headers.find(header => ['fullname', 'name', 'hovaten', 'hoten'].includes(normalized(header.label)))?.index;
    const mapping = (mappingInput ?? { email: emailColumn, fullName: nameColumn });
    if (!mapping || typeof mapping !== 'object' || !Number.isInteger(mapping.email) || !Number.isInteger(mapping.fullName) ||
        mapping.email === mapping.fullName || !headers.some(h => h.index === mapping.email) || !headers.some(h => h.index === mapping.fullName)) {
        return { headers, mapping: null, rows: [], errors: [{ row: 1, message: 'Vui lòng chọn hai cột Email và Họ tên khác nhau.' }] };
    }
    const canonicalMapping = { email: mapping.email, fullName: mapping.fullName };
    const rows = [];
    const errors = [];
    const seen = new Set();
    for (let number = 2; number <= sheet.rowCount; number++) {
        const line = sheet.getRow(number);
        if (!line.hasValues)
            continue;
        try {
            const email = (0, auth_service_1.institutionalEmail)(cellText(line.getCell(mapping.email)));
            const fullName = cellText(line.getCell(mapping.fullName));
            if (!fullName || fullName.length > 100)
                throw new Error('Họ tên cần từ 1 đến 100 ký tự.');
            if (seen.has(email))
                throw new Error('Email trùng trong file: ' + email);
            seen.add(email);
            rows.push({ row: number, email, fullName });
        }
        catch (error) {
            errors.push({ row: number, message: error.message });
        }
    }
    if (!rows.length && !errors.length)
        errors.push({ row: 2, message: 'Không có sinh viên trong các cột đã chọn.' });
    return { headers, mapping: canonicalMapping, rows, errors };
}
const fileHash = (buffer) => (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex');
class RosterImportService {
    db;
    constructor(db = prisma_1.prisma) {
        this.db = db;
    }
    async authorize(classId, actor) {
        const cls = await this.db.class.findUnique({ where: { id: classId } });
        if (!cls)
            throw new http_1.HttpError(404, 'Không tìm thấy lớp học.');
        if (actor.role !== 'ADMIN' && (actor.role !== 'LECTURER' || cls.lecturerId !== actor.userId))
            throw new http_1.HttpError(403, 'Bạn không có quyền import vào lớp này.');
    }
    async preview(classId, actor, buffer, mapping) {
        await this.authorize(classId, actor);
        const parsed = await readRoster(buffer, mapping);
        const users = parsed.rows.length ? await this.db.user.findMany({
            where: { email: { in: parsed.rows.map(row => row.email) } },
            select: { email: true, role: true, isActive: true },
        }) : [];
        const usersByEmail = new Map(users.map(user => [user.email, user]));
        const rows = parsed.rows.map(row => {
            const user = usersByEmail.get(row.email);
            return { ...row, accountStatus: !user ? 'NOT_FOUND' : !user.isActive ? 'INACTIVE' : user.role !== 'STUDENT' ? 'NOT_STUDENT' : 'READY' };
        });
        const hasIneligibleAccount = rows.some(row => row.accountStatus === 'INACTIVE' || row.accountStatus === 'NOT_STUDENT');
        const previewToken = !parsed.errors.length && !hasIneligibleAccount && parsed.mapping ? jsonwebtoken_1.default.sign({
            classId, userId: actor.userId, hash: fileHash(buffer), mapping: parsed.mapping,
        }, (0, config_1.jwtSecret)(), { algorithm: 'HS256', expiresIn: '15m', issuer: 'aita-import', audience: 'aita-import' }) : null;
        return { ...parsed, rows, totalRows: parsed.rows.length + parsed.errors.length, previewToken };
    }
    async commit(classId, actor, buffer, mapping, previewToken) {
        await this.authorize(classId, actor);
        const parsed = await readRoster(buffer, mapping);
        if (parsed.errors.length || !parsed.mapping)
            throw new http_1.HttpError(422, 'Dữ liệu không hợp lệ. Không có sinh viên nào được import.', parsed.errors);
        let receipt;
        try {
            if (typeof previewToken !== 'string')
                throw new Error();
            const verified = jsonwebtoken_1.default.verify(previewToken, (0, config_1.jwtSecret)(), { algorithms: ['HS256'], issuer: 'aita-import', audience: 'aita-import' });
            if (typeof verified === 'string')
                throw new Error();
            receipt = verified;
        }
        catch {
            throw new http_1.HttpError(409, 'Vui lòng xem trước file trước khi xác nhận import.');
        }
        if (receipt.classId !== classId || receipt.userId !== actor.userId || receipt.hash !== fileHash(buffer) || JSON.stringify(receipt.mapping) !== JSON.stringify(parsed.mapping)) {
            throw new http_1.HttpError(409, 'File hoặc mapping đã thay đổi. Vui lòng xem trước lại.');
        }
        try {
            return await this.db.$transaction(async (tx) => {
                // Recheck ownership inside the same transaction as every user/enrollment write.
                const cls = await tx.class.findUnique({ where: { id: classId } });
                if (!cls || (actor.role !== 'ADMIN' && cls.lecturerId !== actor.userId))
                    throw new http_1.HttpError(403, 'Bạn không có quyền import vào lớp này.');
                let added = 0, skipped = 0, missingAccounts = 0;
                for (const row of parsed.rows) {
                    const user = await tx.user.findUnique({ where: { email: row.email } });
                    if (!user) {
                        missingAccounts++;
                        continue;
                    }
                    if (user.role !== 'STUDENT' || !user.isActive)
                        throw new http_1.HttpError(422, 'Import đã được rollback.', [{ row: row.row, message: 'Email thuộc tài khoản bị khóa hoặc không phải sinh viên.' }]);
                    const existing = await tx.classEnrollment.findUnique({ where: { classId_studentId: { classId, studentId: user.id } } });
                    if (existing?.status === 'ACTIVE') {
                        skipped++;
                        continue;
                    }
                    await tx.classEnrollment.upsert({ where: { classId_studentId: { classId, studentId: user.id } }, create: { classId, studentId: user.id }, update: { status: 'ACTIVE' } });
                    added++;
                }
                return { added, skipped, missingAccounts, total: parsed.rows.length, errors: [] };
            }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 });
        }
        catch (error) {
            if (error.code === 'P2034' || error.code === 'P2002')
                throw new http_1.HttpError(409, 'Có thay đổi dữ liệu đồng thời; import đã rollback. Vui lòng xem trước và thử lại.');
            throw error;
        }
    }
}
exports.RosterImportService = RosterImportService;
exports.rosterImportService = new RosterImportService();
