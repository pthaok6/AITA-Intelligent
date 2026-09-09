export interface IJobQueue {
  addJob(queueName: string, payload: any): Promise<void>;
  registerHandler(queueName: string, handler: (payload: any) => Promise<void>): void;
}
