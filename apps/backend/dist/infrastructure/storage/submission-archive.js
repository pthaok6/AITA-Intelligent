"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = exports.storageRoot = exports.ZIP_LIMIT = void 0;
exports.archivePath = archivePath;
exports.safeZipPath = safeZipPath;
exports.readZip = readZip;
exports.selectBundle = selectBundle;
exports.persistArchive = persistArchive;
exports.loadBundle = loadBundle;
exports.writeSandboxLog = writeSandboxLog;
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const yauzl_1 = __importDefault(require("yauzl"));
const http_1 = require("../../shared/http");
exports.ZIP_LIMIT = 25 * 1024 * 1024;
const EXPANDED_LIMIT = 50 * 1024 * 1024;
const storageRoot = () => path_1.default.resolve(process.env.SUBMISSION_STORAGE_DIR || path_1.default.join(__dirname, '../../../storage'));
exports.storageRoot = storageRoot;
const sha256 = (data) => crypto_1.default.createHash('sha256').update(data).digest('hex');
exports.sha256 = sha256;
function archivePath(key) {
    if (!/^[a-f0-9-]{36}\.zip$/.test(key))
        throw new Error('Invalid archive storage key.');
    return path_1.default.join((0, exports.storageRoot)(), 'archives', key);
}
function safeZipPath(name) {
    if (!name || name.length > 240 || name.includes('\\') || /[\x00-\x1f:]/.test(name) || name.startsWith('/') || name.replace(/\/$/, '').split('/').some(p => !p || p === '..' || p === '.')) {
        throw new http_1.HttpError(400, 'ZIP chứa đường dẫn không an toàn.');
    }
    return name;
}
// Extract bounded file contents into memory; no ZIP entry can write to the host filesystem.
async function readZip(bytes) {
    if (bytes.length > exports.ZIP_LIMIT)
        throw new http_1.HttpError(413, 'ZIP tối đa 25 MiB.');
    return new Promise((resolve, reject) => {
        yauzl_1.default.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
            if (error || !zip)
                return reject(new http_1.HttpError(400, 'File ZIP không hợp lệ.'));
            const files = [], seen = new Set();
            let expanded = 0, count = 0, ended = false;
            const fail = (error) => { if (!ended) {
                ended = true;
                zip.close();
                reject(error);
            } };
            zip.on('error', fail);
            zip.on('end', () => { if (!ended) {
                ended = true;
                resolve(files);
            } });
            zip.on('entry', async (entry) => {
                try {
                    const name = safeZipPath(entry.fileName);
                    const kind = (entry.externalFileAttributes >>> 16) & 0xf000;
                    if (kind && kind !== 0x8000 && kind !== 0x4000)
                        throw new http_1.HttpError(400, 'ZIP không được chứa symlink hoặc file đặc biệt.');
                    if ((entry.generalPurposeBitFlag & 1) || ++count > 1000)
                        throw new http_1.HttpError(400, 'ZIP mã hóa hoặc quá 1000 mục không được hỗ trợ.');
                    const folded = name.replace(/\/$/, '').toLowerCase();
                    if (seen.has(folded))
                        throw new http_1.HttpError(400, 'ZIP chứa đường dẫn trùng nhau.');
                    seen.add(folded);
                    if (name.endsWith('/')) {
                        zip.readEntry();
                        return;
                    }
                    expanded += entry.uncompressedSize;
                    if (expanded > EXPANDED_LIMIT || entry.uncompressedSize > Math.max(1024 * 1024, entry.compressedSize * 100))
                        throw new http_1.HttpError(413, 'ZIP vượt giới hạn giải nén 50 MiB hoặc tỷ lệ nén cho phép.');
                    zip.openReadStream(entry, (error, stream) => {
                        if (error || !stream)
                            return fail(new http_1.HttpError(400, 'Không đọc được ZIP.'));
                        const chunks = [];
                        let size = 0;
                        stream.on('error', fail);
                        stream.on('data', (chunk) => {
                            size += chunk.length;
                            if (size > entry.uncompressedSize || size > EXPANDED_LIMIT) {
                                stream.destroy();
                                fail(new http_1.HttpError(413, 'ZIP vượt giới hạn giải nén.'));
                            }
                            else
                                chunks.push(chunk);
                        });
                        stream.on('end', () => { if (!ended) {
                            files.push({ path: name, data: Buffer.concat(chunks) });
                            zip.readEntry();
                        } });
                    });
                }
                catch (error) {
                    fail(error);
                }
            });
            zip.readEntry();
        });
    });
}
function selectBundle(files, language, requested) {
    const extension = { PYTHON: '.py', CSHARP: '.cs', JAVA: '.java' }[language];
    if (!extension)
        throw new http_1.HttpError(400, 'Sandbox hỗ trợ PYTHON, CSHARP và JAVA.');
    const sources = files.filter(f => f.path.endsWith(extension) && !f.path.split('/').some(p => ['bin', 'obj', '.git', '__MACOSX'].includes(p)));
    if (!sources.length)
        throw new http_1.HttpError(400, `ZIP cần có file ${extension}.`);
    if (sources.length > 200)
        throw new http_1.HttpError(413, 'Tối đa 200 file mã nguồn.');
    let entrypoint = '';
    if (language === 'PYTHON') {
        const mains = sources.filter(f => path_1.default.posix.basename(f.path) === 'main.py');
        entrypoint = requested || (mains.length === 1 ? mains[0].path : sources.length === 1 ? sources[0].path : '');
        if (!sources.some(f => f.path === entrypoint))
            throw new http_1.HttpError(400, 'Chọn đường dẫn file Python chạy chính trong ZIP (ví dụ main.py).');
        safeZipPath(entrypoint);
    }
    else if (language === 'JAVA') {
        entrypoint = requested || 'Main';
        if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(entrypoint) || entrypoint.length > 200)
            throw new http_1.HttpError(400, 'Java entrypoint phải là tên lớp đầy đủ, ví dụ Main hoặc school.Main.');
    }
    else {
        if (requested)
            throw new http_1.HttpError(400, 'C# dùng Main hoặc top-level statements; để trống entrypoint.');
        entrypoint = 'Submission.dll';
    }
    // Only source files enter compiler/parser containers. Submitted project/build scripts are ignored.
    return { files: sources.sort((a, b) => a.path.localeCompare(b.path)), language, entrypoint };
}
async function persistArchive(bytes) {
    const key = crypto_1.default.randomUUID() + '.zip';
    await promises_1.default.mkdir(path_1.default.join((0, exports.storageRoot)(), 'archives'), { recursive: true });
    await promises_1.default.writeFile(archivePath(key), bytes, { flag: 'wx' });
    return { key, hash: (0, exports.sha256)(bytes) };
}
async function loadBundle(key, expectedHash, language, entrypoint) {
    const bytes = await promises_1.default.readFile(archivePath(key));
    if ((0, exports.sha256)(bytes) !== expectedHash)
        throw new Error('SHA-256 mismatch: archive integrity verification failed.');
    return selectBundle(await readZip(bytes), language, language === 'CSHARP' ? undefined : entrypoint);
}
async function writeSandboxLog(id, event) {
    if (!/^[a-f0-9-]{36}$/.test(id))
        throw new Error('Invalid submission ID.');
    await promises_1.default.mkdir(path_1.default.join((0, exports.storageRoot)(), 'logs'), { recursive: true });
    await promises_1.default.appendFile(path_1.default.join((0, exports.storageRoot)(), 'logs', id + '.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
}
