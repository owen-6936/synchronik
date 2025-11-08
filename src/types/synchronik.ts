export type Status = "idle" | "running" | "error" | "completed" | "paused";
export interface Task {
  arrangementId: number; // 1-based index for execution order
  name: string; // e.g., 'buildDocs'
  status?: Status;
  payload?: any; // optional task-specific data
  execute: () => Promise<void | any>; // The actual work to be done for the task
}

export interface WorkerMeta {
  status: Status;
  capabilities: string[];
  tasks?: Task[];
}

export interface PreRunSequence {
  workerId: string;
  sequence: string[]; // e.g., ["would run: buildDocs", "would run: emitBadges"]
}

export interface WorkerStatus {
  currentTask?: string | undefined;
  progress?: number;
  lastMilestone?: string | undefined;
  isIdle: boolean;
}

export interface WorkerManager {
  /**
   * Adds a new task to the manager, assigning it a unique arrangementId.
   * @param task - A task object, without the arrangementId.
   * @returns The full Task object with its new arrangementId, or null if the name is a duplicate.
   */
  addTask(task: Omit<Task, "arrangementId">): Task | null;

  /**
   * Updates an existing task's properties.
   * @param taskName - The name of the task to update.
   * @param updates - The properties to update (e.g., payload, execute function).
   */
  updateTask(
    taskName: string,
    updates: Partial<Omit<Task, "arrangementId" | "name">>
  ): void;

  /**
   * Pauses a pending task. All tasks with a higher arrangementId will wait.
   * @param taskName - The name of the task to pause.
   */
  pauseTask(taskName: string): void;

  /**
   * Resumes a paused task.
   * @param taskName - The name of the task to resume.
   */
  resumeTask(taskName: string): void;

  /**
   * Cancels and removes a pending task from the queue.
   * @param taskName - The name of the task to cancel.
   */
  cancelTask(taskName: string): void;

  /**
   * Generates SynchronikWorker instances for all managed tasks.
   * @returns An array of SynchronikWorker instances ready to be registered with the core manager.
   */
  generateWorkers(): SynchronikWorker[];

  /**
   * Simulates the execution flow of pending tasks.
   * @returns A string describing the ordered sequence of tasks.
   */
  simulateRun(): string;

  /**
   * Starts the worker manager's internal loop for assigning tasks to workers.
   * This must be called for tasks to be processed.
   */
  start(): void;

  /**
   * Stops the worker manager's internal loop.
   * Pending tasks will remain in the queue but will not be processed until `start()` is called again.
   */
  stop(): void;

  // Gets the current status of a worker by its ID
  getWorkerStatus(workerId: string): WorkerStatus | undefined;
}

export type RunMode = "parallel" | "sequential" | "batched" | "isolated";

export interface SynchronikUnit {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  status?: Status;
  lastRun?: Date;

  /**
   * Determines how workers within a process are executed.
   * - `parallel`: All workers run concurrently.
   * - `sequential`: Workers run one after another.
   * - `isolated`: Workers run sequentially with a small delay between each.
   */
  runMode?: RunMode;

  // 🎯 Event hooks
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface SynchronikWorker extends SynchronikUnit {
  run: () => Promise<void>;
  intervalMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  task?: string | undefined;
  processId?: string;
}

export interface SynchronikProcess extends SynchronikUnit {
  workers: SynchronikWorker[];
  runAll?: () => Promise<void>;
}

export interface SynchronikManager {
  // Core registration and control
  registerUnit: (unit: SynchronikUnit) => void;
  startAll: () => void;
  stopAll: () => void;

  // Execution
  runWorkerById: (workerId: string) => Promise<void>;
  runProcessById: (processId: string) => Promise<void>;

  // Status and querying
  getUnitStatus: (id: string) => SynchronikUnit["status"];
  listUnits: () => SynchronikUnit[];
  listWorkers?: () => SynchronikWorker[];
  listProcesses?: () => SynchronikProcess[];

  // 🎯 Milestone broadcasting
  emitMilestone: (
    milestoneId: string,
    payload?: Record<string, unknown>
  ) => void;

  // 📡 Real-time event subscription
  subscribeToEvents: (listener: (event: SynchronikEvent) => void) => () => void; // returns unsubscribe function
}

export type SynchronikEvent =
  | { type: "start"; unitId: string }
  | { type: "complete"; unitId: string }
  | { type: "error"; unitId: string; error: Error }
  | {
      type: "milestone";
      milestoneId: string;
      payload?: Record<string, unknown>;
    };

export interface MilestoneEmitter {
  emit: (milestoneId: string, payload?: Record<string, unknown>) => void;
  emitForUnit: (
    unitId: string,
    stage: string,
    payload?: Record<string, unknown>
  ) => void;
}

export interface SynchronikVisualizer {
  renderUnitStatus: (
    unitId: string,
    status: SynchronikUnit["status"],
    message?: string
  ) => void;

  renderMilestone: (
    milestoneId: string,
    payload?: Record<string, unknown>,
    message?: string
  ) => void;

  renderUnitMode?: (unitId: string, mode: RunMode) => void;

  attachToEventBus: (eventBus: SynchronikEventBus) => void;
}

export interface SynchronikEventBus {
  emit: (event: SynchronikEvent) => void;
  subscribe: <T extends SynchronikEvent["type"]>(
    type: T,
    listener: (event: Extract<SynchronikEvent, { type: T }>) => void
  ) => () => void;
  subscribeAll: (listener: (event: SynchronikEvent) => void) => () => void;
}

export interface SynchronikLifecycle {
  register: (unit: SynchronikUnit) => void;
  update: (
    id: string,
    updates: Partial<Pick<SynchronikUnit, "status" | "lastRun" | "enabled">>
  ) => void;
  release: (id: string) => void;

  emitMilestone: (
    milestoneId: string,
    payload?: Record<string, unknown>
  ) => void;
}

export interface StatusTracker {
  setStatus: (
    unitId: string,
    status: SynchronikUnit["status"],
    options?: {
      emitMilestone?: boolean;
      payload?: Record<string, unknown>;
    }
  ) => void;
  getStatus: (unitId: string) => SynchronikUnit["status"];
}

export interface SynchronikLoop {
  run: () => Promise<void>;
  executionStrategy?: "auto" | "parallel" | "sequential";
}

export interface UnitWatcher {
  scan: () => void;
}

export interface SynchronikManager {
  start: () => void;
  stop: () => Promise<void>;
  registerUnit: (unit: SynchronikUnit) => void;
  releaseUnit: (id: string) => void;
  updateStatus: StatusTracker["setStatus"];
  getRegistrySnapshot: () => SynchronikUnit[];
  onMilestone: (
    handler: (milestoneId: string, payload?: Record<string, unknown>) => void
  ) => () => void;

  // 🔧 Manual control
  startAll: () => void;
  stopAll: () => void;
  runWorkerById: (workerId: string) => Promise<void>;
  runProcessById: (id: string) => Promise<void>;

  /**
   * Creates and integrates a worker pool manager.
   * @param poolSize - The number of concurrent workers in the pool.
   */
  useWorkerPool: (poolSize?: number) => WorkerManager;
}

export interface SynchronikDashboard {
  render: () => void;
  attachToManager: (manager: SynchronikManager) => void;
  showUnitStatus: (unitId: string) => void;
  showMilestoneArc: (unitId: string) => void;
  triggerBadgeGlow: (unitId: string, badge: string) => void;
}
