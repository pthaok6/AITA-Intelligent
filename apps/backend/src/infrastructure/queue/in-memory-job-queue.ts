import { EventEmitter } from 'events';
import { IJobQueue } from './job-queue.interface';

export class InMemoryJobQueue implements IJobQueue {
  private emitter = new EventEmitter();
  private handlers = new Map<string, (payload: any) => Promise<void>>();

  constructor() {
    this.emitter.on('job', async ({ queueName, payload }: { queueName: string; payload: any }) => {
      const handler = this.handlers.get(queueName);
      if (handler) {
        try {
          await handler(payload);
        } catch (error) {
          console.error(`[InMemoryJobQueue] Error handling job in ${queueName}:`, error);
        }
      } else {
        console.warn(`[InMemoryJobQueue] No handler registered for queue: ${queueName}`);
      }
    });
  }

  async addJob(queueName: string, payload: any): Promise<void> {
    // Mô phỏng độ trễ hàng đợi bất đồng bộ (200ms)
    setTimeout(() => {
      this.emitter.emit('job', { queueName, payload });
    }, 200);
  }

  registerHandler(queueName: string, handler: (payload: any) => Promise<void>): void {
    this.handlers.set(queueName, handler);
  }
}

export const defaultJobQueue = new InMemoryJobQueue();
