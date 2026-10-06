import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { IJobQueue } from './job-queue.interface';

export class BullMqJobQueue implements IJobQueue {
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private connections: IORedis[] = [];
  constructor(private redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379', private prefix = process.env.QUEUE_PREFIX || 'aita') {}

  private connection(worker: boolean) {
    const connection = new IORedis(this.redisUrl, { maxRetriesPerRequest: worker ? null : 1, enableOfflineQueue: worker, connectTimeout: 5000 });
    connection.on('error', error => console.error('[Redis]', error.message));
    this.connections.push(connection);
    return connection;
  }
  private queue(name: string) {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection(false), prefix: this.prefix,
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { count: 1000, age: 86400 }, removeOnFail: { count: 1000 } } });
      queue.on('error', error => console.error('[Queue]', error.message));
      this.queues.set(name, queue);
    }
    return queue;
  }
  async addJob(queueName: string, payload: { submissionId: string }): Promise<void> {
    const queue = this.queue(queueName);
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        (async () => {
          await queue.waitUntilReady();
          const existing = await queue.getJob(payload.submissionId);
          if (existing && await existing.getState() === 'failed') { await existing.retry(); return; }
          await queue.add('grade-submission', payload, { jobId: payload.submissionId });
        })(),
        new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Redis enqueue timed out.')), 5000); }),
      ]);
    } finally { if (timeout) clearTimeout(timeout); }
  }
  registerHandler(queueName: string, handler: (payload: any) => Promise<void>): void {
    if (this.workers.has(queueName)) throw new Error('Worker already registered for ' + queueName);
    const worker = new Worker(queueName, async (job: Job) => handler(job.data), {
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
    this.workers.clear(); this.queues.clear(); this.connections = [];
  }
}
export const defaultJobQueue = new BullMqJobQueue();
