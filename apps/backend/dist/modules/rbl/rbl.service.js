"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rblService = exports.RblService = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
const docker_sandbox_service_1 = require("../../infrastructure/sandbox/docker-sandbox.service");
const submission_archive_1 = require("../../infrastructure/storage/submission-archive");
const winnowing_1 = require("./winnowing");
class RblService {
    sandbox;
    constructor(sandbox = docker_sandbox_service_1.dockerSandbox) {
        this.sandbox = sandbox;
    }
    async analyze(submissionId) {
        const submission = await prisma_1.prisma.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { exam: true } });
        if (submission.astStatus === 'COMPLETED' || submission.artifactType !== 'ZIP')
            return;
        const { k, w } = (0, winnowing_1.settings)();
        await prisma_1.prisma.submission.update({ where: { id: submissionId }, data: { astStatus: 'RUNNING', astMessage: null } });
        try {
            const bundle = await (0, submission_archive_1.loadBundle)(submission.sourceCodeUrl, submission.fileHashSha256, submission.exam.allowedLanguage, submission.entrypoint);
            const parsed = await this.sandbox.parseAst(bundle);
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
}
exports.RblService = RblService;
exports.rblService = new RblService();
