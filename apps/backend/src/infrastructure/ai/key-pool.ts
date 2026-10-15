interface KeyEntry {
  key: string;
  failures: number;
  cooldownUntil: number;
}

export class KeyPool {
  private geminiKeys: KeyEntry[] = [];
  private geminiIndex = 0;
  private openaiKeys: KeyEntry[] = [];
  private openaiIndex = 0;

  constructor() {
    this.reloadKeys();
  }

  public reloadGeminiKeys(): void {
    const rawGemini = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').trim();
    const gKeys = rawGemini.split(',').map(k => k.trim()).filter(Boolean);
    this.geminiKeys = gKeys.map(key => ({ key, failures: 0, cooldownUntil: 0 }));
  }

  public reloadOpenAIKeys(): void {
    const rawOpenAI = (process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY || '').trim();
    const oKeys = rawOpenAI.split(',').map(k => k.trim()).filter(Boolean);
    this.openaiKeys = oKeys.map(key => ({ key, failures: 0, cooldownUntil: 0 }));
  }

  public reloadKeys(): void {
    this.reloadGeminiKeys();
    this.reloadOpenAIKeys();
  }

  public getGeminiKey(): string | null {
    if (this.geminiKeys.length === 0) {
      this.reloadGeminiKeys();
    }
    if (this.geminiKeys.length === 0) return null;
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

  public markGeminiKeyFailed(key: string, isRateLimit = false): void {
    const entry = this.geminiKeys.find(e => e.key === key);
    if (!entry) return;
    entry.failures++;
    // 60s cooldown on rate-limit, 15s on other errors
    const cooldownMs = isRateLimit ? 60000 : 15000;
    entry.cooldownUntil = Date.now() + cooldownMs;
    console.warn(`[KeyPool] Gemini key ${key.substring(0, 6)}... marked failed (${isRateLimit ? '429 RateLimit' : 'Error'}). Cooldown ${cooldownMs / 1000}s`);
  }

  public getOpenAIKey(): string | null {
    if (this.openaiKeys.length === 0) {
      this.reloadOpenAIKeys();
    }
    if (this.openaiKeys.length === 0) return null;
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

  public markOpenAIKeyFailed(key: string, isRateLimit = false): void {
    const entry = this.openaiKeys.find(e => e.key === key);
    if (!entry) return;
    entry.failures++;
    const cooldownMs = isRateLimit ? 60000 : 15000;
    entry.cooldownUntil = Date.now() + cooldownMs;
    console.warn(`[KeyPool] OpenAI key ${key.substring(0, 6)}... marked failed. Cooldown ${cooldownMs / 1000}s`);
  }

  public getStatus() {
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

export const keyPool = new KeyPool();
