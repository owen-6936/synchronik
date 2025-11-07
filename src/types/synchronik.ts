export interface SynchronikUnit {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  status?: "idle" | "running" | "error" | "completed" | "paused";
  lastRun?: Date;

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
  task?: string;
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
  runUnitById: (id: string) => Promise<void>;
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
}

export interface SynchronikLoop {
  run: () => Promise<void>;
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
  runUnitById: (id: string) => Promise<void>;
  runProcessById: (id: string) => Promise<void>;
}
