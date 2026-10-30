import yauzl from 'yauzl';
import zlib from 'zlib';

export interface ExtractedDocument {
  filename: string;
  extension: string;
  text: string;
  wordCount: number;
  slideOrPageCount?: number;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extract text from .pptx presentations (slide by slide)
 */
async function parsePptx(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Không thể mở file PPTX.'));

      const slideEntries: Array<{ name: string; num: number; entry: yauzl.Entry }> = [];
      const slideTextMap = new Map<number, string>();

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const match = entry.fileName.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
        if (match) {
          slideEntries.push({ name: entry.fileName, num: parseInt(match[1], 10), entry });
        }
        zipfile.readEntry();
      });

      zipfile.on('end', async () => {
        try {
          slideEntries.sort((a, b) => a.num - b.num);
          const slidesContent: string[] = [];

          for (const item of slideEntries) {
            const xml = await readZipEntryText(buffer, item.entry);
            // Replace paragraph ends with newlines
            const formatted = xml.replace(/<\/a:p>/gi, '\n');
            const matches = formatted.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
            const slideText = matches
              .map(m => decodeXmlEntities(m.replace(/<\/?a:t[^>]*>/gi, '')))
              .join(' ')
              .replace(/\n\s*\n/g, '\n')
              .trim();

            if (slideText) {
              slidesContent.push(`[Slide ${item.num}]\n${slideText}`);
            }
          }

          const fullText = slidesContent.join('\n\n');
          const words = fullText.trim().split(/\s+/).filter(Boolean).length;
          resolve({
            filename,
            extension: 'pptx',
            text: fullText.slice(0, 50000),
            wordCount: words,
            slideOrPageCount: slideEntries.length,
          });
        } catch (readErr) {
          reject(readErr);
        }
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract text from .docx Word documents
 */
async function parseDocx(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Không thể mở file DOCX.'));

      let docEntry: yauzl.Entry | null = null;

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (/^word\/document\.xml$/i.test(entry.fileName)) {
          docEntry = entry;
        }
        zipfile.readEntry();
      });

      zipfile.on('end', async () => {
        try {
          if (!docEntry) {
            return resolve({
              filename,
              extension: 'docx',
              text: '',
              wordCount: 0,
            });
          }

          const xml = await readZipEntryText(buffer, docEntry);
          const formatted = xml
            .replace(/<\/w:p>/gi, '\n')
            .replace(/<\/w:tr>/gi, '\n')
            .replace(/<\/w:tc>/gi, '\t');

          const matches = formatted.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
          const text = matches
            .map(m => decodeXmlEntities(m.replace(/<\/?w:t[^>]*>/gi, '')))
            .join(' ')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();

          const words = text.trim().split(/\s+/).filter(Boolean).length;
          resolve({
            filename,
            extension: 'docx',
            text: text.slice(0, 50000),
            wordCount: words,
          });
        } catch (readErr) {
          reject(readErr);
        }
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Helper to read stream of an entry in zipfile
 */
function readZipEntryText(zipBuffer: Buffer, entry: yauzl.Entry): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Lỗi mở zip'));
      zipfile.openReadStream(entry, (streamErr, readStream) => {
        if (streamErr || !readStream) return reject(streamErr || new Error('Lỗi đọc stream'));
        const chunks: Buffer[] = [];
        readStream.on('data', chunk => chunks.push(chunk));
        readStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        readStream.on('error', reject);
      });
    });
  });
}

/**
 * Extract text from PDF files using streams and FlateDecode decompression
 */
function parsePdf(buffer: Buffer, filename: string): ExtractedDocument {
  const binary = buffer.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  const textParts: string[] = [];
  let pageCount = 0;

  // Count pages by /Type /Page
  const pageMatches = binary.match(/\/Type\s*\/Page\b/g);
  if (pageMatches) {
    pageCount = pageMatches.length;
  }

  while ((match = streamRegex.exec(binary)) !== null) {
    const rawStream = match[1];
    let decompressed: string | null = null;

    // Try inflate
    try {
      const streamBuf = Buffer.from(rawStream, 'binary');
      const unzipped = zlib.inflateSync(streamBuf);
      decompressed = unzipped.toString('latin1');
    } catch {
      try {
        const streamBuf = Buffer.from(rawStream, 'binary');
        const unzipped = zlib.unzipSync(streamBuf);
        decompressed = unzipped.toString('latin1');
      } catch {
        // Fallback: use raw stream if it contains readable text
        decompressed = rawStream;
      }
    }

    if (decompressed && /BT[\s\S]*?ET/.test(decompressed)) {
      // Extract text in BT ... ET blocks
      const btBlocks = decompressed.match(/BT[\s\S]*?ET/g) || [];
      for (const block of btBlocks) {
        // 1. Tj operators: (text) Tj
        const tjMatches = block.match(/\((.*?)\)\s*Tj/g) || [];
        for (const tj of tjMatches) {
          const inner = tj.replace(/^\(/, '').replace(/\)\s*Tj$/, '');
          const clean = unescapePdfString(inner);
          if (clean.trim()) textParts.push(clean);
        }

        // 2. TJ operators: [(part1) 12 (part2)] TJ
        const bigTjMatches = block.match(/\[([\s\S]*?)\]\s*TJ/g) || [];
        for (const bigTj of bigTjMatches) {
          const innerParts = bigTj.match(/\((.*?)\)/g) || [];
          const combined = innerParts.map(p => unescapePdfString(p.slice(1, -1))).join('');
          if (combined.trim()) textParts.push(combined);
        }
      }
    }
  }

  // Join text
  let fullText = textParts.join(' ').replace(/\s+/g, ' ').trim();

  // If streams extraction yielded nothing (e.g. non-standard font encoding), fallback to plain printable regex
  if (fullText.length < 50) {
    const plainMatches = binary.match(/\(([^()]{3,})\)/g) || [];
    const fallbackText = plainMatches
      .map(m => unescapePdfString(m.slice(1, -1)))
      .filter(s => /[a-zA-Z0-9À-ỹ]{2,}/.test(s))
      .join(' ')
      .trim();
    if (fallbackText.length > fullText.length) {
      fullText = fallbackText;
    }
  }

  const words = fullText.split(/\s+/).filter(Boolean).length;

  return {
    filename,
    extension: 'pdf',
    text: fullText.slice(0, 50000),
    wordCount: words,
    slideOrPageCount: pageCount || undefined,
  };
}

function unescapePdfString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Main parser entry point
 */
export async function extractDocumentContent(
  buffer: Buffer,
  filename: string
): Promise<ExtractedDocument> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
    const text = buffer.toString('utf-8');
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return {
      filename,
      extension: ext,
      text: text.slice(0, 50000),
      wordCount: words,
    };
  }

  if (ext === 'pptx') {
    return parsePptx(buffer, filename);
  }

  if (ext === 'docx') {
    return parseDocx(buffer, filename);
  }

  if (ext === 'pdf') {
    return parsePdf(buffer, filename);
  }

  throw new Error(`Định dạng tệp .${ext} chưa được hỗ trợ. Vui lòng chọn tệp .pdf, .pptx, .docx, .md hoặc .txt.`);
}

