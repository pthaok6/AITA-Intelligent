import Docker from 'dockerode';
import crypto from 'crypto';
import tar from 'tar-stream';
import { Writable, Readable } from 'stream';
import { SourceBundle, SourceFile } from '../storage/submission-archive';
import { AstToken } from '../../modules/rbl/winnowing';

export interface ProcessResult { stdout: string; stderr: string; exitCode: number; timedOut: boolean; oom: boolean; outputTruncated: boolean; executionTimeMs: number; memoryUsedKb: number }
export interface PreparedSubmission { bundle: SourceBundle; compiled: SourceFile[]; compile: ProcessResult }
const imageFor = (language: string) => {
  const value = ({ PYTHON: process.env.SANDBOX_PYTHON_IMAGE || 'aita-runner-python:1', JAVA: process.env.SANDBOX_JAVA_IMAGE || 'aita-runner-java:1', CSHARP: process.env.SANDBOX_CSHARP_IMAGE || 'aita-runner-csharp:1' } as Record<string, string>)[language];
  if (!value) throw new Error('Unsupported sandbox language.');
  return value;
};
async function bufferStream(stream: AsyncIterable<unknown> & { destroy(error?: Error): unknown }, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const value of stream) { if (!Buffer.isBuffer(value)) throw new Error('Invalid archive stream chunk.'); const chunk = value; size += chunk.length; if (size > limit) { stream.destroy(); throw new Error('Docker archive exceeds size limit.'); } chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function packFiles(files: SourceFile[]) {
  const pack = tar.pack();
  const result = bufferStream(pack, 55 * 1024 * 1024);
  for (const file of files) await new Promise<void>((resolve, reject) => pack.entry({ name: file.path, size: file.data.length, mode: 0o644, uid: 1000, gid: 1000, type: 'file' }, file.data, error => error ? reject(error) : resolve()));
  pack.finalize(); return result;
}
async function unpackOutput(stream: Readable): Promise<SourceFile[]> {
  const bytes = await bufferStream(stream, 55 * 1024 * 1024), extractor = tar.extract(), files: SourceFile[] = [];
  let total = 0;
  const result = new Promise<SourceFile[]>((resolve, reject) => {
    extractor.on('error', reject);
    extractor.on('finish', () => resolve(files));
    extractor.on('entry', (header, stream, next) => {
      void (async () => {
        if (header.type === 'directory') { stream.resume(); stream.on('end', next); return; }
        if (header.type !== 'file' || !/^out\//.test(header.name) || header.name.includes('..') || header.name.includes('\\')) throw new Error('Unsafe compiled artifact.');
        total += header.size || 0;
        if (total > 50 * 1024 * 1024 || files.length >= 1000) throw new Error('Compiled artifacts exceed limit.');
        files.push({ path: header.name, data: await bufferStream(stream, 50 * 1024 * 1024) }); next();
      })().catch(error => extractor.destroy(error));
    });
  });
  extractor.end(bytes); return result;
}

export class DockerSandboxService {
  readonly docker: Docker;
  readonly owner = crypto.randomUUID();
  constructor() {
    this.docker = new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH || (process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'), version: 'v1.47', timeout: 120000 });
  }
  private async container(language: string, memoryMb: number) {
    if (!Number.isInteger(memoryMb) || memoryMb < 64 || memoryMb > 512) throw new Error('Memory limit must be 64..512 MiB.');
    return this.docker.createContainer({ Image: imageFor(language), Cmd: ['sleep', 'infinity'], User: '1000:1000', WorkingDir: '/work', NetworkDisabled: true,
      AttachStdout: true, AttachStderr: true, Tty: false, Labels: { 'aita.sandbox': 'true', 'aita.owner': this.owner },
      Env: ['HOME=/tmp', 'DOTNET_CLI_HOME=/tmp', 'DOTNET_CLI_TELEMETRY_OPTOUT=1', 'DOTNET_NOLOGO=1', 'DOTNET_EnableDiagnostics=0', 'PYTHONDONTWRITEBYTECODE=1', 'PYTHONUNBUFFERED=1'],
      HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'], Init: true,
        Memory: memoryMb * 1024 * 1024, MemorySwap: memoryMb * 1024 * 1024, NanoCpus: 1000000000, PidsLimit: 128,
        Ulimits: [{ Name: 'nofile', Soft: 1024, Hard: 1024 }, { Name: 'core', Soft: 0, Hard: 0 }],
        Tmpfs: { '/work': 'rw,noexec,nosuid,size=128m,uid=1000,gid=1000,mode=0700', '/tmp': 'rw,noexec,nosuid,size=64m,uid=1000,gid=1000,mode=0700' },
        LogConfig: { Type: 'none', Config: {} } } });
  }
  private async process(container: Docker.Container, command: string[], files: SourceFile[], timeoutMs: number, limit = 65536): Promise<ProcessResult> {
    await container.start();
    // Rootfs stays read-only. Trusted tar receives source bytes through Docker Exec stdin.
    const upload = await container.exec({ Cmd: ['tar', '-xmf', '-', '-C', '/work', '--no-same-owner'], AttachStdin: true, AttachStdout: true, AttachStderr: true, User: '1000:1000' });
    const uploadStream = await upload.start({ hijack: true, stdin: true });
    const uploaded = new Promise<void>((resolve, reject) => { uploadStream.once('end', resolve); uploadStream.once('error', reject); });
    uploadStream.resume(); uploadStream.end(await packFiles(files)); await uploaded;
    let uploadState = await upload.inspect();
    for (let i = 0; uploadState.Running && i < 100; i++) { await new Promise(resolve => setTimeout(resolve, 20)); uploadState = await upload.inspect(); }
    if (uploadState.ExitCode !== 0) throw new Error('Cannot transfer source files into Docker tmpfs.');
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), outputTruncated = false, timedOut = false, peak = 0;
    const kill = () => { void container.kill().catch(() => undefined); };
    const sink = (which: 'stdout' | 'stderr') => new Writable({ write(chunk: Buffer, _encoding, callback) {
      const old = which === 'stdout' ? stdout : stderr, remaining = Math.max(0, limit - old.length);
      const next = Buffer.concat([old, chunk.subarray(0, remaining)]);
      if (which === 'stdout') stdout = next; else stderr = next;
      if (chunk.length > remaining && !outputTruncated) { outputTruncated = true; kill(); }
      callback();
    } });
    const execution = await container.exec({ Cmd: command, AttachStdout: true, AttachStderr: true, User: '1000:1000' });
    let timer: NodeJS.Timeout | undefined, sampler: NodeJS.Timeout | undefined, sampling = false;
    const began = Date.now();
    const attached = await execution.start({ hijack: true, stdin: false }) as unknown as Readable;
    const streamDone = new Promise<void>(resolve => { attached.once('end', resolve); attached.once('close', resolve); attached.once('error', resolve); });
    this.docker.modem.demuxStream(attached, sink('stdout'), sink('stderr'));
    try {
      timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
      sampler = setInterval(() => { if (!sampling) { sampling = true; void container.stats({ stream: false }).then(stats => { peak = Math.max(peak, stats.memory_stats?.usage || 0, stats.memory_stats?.max_usage || 0); }).catch(() => undefined).finally(() => { sampling = false; }); } }, 100);
      let result = await execution.inspect();
      while (result.Running) {
        await new Promise(resolve => setTimeout(resolve, 20)); result = await execution.inspect();
      }
      const executionTimeMs = Date.now() - began;
      clearTimeout(timer); clearInterval(sampler);
      const state = await container.inspect();
      let oom = state.State.OOMKilled;
      if (state.State.Running && !timedOut && !outputTruncated) {
        // cgroup v2 counters are kernel-controlled; student code cannot alter them.
        const metrics = await container.exec({ Cmd: ['/bin/sh', '-c', 'cat /sys/fs/cgroup/memory.peak 2>/dev/null; cat /sys/fs/cgroup/memory.events 2>/dev/null'], AttachStdout: true, AttachStderr: true });
        const stream = await metrics.start({ hijack: true, stdin: false });
        let text = '';
        this.docker.modem.demuxStream(stream, new Writable({ write(chunk, _enc, done) { text += chunk.toString(); done(); } }), new Writable({ write(_chunk, _enc, done) { done(); } }));
        await new Promise<void>(resolve => { stream.once('end', resolve); stream.once('error', resolve); });
        peak = Math.max(peak, Number(text.split('\n')[0]) || 0);
        oom = oom || /oom_kill\s+[1-9]\d*/.test(text);
      }
      let drainTimer: NodeJS.Timeout | undefined;
      await Promise.race([streamDone, new Promise<void>(resolve => { drainTimer = setTimeout(resolve, 500); })]);
      if (drainTimer) clearTimeout(drainTimer);
      return { stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), exitCode: result.ExitCode ?? 137, timedOut, oom, outputTruncated, executionTimeMs, memoryUsedKb: Math.ceil(peak / 1024) };
    } finally { if (timer) clearTimeout(timer); if (sampler) clearInterval(sampler); attached.destroy(); }
  }

  private async compiledFiles(container: Docker.Container): Promise<SourceFile[]> {
    const download = await container.exec({ Cmd: ['tar', '-cf', '-', '-C', '/work', 'out'], AttachStdout: true, AttachStderr: true });
    const stream = await download.start({ hijack: true, stdin: false });
    const chunks: Buffer[] = []; let size = 0, errorText = '';
    const bytes = new Promise<Buffer>((resolve, reject) => {
      stream.once('end', () => resolve(Buffer.concat(chunks)));
      stream.once('error', reject);
      this.docker.modem.demuxStream(stream, new Writable({ write(chunk, _enc, done) {
        size += chunk.length;
        if (size > 55 * 1024 * 1024) { reject(new Error('Compiled artifacts exceed size limit.')); stream.destroy(); }
        else chunks.push(chunk);
        done();
      } }), new Writable({ write(chunk, _enc, done) { errorText += chunk.toString().slice(0, 2000 - errorText.length); done(); } }));
    });
    const result = await bytes;
    let state = await download.inspect();
    for (let i = 0; state.Running && i < 100; i++) { await new Promise(resolve => setTimeout(resolve, 20)); state = await download.inspect(); }
    if (state.ExitCode !== 0) throw new Error('Cannot collect compiled artifacts: ' + errorText);
    return unpackOutput(Readable.from(result));
  }
  async compile(bundle: SourceBundle): Promise<PreparedSubmission> {
    const container = await this.container(bundle.language, 512);
    try {
      const compile = await this.process(container, ['python3', '/opt/aita/compile.py', bundle.language], bundle.files.map(f => ({ ...f, path: 'src/' + f.path })), 60000);
      const compiled = bundle.language !== 'PYTHON' && compile.exitCode === 0 && !compile.timedOut && !compile.outputTruncated && !compile.oom ? await this.compiledFiles(container) : [];
      return { bundle, compiled, compile };
    } finally { await container.remove({ force: true }).catch(() => undefined); }
  }
  async executePrepared(prepared: PreparedSubmission, input: string, expected: string, timeLimitMs: number, memoryLimitMb: number) {
    if (!Number.isInteger(timeLimitMs) || timeLimitMs < 1 || timeLimitMs > 10000) throw new Error('Time limit must be 1..10000 ms.');
    const { bundle, compiled } = prepared;
    const run = bundle.language === 'PYTHON' ? ['python3', '/work/src/' + bundle.entrypoint] : bundle.language === 'CSHARP' ? ['dotnet', '/work/out/Submission.dll'] : ['java', '-Xms16m', `-Xmx${Math.max(16, Math.floor(memoryLimitMb * .5))}m`, '-XX:ActiveProcessorCount=1', '-cp', '/work/out', bundle.entrypoint];
    const container = await this.container(bundle.language, memoryLimitMb);
    try {
      const result = await this.process(container, ['/bin/sh', '-c', 'exec "$@" < /work/stdin.txt', 'aita', ...run], [...(bundle.language === 'PYTHON' ? bundle.files.map(f => ({ ...f, path: 'src/' + f.path })) : compiled), { path: 'stdin.txt', data: Buffer.from(input) }], timeLimitMs);
      const normalize = (text: string) => text.replace(/\r\n/g, '\n').trimEnd();
      const status = result.oom ? 'MEMORY_LIMIT_EXCEEDED' : result.timedOut ? 'TIME_LIMIT_EXCEEDED' : result.outputTruncated ? 'OUTPUT_LIMIT_EXCEEDED' : result.exitCode !== 0 ? 'RUNTIME_ERROR' : normalize(result.stdout) === normalize(expected) ? 'ACCEPTED' : 'WRONG_ANSWER';
      return { ...result, status, actualOutput: result.stdout };
    } finally { await container.remove({ force: true }).catch(() => undefined); }
  }
  async parseAst(bundle: SourceBundle): Promise<{ path: string; tokens: AstToken[] }[]> {
    const command = bundle.language === 'PYTHON' ? ['python3', '/opt/aita/python_ast.py'] : bundle.language === 'CSHARP' ? ['dotnet', '/opt/aita/roslyn/Parser.dll'] : ['java', '-Xmx256m', '-cp', '/opt/aita/java', 'JavaAstParser'];
    const container = await this.container(bundle.language, 512);
    try {
      const result = await this.process(container, [...command, '/work/src'], bundle.files.map(f => ({ ...f, path: 'src/' + f.path })), 30000, 16 * 1024 * 1024);
      if (result.exitCode || result.timedOut || result.oom || result.outputTruncated) throw new Error('AST parser failed: ' + (result.stderr.slice(0, 4000) || 'timeout / memory / output limit'));
      const parsed = JSON.parse(result.stdout);
      if (!Array.isArray(parsed.files) || parsed.files.length > 200) throw new Error('Invalid AST response.');
      let count = 0;
      for (const file of parsed.files) {
        if (!bundle.files.some(f => f.path === file.path) || !Array.isArray(file.tokens)) throw new Error('Invalid AST source path.');
        count += file.tokens.length;
        if (count > 50000) throw new Error('AST exceeds 50000 token limit.');
        for (const token of file.tokens) if (typeof token.value !== 'string' || token.value.length > 512 || !Number.isInteger(token.line) || !Number.isInteger(token.endLine) || token.line < 1 || token.endLine < token.line) throw new Error('Invalid AST token.');
      }
      return parsed.files;
    } finally { await container.remove({ force: true }).catch(() => undefined); }
  }
}
export const dockerSandbox = new DockerSandboxService();
