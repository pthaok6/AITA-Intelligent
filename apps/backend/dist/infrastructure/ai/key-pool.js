"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyPool = exports.KeyPool = void 0;
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
        this.geminiKeys = gKeys.map(key => ({ key, failures: 0, cooldownUntil: 0 }));
    }
    reloadOpenAIKeys() {
        const rawOpenAI = (process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY || '').trim();
        const oKeys = rawOpenAI.split(',').map(k => k.trim()).filter(Boolean);
        this.openaiKeys = oKeys.map(key => ({ key, failures: 0, cooldownUntil: 0 }));
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
                return entry.key;
            }
        }
        // All in cooldown, return least delayed
        return this.geminiKeys[this.geminiIndex % this.geminiKeys.length].key;
    }
    markGeminiKeyFailed(key, isRateLimit = false) {
        const entry = this.geminiKeys.find(e => e.key === key);
        if (!entry)
            return;
        entry.failures++;
        // 60s cooldown on rate-limit, 15s on other errors
        const cooldownMs = isRateLimit ? 60000 : 15000;
        entry.cooldownUntil = Date.now() + cooldownMs;
        console.warn(`[KeyPool] Gemini key ${key.substring(0, 6)}... marked failed (${isRateLimit ? '429 RateLimit' : 'Error'}). Cooldown ${cooldownMs / 1000}s`);
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
                return entry.key;
            }
        }
        return this.openaiKeys[this.openaiIndex % this.openaiKeys.length].key;
    }
    markOpenAIKeyFailed(key, isRateLimit = false) {
        const entry = this.openaiKeys.find(e => e.key === key);
        if (!entry)
            return;
        entry.failures++;
        const cooldownMs = isRateLimit ? 60000 : 15000;
        entry.cooldownUntil = Date.now() + cooldownMs;
        console.warn(`[KeyPool] OpenAI key ${key.substring(0, 6)}... marked failed. Cooldown ${cooldownMs / 1000}s`);
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
