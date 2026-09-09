"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultJobQueue = exports.InMemoryJobQueue = void 0;
const events_1 = require("events");
class InMemoryJobQueue {
    emitter = new events_1.EventEmitter();
    handlers = new Map();
    constructor() {
        this.emitter.on('job', async ({ queueName, payload }) => {
            const handler = this.handlers.get(queueName);
            if (handler) {
                try {
                    await handler(payload);
                }
                catch (error) {
                    console.error(`[InMemoryJobQueue] Error handling job in ${queueName}:`, error);
                }
            }
            else {
                console.warn(`[InMemoryJobQueue] No handler registered for queue: ${queueName}`);
            }
        });
    }
    async addJob(queueName, payload) {
        // Mô phỏng độ trễ hàng đợi bất đồng bộ (200ms)
        setTimeout(() => {
            this.emitter.emit('job', { queueName, payload });
        }, 200);
    }
    registerHandler(queueName, handler) {
        this.handlers.set(queueName, handler);
    }
}
exports.InMemoryJobQueue = InMemoryJobQueue;
exports.defaultJobQueue = new InMemoryJobQueue();
