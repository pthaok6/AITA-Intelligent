"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyPool = exports.KeyPool = void 0;
exports.maskApiKey = maskApiKey;
exports.probeKeyConnection = probeKeyConnection;
function maskApiKey(key) {
    if (!key)
        return '';
    if (key.length <= 10)
        return '***' + key.slice(-3);
    return key.slice(0, 6) + '...' + key.slice(-4);
}
async function probeKeyConnection(provider, key) {
    try {
        if (provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
                    generationConfig: { maxOutputTokens: 2 },
                }),
            });
            if (res.ok) {
                return { success: true, message: 'Kết nối Gemini API thành công (HTTP 200 OK).' };
            }
            const err = await res.text();
            return { success: false, message: `Lỗi kết nối Gemini (HTTP ${res.status}): ${err.slice(0, 150)}` };
        }
        else {
            const url = 'https://api.openai.com/v1/models';
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${key}` },
            });
            if (res.ok) {
                return { success: true, message: 'Kết nối OpenAI API thành công (HTTP 200 OK).' };
            }
            const err = await res.text();
            return { success: false, message: `Lỗi kết nối OpenAI (HTTP ${res.status}): ${err.slice(0, 150)}` };
        }
    }
    catch (e) {
        return { success: false, message: `Lỗi kết nối mạng: ${e.message}` };
    }
}
class KeyPool {
    geminiKeys = [];
    geminiIndex = 0;
    openaiKeys = [];
    openaiIndex = 0;
    constructor() {
        this.reloadKeys();
    }
    reloadGeminiKeys() {
        const rawGemini = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').trim();
        const gKeys = rawGemini.split(',').map(k => k.trim()).filter(Boolean);
        const existingCustom = this.geminiKeys.filter(k => k.isCustom);
        this.geminiKeys = [
            ...gKeys.map((key, i) => ({
                id: `gemini-env-${i}`,
                provider: 'gemini',
                key,
                maskedKey: maskApiKey(key),
                failures: 0,
                cooldownUntil: 0,
                isCustom: false,
                addedAt: Date.now(),
                lastProbeStatus: 'SUCCESS',
                lastProbeMessage: 'Khởi tạo từ biến môi trường hệ thống.',
            })),
            ...existingCustom,
        ];
    }
    reloadOpenAIKeys() {
        const rawOpenAI = (process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY || '').trim();
        const oKeys = rawOpenAI.split(',').map(k => k.trim()).filter(Boolean);
        const existingCustom = this.openaiKeys.filter(k => k.isCustom);
        this.openaiKeys = [
            ...oKeys.map((key, i) => ({
                id: `openai-env-${i}`,
                provider: 'openai',
                key,
                maskedKey: maskApiKey(key),
                failures: 0,
                cooldownUntil: 0,
                isCustom: false,
                addedAt: Date.now(),
                lastProbeStatus: 'SUCCESS',
                lastProbeMessage: 'Khởi tạo từ biến môi trường hệ thống.',
            })),
            ...existingCustom,
        ];
    }
    reloadKeys() {
        this.reloadGeminiKeys();
        this.reloadOpenAIKeys();
    }
    getGeminiKey() {
        if (this.geminiKeys.length === 0) {
            this.reloadGeminiKeys();
        }
        if (this.geminiKeys.length === 0)
            return null;
        const now = Date.now();
        for (let i = 0; i < this.geminiKeys.length; i++) {
            const idx = (this.geminiIndex + i) % this.geminiKeys.length;
            const entry = this.geminiKeys[idx];
            if (entry.cooldownUntil <= now) {
                this.geminiIndex = (idx + 1) % this.geminiKeys.length;
                entry.lastUsedAt = now;
                return entry.key;
            }
        }
        // All in cooldown, return least delayed
        const fallbackEntry = this.geminiKeys[this.geminiIndex % this.geminiKeys.length];
        fallbackEntry.lastUsedAt = now;
        return fallbackEntry.key;
    }
    markGeminiKeyFailed(key, isRateLimit = false) {
        const entry = this.geminiKeys.find(e => e.key === key);
        if (!entry)
            return;
        entry.failures++;
        // SRS Alternative Flow A: HTTP 429: key enters 24h cooldown (hoặc 60s cooldown tạm thời)
        const cooldownMs = isRateLimit ? 24 * 60 * 60 * 1000 : 30 * 1000;
        entry.cooldownUntil = Date.now() + cooldownMs;
        console.warn(`[KeyPool] Gemini key ${entry.maskedKey} marked failed (${isRateLimit ? '429 RateLimit -> 24h Cooldown' : 'Error'}).`);
    }
    getOpenAIKey() {
        if (this.openaiKeys.length === 0) {
            this.reloadOpenAIKeys();
        }
        if (this.openaiKeys.length === 0)
            return null;
        const now = Date.now();
        for (let i = 0; i < this.openaiKeys.length; i++) {
            const idx = (this.openaiIndex + i) % this.openaiKeys.length;
            const entry = this.openaiKeys[idx];
            if (entry.cooldownUntil <= now) {
                this.openaiIndex = (idx + 1) % this.openaiKeys.length;
                entry.lastUsedAt = now;
                return entry.key;
            }
        }
        const fallbackEntry = this.openaiKeys[this.openaiIndex % this.openaiKeys.length];
        fallbackEntry.lastUsedAt = now;
        return fallbackEntry.key;
    }
    markOpenAIKeyFailed(key, isRateLimit = false) {
        const entry = this.openaiKeys.find(e => e.key === key);
        if (!entry)
            return;
        entry.failures++;
        const cooldownMs = isRateLimit ? 24 * 60 * 60 * 1000 : 30 * 1000;
        entry.cooldownUntil = Date.now() + cooldownMs;
        console.warn(`[KeyPool] OpenAI key ${entry.maskedKey} marked failed (${isRateLimit ? '429 RateLimit -> 24h Cooldown' : 'Error'}).`);
    }
    async addCustomKey(provider, rawKey, probeFirst = true) {
        const trimmed = rawKey.trim();
        if (!trimmed)
            throw new Error('API Key không được để trống.');
        const pool = provider === 'gemini' ? this.geminiKeys : this.openaiKeys;
        if (pool.some(k => k.key === trimmed)) {
            throw new Error('Key này đã tồn tại trong Key Pool.');
        }
        let probeStatus = 'PENDING';
        let probeMessage = 'Chưa kiểm tra';
        if (probeFirst) {
            const probe = await probeKeyConnection(provider, trimmed);
            if (!probe.success) {
                throw new Error(`Kiểm tra API Key thất bại: ${probe.message}`);
            }
            probeStatus = 'SUCCESS';
            probeMessage = probe.message;
        }
        const newEntry = {
            id: `${provider}-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            provider,
            key: trimmed,
            maskedKey: maskApiKey(trimmed),
            failures: 0,
            cooldownUntil: 0,
            isCustom: true,
            addedAt: Date.now(),
            lastProbeStatus: probeStatus,
            lastProbeMessage: probeMessage,
        };
        pool.push(newEntry);
        return newEntry;
    }
    removeKey(id) {
        const gIndex = this.geminiKeys.findIndex(k => k.id === id);
        if (gIndex !== -1) {
            this.geminiKeys.splice(gIndex, 1);
            return true;
        }
        const oIndex = this.openaiKeys.findIndex(k => k.id === id);
        if (oIndex !== -1) {
            this.openaiKeys.splice(oIndex, 1);
            return true;
        }
        return false;
    }
    resetKey(id) {
        const entry = [...this.geminiKeys, ...this.openaiKeys].find(k => k.id === id);
        if (!entry)
            return false;
        entry.failures = 0;
        entry.cooldownUntil = 0;
        entry.lastProbeStatus = 'SUCCESS';
        entry.lastProbeMessage = 'Đã reset cooldown thủ công.';
        return true;
    }
    async probeKey(id) {
        const entry = [...this.geminiKeys, ...this.openaiKeys].find(k => k.id === id);
        if (!entry)
            throw new Error('Không tìm thấy Key.');
        const result = await probeKeyConnection(entry.provider, entry.key);
        entry.lastProbeStatus = result.success ? 'SUCCESS' : 'FAILED';
        entry.lastProbeMessage = result.message;
        if (result.success) {
            entry.cooldownUntil = 0;
            entry.failures = 0;
        }
        return result;
    }
    listKeys() {
        const now = Date.now();
        const sanitize = (list) => list.map(entry => ({
            id: entry.id,
            provider: entry.provider,
            maskedKey: entry.maskedKey,
            isCustom: !!entry.isCustom,
            failures: entry.failures,
            cooldownUntil: entry.cooldownUntil,
            isAvailable: entry.cooldownUntil <= now,
            status: entry.cooldownUntil > now ? 'COOLDOWN' : entry.failures > 3 ? 'FAILED' : 'ACTIVE',
            cooldownRemainingSeconds: Math.max(0, Math.ceil((entry.cooldownUntil - now) / 1000)),
            lastProbeStatus: entry.lastProbeStatus,
            lastProbeMessage: entry.lastProbeMessage,
            lastUsedAt: entry.lastUsedAt,
            addedAt: entry.addedAt,
        }));
        return {
            gemini: sanitize(this.geminiKeys),
            openai: sanitize(this.openaiKeys),
            status: this.getStatus(),
        };
    }
    getStatus() {
        if (this.geminiKeys.length === 0) {
            this.reloadGeminiKeys();
        }
        if (this.openaiKeys.length === 0) {
            this.reloadOpenAIKeys();
        }
        const now = Date.now();
        return {
            gemini: {
                totalKeys: this.geminiKeys.length,
                availableKeys: this.geminiKeys.filter(k => k.cooldownUntil <= now).length,
            },
            openai: {
                totalKeys: this.openaiKeys.length,
                availableKeys: this.openaiKeys.filter(k => k.cooldownUntil <= now).length,
            },
        };
    }
}
exports.KeyPool = KeyPool;
exports.keyPool = new KeyPool();
