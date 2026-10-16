"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiInfraService = exports.AiInfraService = void 0;
const gemini_provider_1 = require("./gemini.provider");
const openai_provider_1 = require("./openai.provider");
const intelligent_local_provider_1 = require("./intelligent-local.provider");
const key_pool_1 = require("./key-pool");
class AiInfraService {
    gemini;
    openai;
    local;
    constructor() {
        this.gemini = new gemini_provider_1.GeminiProvider();
        this.openai = new openai_provider_1.OpenAIProvider();
        this.local = new intelligent_local_provider_1.IntelligentLocalProvider();
    }
    async executeWithFallback(actionName, operation) {
        const preferred = (process.env.AI_PROVIDER || 'auto').toLowerCase();
        // 1. If explicitly configured or auto, try Gemini first if available
        if ((preferred === 'gemini' || preferred === 'auto') && this.gemini.isAvailable()) {
            try {
                return await operation(this.gemini);
            }
            catch (err) {
                console.warn(`[AI Service] Gemini failed for ${actionName}: ${err.message}. Chuyển sang fallback...`);
            }
        }
        // 2. Try OpenAI if available
        if ((preferred === 'openai' || preferred === 'auto') && this.openai.isAvailable()) {
            try {
                return await operation(this.openai);
            }
            catch (err) {
                console.warn(`[AI Service] OpenAI failed for ${actionName}: ${err.message}. Chuyển sang fallback...`);
            }
        }
        // 3. Fallback to Intelligent Local Engine
        return await operation(this.local);
    }
    async generateExam(input) {
        return this.executeWithFallback('generateExam', provider => provider.generateExam(input));
    }
    async generateRubric(input) {
        return this.executeWithFallback('generateRubric', provider => provider.generateRubric(input));
    }
    async reviewCleanCode(input) {
        return this.executeWithFallback('reviewCleanCode', provider => provider.reviewCleanCode(input));
    }
    async explainCompilationError(input) {
        return this.executeWithFallback('explainCompilationError', provider => provider.explainCompilationError(input));
    }
    getStatus() {
        const pool = key_pool_1.keyPool.getStatus();
        return {
            geminiAvailable: this.gemini.isAvailable(),
            openaiAvailable: this.openai.isAvailable(),
            localAvailable: true,
            keyPool: pool,
        };
    }
}
exports.AiInfraService = AiInfraService;
exports.aiInfraService = new AiInfraService();
