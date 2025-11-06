export interface SynchronikWorker {
  id: string;
  name: string;
  description?: string;
  run: () => Promise<void>;
  intervalMs?: number;
  enabled: boolean;
  lastRun?: Date;
  status?: "idle" | "running" | "error" | "completed";

  // 🎯 Event hooks
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface SynchronikManager {
  registerWorker: (worker: SynchronikWorker) => void;
  startAll: () => void;
  stopAll: () => void;
  runWorkerById: (id: string) => Promise<void>;
  getWorkerStatus: (id: string) => SynchronikWorker["status"];
  listWorkers: () => SynchronikWorker[];
}
