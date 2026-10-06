const { test } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const { DockerSandboxService } = require('../dist/infrastructure/sandbox/docker-sandbox.service');
const { winnow, similarity } = require('../dist/modules/rbl/winnowing');
const sandbox = new DockerSandboxService();
const bundle = (language, filename, code, entrypoint) => ({ language, files: [{ path: filename, data: Buffer.from(code) }], entrypoint });

test('real Docker compiler, runtime and AST for all supported languages', { timeout: 240000 }, async t => {
  const samples = [
    ['PYTHON', 'main.py', 'a, b = map(int, input().split())\nprint(a + b)\n', 'x, y = map(int, input().split())\n# comment\nprint(x + y)\n', 'main.py'],
    ['CSHARP', 'Program.cs', 'var a = Console.ReadLine()!.Split(); Console.WriteLine(int.Parse(a[0]) + int.Parse(a[1]));', 'var renamed = Console.ReadLine()!.Split(); /* comment */ Console.WriteLine(int.Parse(renamed[0]) + int.Parse(renamed[1]));', 'Submission.dll'],
    ['JAVA', 'Main.java', 'import java.util.Scanner; public class Main { public static void main(String[] args) { Scanner s = new Scanner(System.in); int a = s.nextInt(), b = s.nextInt(); System.out.println(a+b); } }', 'import java.util.Scanner; public class Main { public static void main(String[] x) { Scanner other = new Scanner(System.in); int first = other.nextInt(), second = other.nextInt(); /* comment */ System.out.println(first+second); } }', 'Main'],
  ];
  for (const [language, filename, code, renamed, entrypoint] of samples) await t.test(language + ' compiles, executes input and fingerprints renamed code', async () => {
    const source = bundle(language, filename, code, entrypoint);
    const prepared = await sandbox.compile(source);
    assert.equal(prepared.compile.exitCode, 0, JSON.stringify(prepared.compile));
    const ac = await sandbox.executePrepared(prepared, '2 3\n', '5\n', 5000, 512);
    assert.equal(ac.status, 'ACCEPTED', JSON.stringify(ac));
    const wa = await sandbox.executePrepared(prepared, '4 3\n', '5\n', 5000, 512);
    assert.equal(wa.status, 'WRONG_ANSWER', JSON.stringify(wa));
    const ast = await sandbox.parseAst(source), other = await sandbox.parseAst(bundle(language, filename, renamed, entrypoint));
    const left = winnow(ast[0].tokens), right = winnow(other[0].tokens);
    assert.ok(left.length > 0); assert.equal(similarity(left.map(f => f.hashValue), right.map(f => f.hashValue)).score, 100);
  });
  await t.test('syntax error is a real compiler failure', async () => {
    const result = await sandbox.compile(bundle('PYTHON', 'main.py', 'def broken(:\n', 'main.py'));
    assert.notEqual(result.compile.exitCode, 0); assert.match(result.compile.stderr, /SyntaxError/);
  });
  await t.test('timeout terminates an infinite loop', async () => {
    const prepared = await sandbox.compile(bundle('PYTHON', 'main.py', 'while True: pass\n', 'main.py'));
    assert.equal((await sandbox.executePrepared(prepared, '', '', 300, 128)).status, 'TIME_LIMIT_EXCEEDED');
  });
  await t.test('stdout/stderr are separate and exit code is retained', async () => {
    const prepared = await sandbox.compile(bundle('PYTHON', 'main.py', 'import sys\nprint("hello")\nprint("diagnostic", file=sys.stderr)\nsys.exit(7)\n', 'main.py'));
    const result = await sandbox.executePrepared(prepared, '', '', 2000, 128);
    assert.equal(result.status, 'RUNTIME_ERROR'); assert.equal(result.exitCode, 7); assert.equal(result.stdout, 'hello\n'); assert.equal(result.stderr, 'diagnostic\n');
  });
  await t.test('excessive output is bounded', async () => {
    const prepared = await sandbox.compile(bundle('PYTHON', 'main.py', 'while True: print("x" * 1000)\n', 'main.py'));
    const result = await sandbox.executePrepared(prepared, '', '', 5000, 128);
    assert.equal(result.status, 'OUTPUT_LIMIT_EXCEEDED'); assert.ok(Buffer.byteLength(result.stdout) <= 65536); assert.ok(result.outputTruncated);
  });
  await t.test('memory exhaustion is detected by Docker', async () => {
    const prepared = await sandbox.compile(bundle('PYTHON', 'main.py', 'data = bytearray(300 * 1024 * 1024)\n', 'main.py'));
    assert.equal((await sandbox.executePrepared(prepared, '', '', 5000, 64)).status, 'MEMORY_LIMIT_EXCEEDED');
  });
  await t.test('runner has non-root UID, no host socket, read-only root and no external network', async () => {
    const code = 'import os, socket\nassert os.getuid() == 1000\nassert not os.path.exists("/var/run/docker.sock")\ntry:\n open("/etc/aita-write", "w")\n raise AssertionError("root writable")\nexcept OSError: pass\ntry:\n socket.create_connection(("1.1.1.1", 80), timeout=.2)\n raise AssertionError("network enabled")\nexcept OSError: pass\nprint("isolated")\n';
    const prepared = await sandbox.compile(bundle('PYTHON', 'main.py', code, 'main.py'));
    const result = await sandbox.executePrepared(prepared, '', 'isolated\n', 3000, 128);
    assert.equal(result.status, 'ACCEPTED', JSON.stringify(result));
  });
  await t.test('every container is removed after execution', async () => {
    const leftover = await sandbox.docker.listContainers({ all: true, filters: JSON.stringify({ label: ['aita.sandbox=true', 'aita.owner=' + sandbox.owner] }) });
    assert.equal(leftover.length, 0);
  });
});
