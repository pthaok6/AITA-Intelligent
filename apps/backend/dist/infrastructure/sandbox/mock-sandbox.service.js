"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSandboxService = exports.MockSandboxService = void 0;
class MockSandboxService {
    async execute(code, language, inputData, expectedOutput, timeLimitMs) {
        const startTime = Date.now();
        // 1. Giả lập kiểm tra Time Limit Exceeded (nếu code cố tình lặp vô hạn)
        if (code.includes('while True') || code.includes('while(true)') || code.includes('for(;;)') || code.includes('time.sleep(10)')) {
            return {
                status: 'TIME_LIMIT_EXCEEDED',
                actualOutput: 'Process timed out after ' + timeLimitMs + 'ms',
                executionTimeMs: timeLimitMs + 10,
                memoryUsedKb: 2048,
            };
        }
        // 2. Giả lập kiểm tra Runtime Error
        if (code.includes('raise Exception') || code.includes('throw new Error') || code.includes('segfault') || code.includes('panic!')) {
            return {
                status: 'RUNTIME_ERROR',
                actualOutput: 'Runtime exception occurred during execution',
                executionTimeMs: 15,
                memoryUsedKb: 1024,
            };
        }
        // 3. Giả lập thực thi và bắt output
        // Với MVP: nếu code đơn giản hoặc có logic tính toán/in ra output
        let simulatedOutput = expectedOutput.trim();
        // Nếu code cố tình in sai output (chứa keyword "wrong")
        if (code.toLowerCase().includes('wrong')) {
            simulatedOutput = 'Wrong Output';
        }
        const executionTimeMs = Math.min(Math.floor(Math.random() * 80) + 20, timeLimitMs);
        const memoryUsedKb = Math.floor(Math.random() * 5000) + 12000;
        const isMatch = simulatedOutput.trim() === expectedOutput.trim();
        return {
            status: isMatch ? 'ACCEPTED' : 'WRONG_ANSWER',
            actualOutput: simulatedOutput,
            executionTimeMs,
            memoryUsedKb,
        };
    }
}
exports.MockSandboxService = MockSandboxService;
exports.defaultSandboxService = new MockSandboxService();
