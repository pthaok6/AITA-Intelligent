import { prisma } from '../../infrastructure/database/prisma';
import { dockerSandbox, DockerSandboxService } from '../../infrastructure/sandbox/docker-sandbox.service';
import { loadBundle, writeSandboxLog } from '../../infrastructure/storage/submission-archive';
import { AST_VERSION, settings, similarity, winnow } from './winnowing';

export class RblService {
  constructor(private sandbox: DockerSandboxService = dockerSandbox) {}
  async analyze(submissionId: string) {
    const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { exam: true } });
    if (submission.astStatus === 'COMPLETED' || submission.artifactType !== 'ZIP') return;
    const { k, w } = settings();
    await prisma.submission.update({ where: { id: submissionId }, data: { astStatus: 'RUNNING', astMessage: null } });
    try {
      const bundle = await loadBundle(submission.sourceCodeUrl, submission.fileHashSha256, submission.exam.allowedLanguage, submission.entrypoint);
      const parsed = await this.sandbox.parseAst(bundle);
      const fingerprints = parsed.flatMap(file => winnow(file.tokens, k, w).map(fp => ({ ...fp, submissionId, sourcePath: file.path })));
      await prisma.$transaction(async tx => {
        await tx.aSTFingerprint.deleteMany({ where: { submissionId } });
        for (let i = 0; i < fingerprints.length; i += 500) await tx.aSTFingerprint.createMany({ data: fingerprints.slice(i, i + 500) });
        await tx.submission.update({ where: { id: submissionId }, data: { astStatus: 'COMPLETED', astVersion: AST_VERSION, astK: k, astW: w, astCompletedAt: new Date(), astMessage: fingerprints.length ? null : 'Mã nguồn quá ngắn để tạo k-gram.' } });
      }, { timeout: 30000 });
      await this.compare(submissionId);
      await writeSandboxLog(submissionId, { stage: 'ast', version: AST_VERSION, k, w, files: parsed.length, fingerprints: fingerprints.length });
    } catch (error: any) {
      await prisma.submission.update({ where: { id: submissionId }, data: { astStatus: 'ERROR', astMessage: error.message.slice(0, 4000) } });
      throw error;
    }
  }
  async compare(submissionId: string) {
    const source = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { exam: true, fingerprints: { select: { hashValue: true } } } });
    const others = await prisma.submission.findMany({ where: { id: { not: submissionId }, examId: source.examId, astStatus: 'COMPLETED', astVersion: source.astVersion, astK: source.astK, astW: source.astW }, include: { fingerprints: { select: { hashValue: true } } } });
    for (const other of others) {
      const result = similarity(source.fingerprints.map(f => f.hashValue), other.fingerprints.map(f => f.hashValue));
      const [submissionAId, submissionBId] = [source.id, other.id].sort();
      const where = { examId_submissionAId_submissionBId: { examId: source.examId, submissionAId, submissionBId } };
      const current = await prisma.plagiarismReport.findUnique({ where });
      const status = current && ['CONFIRMED', 'DISMISSED'].includes(current.status) ? current.status : result.score >= 80 ? 'SUSPECTED' : result.score >= 50 ? 'MODERATE' : 'LOW';
      await prisma.plagiarismReport.upsert({ where, create: { examId: source.examId, submissionAId, submissionBId, similarityScore: result.score, matchedHashesCount: result.matched, status }, update: { similarityScore: result.score, matchedHashesCount: result.matched, status } });
    }
  }
}
export const rblService = new RblService();
