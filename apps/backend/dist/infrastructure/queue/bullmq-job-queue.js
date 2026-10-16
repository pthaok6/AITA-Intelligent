"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultJobQueue = exports.BullMqJobQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
class BullMqJobQueue {
    redisUrl;
    prefix;
    queues = new Map();
    workers = new Map();
    connections = [];
    constructor(redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379', prefix = process.env.QUEUE_PREFIX || 'aita') {
        this.redisUrl = redisUrl;
        this.prefix = prefix;
    }
    connection(worker) {
        const connection = new ioredis_1.default(this.redisUrl, { maxRetriesPerRequest: worker ? null : 1, enableOfflineQueue: worker, connectTimeout: 5000 });
        connection.on('error', error => console.error('[Redis]', error.message));
        this.connections.push(connection);
        return connection;
    }
    queue(name) {
        let queue = this.queues.get(name);
        if (!queue) {
            queue = new bullmq_1.Queue(name, { connection: this.connection(false), prefix: this.prefix,
                defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { count: 1000, age: 86400 }, removeOnFail: { count: 1000 } } });
            queue.on('error', error => console.error('[Queue]', error.message));
            this.queues.set(name, queue);
        }
        return queue;
    }
    async addJob(queueName, payload) {
        const queue = this.queue(queueName);
        let timeout;
        try {
            await Promise.race([
                (async () => {
                    await queue.waitUntilReady();
                    const existing = await queue.getJob(payload.submissionId);
                    if (existing && await existing.getState() === 'failed') {
                        await existing.retry();
                        return;
                    }
                    await queue.add('grade-submission', payload, { jobId: payload.submissionId });
                })(),
                new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Redis enqueue timed out.')), 5000); }),
            ]);
        }
        finally {
            if (timeout)
                clearTimeout(timeout);
        }
    }
    registerHandler(queueName, handler) {
        if (this.workers.has(queueName))
            throw new Error('Worker already registered for ' + queueName);
        const worker = new bullmq_1.Worker(queueName, async (job) => handler(job.data), {
            connection: this.connection(true), prefix: this.prefix, concurrency: 2,
        });
        worker.on('error', error => console.error('[Worker]', error.message));
        worker.on('failed', (job, error) => console.error('[Worker failed]', job?.id, error.message));
        this.workers.set(queueName, worker);
    }
    async close() {
        await Promise.all([...this.workers.values()].map(worker => worker.close()));
        await Promise.all([...this.queues.values()].map(queue => queue.close()));
        this.connections.forEach(connection => connection.disconnect());
        this.workers.clear();
        this.queues.clear();
        this.connections = [];
    }
}
exports.BullMqJobQueue = BullMqJobQueue;
exports.defaultJobQueue = new BullMqJobQueue();
