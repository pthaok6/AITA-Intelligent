const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// Test Winnowing & AST functions from built dist
const { winnow, rightmostMinima, similarity } = require('../dist/modules/rbl/winnowing');

test('AST & Plagiarism Unit Suite', async (t) => {
  await t.test('1. Rightmost Minima Algorithm handles sliding windows correctly', () => {
    const hashes = [77n, 74n, 42n, 17n, 98n, 50n, 17n, 98n, 8n, 88n, 67n, 39n, 77n];
    const width = 4;
    const minimaIndices = rightmostMinima(hashes, width);

    assert.ok(Array.isArray(minimaIndices));
    assert.ok(minimaIndices.length > 0);
    // Index 3 has 17n, index 6 has 17n, index 8 has 8n
    assert.ok(minimaIndices.includes(3) || minimaIndices.includes(6));
    assert.ok(minimaIndices.includes(8));
  });

  await t.test('2. Winnowing produces consistent fingerprints from token sequences', () => {
    const tokensA = [
      { value: 'FunctionDef{', line: 1, endLine: 1 },
      { value: 'ID', line: 1, endLine: 1 },
      { value: 'arguments{', line: 1, endLine: 1 },
      { value: 'ID', line: 1, endLine: 1 },
      { value: '}', line: 1, endLine: 1 },
      { value: 'Return{', line: 2, endLine: 2 },
      { value: 'BinOp{', line: 2, endLine: 2 },
      { value: 'ID', line: 2, endLine: 2 },
      { value: 'Add{', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 },
      { value: 'CONST:int:1', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 }
    ];

    const fpA = winnow(tokensA, 4, 3);
    assert.ok(fpA.length > 0);
    for (const fp of fpA) {
      assert.equal(typeof fp.hashValue, 'bigint');
      assert.ok(fp.lineStart >= 1);
      assert.ok(fp.lineEnd >= fp.lineStart);
      assert.ok(fp.tokenEnd >= fp.tokenStart);
    }

    // Identical AST tokens must produce identical fingerprints
    const fpA2 = winnow(tokensA, 4, 3);
    assert.deepEqual(
      fpA.map(f => f.hashValue.toString()),
      fpA2.map(f => f.hashValue.toString())
    );
  });

  await t.test('3. Similarity Calculation evaluates identity and partial overlap', () => {
    const setA = [100n, 200n, 300n, 400n, 500n];
    const setB = [100n, 200n, 300n, 400n, 500n]; // 100% match
    const setC = [100n, 200n, 300n, 999n, 888n]; // 3 out of 5 match (60%)
    const setD = [111n, 222n, 333n]; // 0% match

    const simFull = similarity(setA, setB);
    assert.equal(simFull.matched, 5);
    assert.equal(simFull.score, 100);

    const simPartial = similarity(setA, setC);
    assert.equal(simPartial.matched, 3);
    assert.equal(simPartial.score, 60);

    const simNone = similarity(setA, setD);
    assert.equal(simNone.matched, 0);
    assert.equal(simNone.score, 0);

    // Empty sets should return 0 safely
    const simEmpty = similarity([], setA);
    assert.equal(simEmpty.score, 0);
    assert.equal(simEmpty.matched, 0);
  });

  await t.test('4. Token Boundary & Invariance under Variable Renaming', () => {
    // Both code snippets: f(x) = x + 1 and g(y) = y + 1 have identical AST token structure:
    const code1Tokens = [
      { value: 'FunctionDef{', line: 1, endLine: 1 },
      { value: 'ID', line: 1, endLine: 1 }, // name 'f' abstracted to 'ID'
      { value: 'Return{', line: 2, endLine: 2 },
      { value: 'BinOp{', line: 2, endLine: 2 },
      { value: 'ID', line: 2, endLine: 2 }, // arg 'x' abstracted to 'ID'
      { value: 'Add{', line: 2, endLine: 2 },
      { value: 'CONST:int:1', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 }
    ];

    const code2Tokens = [
      { value: 'FunctionDef{', line: 1, endLine: 1 },
      { value: 'ID', line: 1, endLine: 1 }, // name 'g' abstracted to 'ID'
      { value: 'Return{', line: 2, endLine: 2 },
      { value: 'BinOp{', line: 2, endLine: 2 },
      { value: 'ID', line: 2, endLine: 2 }, // arg 'y' abstracted to 'ID'
      { value: 'Add{', line: 2, endLine: 2 },
      { value: 'CONST:int:1', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 },
      { value: '}', line: 2, endLine: 2 }
    ];

    const fp1 = winnow(code1Tokens, 3, 2);
    const fp2 = winnow(code2Tokens, 3, 2);

    const sim = similarity(fp1.map(f => f.hashValue), fp2.map(f => f.hashValue));
    assert.equal(sim.score, 100, 'Renaming variables must result in 100% AST similarity!');
  });
});
