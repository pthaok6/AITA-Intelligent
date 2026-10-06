import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import yauzl from 'yauzl';
import { HttpError } from '../../shared/http';

export const ZIP_LIMIT = 25 * 1024 * 1024;
const EXPANDED_LIMIT = 50 * 1024 * 1024;
export type SourceFile = { path: string; data: Buffer };
export type SourceBundle = { files: SourceFile[]; entrypoint: string; language: string };
export const storageRoot = () => path.resolve(process.env.SUBMISSION_STORAGE_DIR || path.join(__dirname, '../../../storage'));
export const sha256 = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex');

export function archivePath(key: string): string {
  if (!/^[a-f0-9-]{36}\.zip$/.test(key)) throw new Error('Invalid archive storage key.');
  return path.join(storageRoot(), 'archives', key);
}
export function safeZipPath(name: string): string {
  if (!name || name.length > 240 || name.includes('\\') || /[\x00-\x1f:]/.test(name) || name.startsWith('/') || name.replace(/\/$/, '').split('/').some(p => !p || p === '..' || p === '.')) {
    throw new HttpError(400, 'ZIP chứa đường dẫn không an toàn.');
  }
  return name;
}

// Extract bounded file contents into memory; no ZIP entry can write to the host filesystem.
export async function readZip(bytes: Buffer): Promise<SourceFile[]> {
  if (bytes.length > ZIP_LIMIT) throw new HttpError(413, 'ZIP tối đa 25 MiB.');
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) return reject(new HttpError(400, 'File ZIP không hợp lệ.'));
      const files: SourceFile[] = [], seen = new Set<string>();
      let expanded = 0, count = 0, ended = false;
      const fail = (error: Error) => { if (!ended) { ended = true; zip.close(); reject(error); } };
      zip.on('error', fail);
      zip.on('end', () => { if (!ended) { ended = true; resolve(files); } });
      zip.on('entry', async (entry: yauzl.Entry) => {
        try {
          const name = safeZipPath(entry.fileName);
          const kind = (entry.externalFileAttributes >>> 16) & 0xf000;
          if (kind && kind !== 0x8000 && kind !== 0x4000) throw new HttpError(400, 'ZIP không được chứa symlink hoặc file đặc biệt.');
          if ((entry.generalPurposeBitFlag & 1) || ++count > 1000) throw new HttpError(400, 'ZIP mã hóa hoặc quá 1000 mục không được hỗ trợ.');
          const folded = name.replace(/\/$/, '').toLowerCase();
          if (seen.has(folded)) throw new HttpError(400, 'ZIP chứa đường dẫn trùng nhau.');
          seen.add(folded);
          if (name.endsWith('/')) { zip.readEntry(); return; }
          expanded += entry.uncompressedSize;
          if (expanded > EXPANDED_LIMIT || entry.uncompressedSize > Math.max(1024 * 1024, entry.compressedSize * 100)) throw new HttpError(413, 'ZIP vượt giới hạn giải nén 50 MiB hoặc tỷ lệ nén cho phép.');
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream) return fail(new HttpError(400, 'Không đọc được ZIP.'));
            const chunks: Buffer[] = []; let size = 0;
            stream.on('error', fail);
            stream.on('data', (chunk: Buffer) => {
              size += chunk.length;
              if (size > entry.uncompressedSize || size > EXPANDED_LIMIT) { stream.destroy(); fail(new HttpError(413, 'ZIP vượt giới hạn giải nén.')); }
              else chunks.push(chunk);
            });
            stream.on('end', () => { if (!ended) { files.push({ path: name, data: Buffer.concat(chunks) }); zip.readEntry(); } });
          });
        } catch (error) { fail(error as Error); }
      });
      zip.readEntry();
    });
  });
}

export function selectBundle(files: SourceFile[], language: string, requested?: string | null): SourceBundle {
  const extension = ({ PYTHON: '.py', CSHARP: '.cs', JAVA: '.java' } as Record<string, string>)[language];
  if (!extension) throw new HttpError(400, 'Sandbox hỗ trợ PYTHON, CSHARP và JAVA.');
  const sources = files.filter(f => f.path.endsWith(extension) && !f.path.split('/').some(p => ['bin', 'obj', '.git', '__MACOSX'].includes(p)));
  if (!sources.length) throw new HttpError(400, `ZIP cần có file ${extension}.`);
  if (sources.length > 200) throw new HttpError(413, 'Tối đa 200 file mã nguồn.');
  let entrypoint = '';
  if (language === 'PYTHON') {
    const mains = sources.filter(f => path.posix.basename(f.path) === 'main.py');
    entrypoint = requested || (mains.length === 1 ? mains[0].path : sources.length === 1 ? sources[0].path : '');
    if (!sources.some(f => f.path === entrypoint)) throw new HttpError(400, 'Chọn đường dẫn file Python chạy chính trong ZIP (ví dụ main.py).');
    safeZipPath(entrypoint);
  } else if (language === 'JAVA') {
    entrypoint = requested || 'Main';
    if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(entrypoint) || entrypoint.length > 200) throw new HttpError(400, 'Java entrypoint phải là tên lớp đầy đủ, ví dụ Main hoặc school.Main.');
  } else {
    if (requested) throw new HttpError(400, 'C# dùng Main hoặc top-level statements; để trống entrypoint.');
    entrypoint = 'Submission.dll';
  }
  // Only source files enter compiler/parser containers. Submitted project/build scripts are ignored.
  return { files: sources.sort((a, b) => a.path.localeCompare(b.path)), language, entrypoint };
}
export async function persistArchive(bytes: Buffer): Promise<{ key: string; hash: string }> {
  const key = crypto.randomUUID() + '.zip';
  await fs.mkdir(path.join(storageRoot(), 'archives'), { recursive: true });
  await fs.writeFile(archivePath(key), bytes, { flag: 'wx' });
  return { key, hash: sha256(bytes) };
}
export async function loadBundle(key: string, expectedHash: string, language: string, entrypoint?: string | null) {
  const bytes = await fs.readFile(archivePath(key));
  if (sha256(bytes) !== expectedHash) throw new Error('SHA-256 mismatch: archive integrity verification failed.');
  return selectBundle(await readZip(bytes), language, language === 'CSHARP' ? undefined : entrypoint);
}
export async function writeSandboxLog(id: string, event: object) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid submission ID.');
  await fs.mkdir(path.join(storageRoot(), 'logs'), { recursive: true });
  await fs.appendFile(path.join(storageRoot(), 'logs', id + '.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
}
