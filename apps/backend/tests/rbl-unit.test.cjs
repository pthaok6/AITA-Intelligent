const { test } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { readZip, safeZipPath, selectBundle, sha256 } = require('../dist/infrastructure/storage/submission-archive');
const { winnow, rightmostMinima, similarity } = require('../dist/modules/rbl/winnowing');
const tokens = values => values.map((value, i) => ({ value, line: i + 1, endLine: i + 1 }));

test('Winnowing selects rightmost minimum on ties', () => {
  assert.deepEqual(rightmostMinima([4n, 2n, 2n, 5n, 1n, 1n], 3), [2, 4, 5]);
  assert.deepEqual(rightmostMinima([3n, 1n, 1n], 5), [2]);
  assert.deepEqual(rightmostMinima([], 4), []);
});
test('deterministic fingerprints retain line and token spans within PostgreSQL BIGINT', () => {
  const source = tokens(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const fps = winnow(source, 3, 2);
  assert.deepEqual(fps, winnow(source, 3, 2)); assert.ok(fps.length);
  for (const fp of fps) { assert.ok(fp.hashValue >= 0n && fp.hashValue <= 9223372036854775807n); assert.equal(fp.tokenEnd, fp.tokenStart + 2); assert.equal(fp.lineStart, fp.tokenStart + 1); assert.equal(fp.lineEnd, fp.tokenEnd + 1); }
  assert.deepEqual(winnow(tokens(['A']), 5, 4), []);
  assert.equal(winnow(source.slice(0, 3), 3, 4).length, 1);
});
test('length-delimited k-grams prevent ambiguous token concatenation', () => {
  assert.notEqual(winnow(tokens(['ab', 'c']), 2, 1)[0].hashValue, winnow(tokens(['a', 'bc']), 2, 1)[0].hashValue);
});
test('similarity uses distinct containment and handles empty sets', () => {
  assert.deepEqual(similarity([1n, 1n, 2n], [1n, 2n, 3n]), { score: 100, matched: 2 });
  assert.deepEqual(similarity([], []), { score: 0, matched: 0 });
  assert.deepEqual(similarity([1n, 2n], [1n, 3n]), { score: 50, matched: 1 });
});
test('ZIP paths reject traversal, absolute, Windows drive and backslash paths', () => {
  for (const value of ['../evil.py', 'src/../../evil.py', '/main.py', 'C:/main.py', 'src\\main.py', 'src/./main.py', 'src//main.py', 'src//']) assert.throws(() => safeZipPath(value));
  assert.equal(safeZipPath('src/main.py'), 'src/main.py');
});
test('ZIP source extraction and entrypoint selection', async () => {
  const zip = new JSZip(); zip.file('src/main.py', 'print(3)\n'); zip.file('src/helper.py', 'value = 3\n'); zip.file('README.md', 'docs');
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const source = selectBundle(await readZip(bytes), 'PYTHON');
  assert.equal(source.entrypoint, 'src/main.py'); assert.equal(source.files.length, 2); assert.equal(sha256(bytes).length, 64);
  assert.throws(() => selectBundle(source.files, 'PYTHON', '../evil.py'));
  assert.throws(() => selectBundle(source.files, 'CPP'));
});
test('rejects ZIP symlinks, case collisions and decompression bombs', async () => {
  const symlink = new JSZip(); symlink.file('main.py', '/etc/passwd', { unixPermissions: 0o120777 });
  await assert.rejects(readZip(await symlink.generateAsync({ type: 'nodebuffer', platform: 'UNIX' })));
  const duplicate = new JSZip(); duplicate.file('main.py', 'a'); duplicate.file('MAIN.py', 'b');
  await assert.rejects(readZip(await duplicate.generateAsync({ type: 'nodebuffer' })));
  const bomb = new JSZip(); bomb.file('main.py', 'x'.repeat(2 * 1024 * 1024));
  await assert.rejects(readZip(await bomb.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })), { status: 413 });
  await assert.rejects(readZip(Buffer.from('not a zip')), { status: 400 });
});
