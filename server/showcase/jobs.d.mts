export interface Job {
  id: string; mode: 'full' | 'smoke'; status: string; createdAt: string;
  updatedAt: string; error?: string; [key: string]: unknown;
}
export interface Runtime {
  job: Job;
  abort: AbortController;
  queue: Array<{ id: string; action: string; shotId?: string }>;
  pending: Map<string, { resolve(value: unknown): void; reject(error: Error): void }>;
  heartbeat: unknown;
  container: string;
  finished?: Promise<void>;
}
export class JobManager {
  constructor(options: { root: string; state: string; image?: string; gpu?: string; dri?: string; createViewer(runtime: Runtime, ipc: string): Promise<{ close(): Promise<void> }> });
  active: Runtime | null;
  jobs: Map<string, Job>;
  initialize(): Promise<void>;
  publicJob(job?: Job): Record<string, unknown> | null;
  latest(): Job | undefined;
  start(mode?: 'full' | 'smoke'): Promise<Job>;
  cancel(id: string): Promise<void>;
  next(runtime: Runtime): Runtime['queue'][number] | undefined;
  heartbeat(runtime: Runtime, value: unknown): void;
  result(runtime: Runtime, value: unknown): void;
}
