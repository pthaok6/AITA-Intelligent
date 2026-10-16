"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AST_VERSION = void 0;
exports.settings = settings;
exports.rightmostMinima = rightmostMinima;
exports.winnow = winnow;
exports.similarity = similarity;
const crypto_1 = __importDefault(require("crypto"));
exports.AST_VERSION = 'ast-winnowing-v1';
function settings() {
    const k = Number(process.env.WINNOWING_K || 5), w = Number(process.env.WINNOWING_W || 4);
    if (!Number.isInteger(k) || !Number.isInteger(w) || k < 1 || k > 100 || w < 1 || w > 100)
        throw new Error('WINNOWING_K/W must be integers in 1..100.');
    return { k, w };
}
function rightmostMinima(hashes, width) {
    if (!Number.isInteger(width) || width < 1)
        throw new Error('Invalid window width.');
    if (!hashes.length)
        return [];
    const window = Math.min(width, hashes.length), deque = [], selected = [];
    let head = 0;
    for (let i = 0; i < hashes.length; i++) {
        while (deque.length > head && hashes[deque[deque.length - 1]] >= hashes[i])
            deque.pop();
        deque.push(i);
        while (deque[head] <= i - window)
            head++;
        if (i >= window - 1 && selected[selected.length - 1] !== deque[head])
            selected.push(deque[head]);
    }
    return selected;
}
function winnow(tokens, k = 5, w = 4) {
    if (!Number.isInteger(k) || k < 1)
        throw new Error('Invalid k-gram size.');
    const hashes = [];
    for (let i = 0; i + k <= tokens.length; i++) {
        // JSON encoding preserves token boundaries. Signed PostgreSQL BIGINT uses 63 bits.
        hashes.push(crypto_1.default.createHash('sha256').update(JSON.stringify(tokens.slice(i, i + k).map(t => t.value))).digest().readBigUInt64BE() & ((1n << 63n) - 1n));
    }
    return rightmostMinima(hashes, w).map(i => ({ hashValue: hashes[i], tokenStart: i, tokenEnd: i + k - 1,
        lineStart: Math.min(...tokens.slice(i, i + k).map(t => t.line)), lineEnd: Math.max(...tokens.slice(i, i + k).map(t => t.endLine)) }));
}
function similarity(a, b) {
    const left = new Set([...a].map(String)), right = new Set([...b].map(String));
    const matched = [...left].filter(hash => right.has(hash)).length;
    return { matched, score: left.size && right.size ? Math.round(10000 * matched / Math.min(left.size, right.size)) / 100 : 0 };
}
