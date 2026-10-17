"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rblService = exports.RblService = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
const docker_sandbox_service_1 = require("../../infrastructure/sandbox/docker-sandbox.service");
const submission_archive_1 = require("../../infrastructure/storage/submission-archive");
const winnowing_1 = require("./winnowing");
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
async function parseAstWithLocalPython(bundle) {
    const tmpDir = await promises_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), 'aita-ast-'));
    try {
        for (const file of bundle.files) {
            const fullPath = path_1.default.join(tmpDir, file.path);
            await promises_1.default.mkdir(path_1.default.dirname(fullPath), { recursive: true });
            await promises_1.default.writeFile(fullPath, file.data);
        }
        return new Promise((resolve, reject) => {
            const script = `
import ast, json, pathlib
root = pathlib.Path(${JSON.stringify(tmpDir)})
results = []
for source in sorted(root.rglob('*.py')):
    try:
        tree = ast.parse(source.read_text(encoding='utf-8-sig'), filename=source.relative_to(root).as_posix())
    except Exception:
        continue
    tokens = []
    def emit(value, node):
        tokens.append({'value': value, 'line': max(1, getattr(node, 'lineno', 1)),
                       'endLine': max(1, getattr(node, 'end_lineno', None) or getattr(node, 'lineno', 1))})
    def visit(node):
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            return
        emit(type(node).__name__ + '{', node)
        if isinstance(node, ast.Constant):
            emit('CONST:' + type(node.value).__name__ + ':' + repr(node.value)[:128], node)
        for field, value in ast.iter_fields(node):
            if isinstance(value, ast.AST):
                visit(value)
            elif isinstance(value, list):
                for child in value:
                    if isinstance(child, ast.AST):
                        visit(child)
            elif field in ('id', 'arg', 'name', 'attr', 'asname') and value is not None:
                emit('ID', node)
        emit('}', node)
    visit(tree)
    results.append({'path': source.relative_to(root).as_posix(), 'tokens': tokens})
print(json.dumps({'files': results}))
`;
            const proc = (0, child_process_1.spawn)('python3', ['-c', script]);
            let stdout = '', stderr = '';
            proc.stdout.on('data', d => stdout += d.toString());
            proc.stderr.on('data', d => stderr += d.toString());
            proc.on('close', code => {
                if (code !== 0)
                    return reject(new Error('Local Python AST parser failed: ' + stderr));
                try {
                    const parsed = JSON.parse(stdout);
                    resolve(parsed.files);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    finally {
        await promises_1.default.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
class RblService {
    sandbox;
    constructor(sandbox = docker_sandbox_service_1.dockerSandbox) {
        this.sandbox = sandbox;
    }
    async parseBundleAst(bundle) {
        try {
            return await this.sandbox.parseAst(bundle);
        }
        catch (sandboxError) {
            if (bundle.language === 'PYTHON') {
                return await parseAstWithLocalPython(bundle);
            }
            throw sandboxError;
        }
    }
    async analyze(submissionId) {
        const submission = await prisma_1.prisma.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { exam: true } });
        if (submission.astStatus === 'COMPLETED' || submission.artifactType !== 'ZIP')
            return;
        const { k, w } = (0, winnowing_1.settings)();
        await prisma_1.prisma.submission.update({ where: { id: submissionId }, data: { astStatus: 'RUNNING', astMessage: null } });
        try {
            const bundle = await (0, submission_archive_1.loadBundle)(submission.sourceCodeUrl, submission.fileHashSha256, submission.exam.allowedLanguage, submission.entrypoint);
            const parsed = await this.parseBundleAst(bundle);
            const fingerprints = parsed.flatMap(file => (0, winnowing_1.winnow)(file.tokens, k, w).map(fp => ({ ...fp, submissionId, sourcePath: file.path })));
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.aSTFingerprint.deleteMany({ where: { submissionId } });
                for (let i = 0; i < fingerprints.length; i += 500)
                    await tx.aSTFingerprint.createMany({ data: fingerprints.slice(i, i + 500) });
                await tx.submission.update({ where: { id: submissionId }, data: { astStatus: 'COMPLETED', astVersion: winnowing_1.AST_VERSION, astK: k, astW: w, astCompletedAt: new Date(), astMessage: fingerprints.length ? null : 'Mã nguồn quá ngắn để tạo k-gram.' } });
            }, { timeout: 30000 });
            await this.compare(submissionId);
            await (0, submission_archive_1.writeSandboxLog)(submissionId, { stage: 'ast', version: winnowing_1.AST_VERSION, k, w, files: parsed.length, fingerprints: fingerprints.length });
        }
        catch (error) {
            await prisma_1.prisma.submission.update({ where: { id: submissionId }, data: { astStatus: 'ERROR', astMessage: error.message.slice(0, 4000) } });
            throw error;
        }
    }
    async compare(submissionId) {
        const source = await prisma_1.prisma.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { exam: true, fingerprints: { select: { hashValue: true } } } });
        const attempts = await prisma_1.prisma.submission.findMany({ where: { examId: source.examId }, select: { id: true, studentId: true, attemptNumber: true }, orderBy: { attemptNumber: 'desc' } });
        const latestByStudent = new Map();
        for (const attempt of attempts)
            if (!latestByStudent.has(attempt.studentId))
                latestByStudent.set(attempt.studentId, attempt);
        const latestSource = latestByStudent.get(source.studentId);
        if (latestSource?.id !== source.id)
            return;
        const otherIds = [...latestByStudent.values()].filter(attempt => attempt.studentId !== source.studentId).map(attempt => attempt.id);
        const others = await prisma_1.prisma.submission.findMany({ where: { id: { in: otherIds }, astStatus: 'COMPLETED', astVersion: source.astVersion, astK: source.astK, astW: source.astW }, include: { fingerprints: { select: { hashValue: true } } } });
        for (const other of others) {
            const result = (0, winnowing_1.similarity)(source.fingerprints.map(f => f.hashValue), other.fingerprints.map(f => f.hashValue));
            const [submissionAId, submissionBId] = [source.id, other.id].sort();
            const where = { examId_submissionAId_submissionBId: { examId: source.examId, submissionAId, submissionBId } };
            const current = await prisma_1.prisma.plagiarismReport.findUnique({ where });
            const status = current && ['CONFIRMED', 'DISMISSED'].includes(current.status) ? current.status : result.score >= 80 ? 'SUSPECTED' : result.score >= 50 ? 'MODERATE' : 'LOW';
            await prisma_1.prisma.plagiarismReport.upsert({ where, create: { examId: source.examId, submissionAId, submissionBId, similarityScore: result.score, matchedHashesCount: result.matched, status }, update: { similarityScore: result.score, matchedHashesCount: result.matched, status } });
        }
    }
    async comparePair(subAId, subBId, examId) {
        const [subA, subB] = await Promise.all([
            prisma_1.prisma.submission.findUnique({ where: { id: subAId }, include: { fingerprints: { select: { hashValue: true } } } }),
            prisma_1.prisma.submission.findUnique({ where: { id: subBId }, include: { fingerprints: { select: { hashValue: true } } } })
        ]);
        if (!subA || !subB || subA.astStatus !== 'COMPLETED' || subB.astStatus !== 'COMPLETED')
            return;
        const result = (0, winnowing_1.similarity)(subA.fingerprints.map(f => f.hashValue), subB.fingerprints.map(f => f.hashValue));
        const [submissionAId, submissionBId] = [subA.id, subB.id].sort();
        const where = { examId_submissionAId_submissionBId: { examId, submissionAId, submissionBId } };
        const current = await prisma_1.prisma.plagiarismReport.findUnique({ where });
        const status = current && ['CONFIRMED', 'DISMISSED'].includes(current.status) ? current.status : result.score >= 80 ? 'SUSPECTED' : result.score >= 50 ? 'MODERATE' : 'LOW';
        await prisma_1.prisma.plagiarismReport.upsert({
            where,
            create: { examId, submissionAId, submissionBId, similarityScore: result.score, matchedHashesCount: result.matched, status },
            update: { similarityScore: result.score, matchedHashesCount: result.matched, status }
        });
    }
    async scanExam(examId) {
        const submissions = await prisma_1.prisma.submission.findMany({
            where: { examId, artifactType: 'ZIP' },
            orderBy: { attemptNumber: 'desc' },
            select: { id: true, studentId: true, astStatus: true }
        });
        const latestByStudent = new Map();
        for (const s of submissions) {
            if (!latestByStudent.has(s.studentId))
                latestByStudent.set(s.studentId, s);
        }
        const latestList = [...latestByStudent.values()];
        let analyzedCount = 0;
        for (const sub of latestList) {
            if (sub.astStatus !== 'COMPLETED') {
                try {
                    await this.analyze(sub.id);
                    analyzedCount++;
                }
                catch (err) {
                    console.error(`AST analysis failed for submission ${sub.id}:`, err.message);
                }
            }
        }
        for (let i = 0; i < latestList.length; i++) {
            for (let j = i + 1; j < latestList.length; j++) {
                await this.comparePair(latestList[i].id, latestList[j].id, examId);
            }
        }
        const latestIds = latestList.map(submission => submission.id);
        const reports = await prisma_1.prisma.plagiarismReport.findMany({
            where: { examId, submissionAId: { in: latestIds }, submissionBId: { in: latestIds } },
        });
        return {
            totalSubmissions: latestList.length,
            analyzedCount,
            reportsCount: reports.length,
            suspectedCount: reports.filter(r => r.similarityScore >= 80).length,
            moderateCount: reports.filter(r => r.similarityScore >= 50 && r.similarityScore < 80).length
        };
    }
    async getReportDetails(reportId) {
        const report = await prisma_1.prisma.plagiarismReport.findUniqueOrThrow({
            where: { id: reportId },
            include: {
                exam: { select: { id: true, title: true, allowedLanguage: true } },
                submissionA: {
                    select: {
                        id: true,
                        studentId: true,
                        submittedAt: true,
                        totalScore: true,
                        status: true,
                        sourceCodeUrl: true,
                        fileHashSha256: true,
                        entrypoint: true,
                        student: { select: { id: true, fullName: true, email: true } },
                        fingerprints: true
                    }
                },
                submissionB: {
                    select: {
                        id: true,
                        studentId: true,
                        submittedAt: true,
                        totalScore: true,
                        status: true,
                        sourceCodeUrl: true,
                        fileHashSha256: true,
                        entrypoint: true,
                        student: { select: { id: true, fullName: true, email: true } },
                        fingerprints: true
                    }
                }
            }
        });
        let filesA = [];
        let filesB = [];
        try {
            const bundleA = await (0, submission_archive_1.loadBundle)(report.submissionA.sourceCodeUrl, report.submissionA.fileHashSha256, report.exam.allowedLanguage, report.submissionA.entrypoint);
            filesA = bundleA.files.map(f => ({ path: f.path, content: f.data.toString('utf-8') }));
        }
        catch (e) {
            console.error('Failed to load bundle A:', e.message);
        }
        try {
            const bundleB = await (0, submission_archive_1.loadBundle)(report.submissionB.sourceCodeUrl, report.submissionB.fileHashSha256, report.exam.allowedLanguage, report.submissionB.entrypoint);
            filesB = bundleB.files.map(f => ({ path: f.path, content: f.data.toString('utf-8') }));
        }
        catch (e) {
            console.error('Failed to load bundle B:', e.message);
        }
        const fpBByHash = new Map();
        for (const fp of report.submissionB.fingerprints) {
            const key = fp.hashValue.toString();
            const list = fpBByHash.get(key) || [];
            list.push(fp);
            fpBByHash.set(key, list);
        }
        const matches = [];
        const highlightedLinesA = {};
        const highlightedLinesB = {};
        for (const fpA of report.submissionA.fingerprints) {
            const matchingFpBs = fpBByHash.get(fpA.hashValue.toString());
            if (matchingFpBs && matchingFpBs.length > 0) {
                for (const fpB of matchingFpBs) {
                    matches.push({
                        hashValue: fpA.hashValue.toString(),
                        fileA: fpA.sourcePath,
                        linesA: [fpA.lineStart, fpA.lineEnd],
                        fileB: fpB.sourcePath,
                        linesB: [fpB.lineStart, fpB.lineEnd],
                    });
                    if (!highlightedLinesA[fpA.sourcePath])
                        highlightedLinesA[fpA.sourcePath] = [];
                    for (let l = fpA.lineStart; l <= fpA.lineEnd; l++) {
                        if (!highlightedLinesA[fpA.sourcePath].includes(l))
                            highlightedLinesA[fpA.sourcePath].push(l);
                    }
                    if (!highlightedLinesB[fpB.sourcePath])
                        highlightedLinesB[fpB.sourcePath] = [];
                    for (let l = fpB.lineStart; l <= fpB.lineEnd; l++) {
                        if (!highlightedLinesB[fpB.sourcePath].includes(l))
                            highlightedLinesB[fpB.sourcePath].push(l);
                    }
                }
            }
        }
        for (const key of Object.keys(highlightedLinesA))
            highlightedLinesA[key].sort((a, b) => a - b);
        for (const key of Object.keys(highlightedLinesB))
            highlightedLinesB[key].sort((a, b) => a - b);
        return {
            report: {
                id: report.id,
                examId: report.examId,
                similarityScore: report.similarityScore,
                matchedHashesCount: report.matchedHashesCount,
                status: report.status,
                lecturerNote: report.lecturerNote,
                createdAt: report.createdAt
            },
            exam: report.exam,
            submissionA: {
                id: report.submissionA.id,
                student: report.submissionA.student,
                submittedAt: report.submissionA.submittedAt,
                totalScore: report.submissionA.totalScore,
                files: filesA,
                highlightedLines: highlightedLinesA
            },
            submissionB: {
                id: report.submissionB.id,
                student: report.submissionB.student,
                submittedAt: report.submissionB.submittedAt,
                totalScore: report.submissionB.totalScore,
                files: filesB,
                highlightedLines: highlightedLinesB
            },
            matchesCount: matches.length,
            matches: matches.slice(0, 500)
        };
    }
    async updateReportStatus(reportId, status, lecturerNote) {
        if (!['SUSPECTED', 'CONFIRMED', 'DISMISSED'].includes(status)) {
            throw new Error('Trạng thái không hợp lệ (SUSPECTED, CONFIRMED, DISMISSED).');
        }
        return prisma_1.prisma.plagiarismReport.update({
            where: { id: reportId },
            data: {
                status,
                lecturerNote: lecturerNote !== undefined ? lecturerNote : undefined
            },
            include: {
                submissionA: { select: { id: true, student: { select: { fullName: true, email: true } } } },
                submissionB: { select: { id: true, student: { select: { fullName: true, email: true } } } }
            }
        });
    }
}
exports.RblService = RblService;
exports.rblService = new RblService();
