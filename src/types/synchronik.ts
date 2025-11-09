/**
 * Represents the possible lifecycle statuses of any Synchronik unit.
 */
/**
 * Represents the possible lifecycle statuses of any Synchronik unit.
 */
export type Status = "idle" | "running" | "error" | "completed" | "paused";

/**
 * Represents a single task managed by the `WorkerManager`.
 */
export interface Task {
    /** A 1-based index indicating the execution order within the `WorkerManager`'s queue. */
    arrangementId: number; // 1-based index for execution order
    /** A unique name for the task, used for identification and management. */
    name: string; // e.g., 'buildDocs'
    /** The current status of the task within the `WorkerManager`'s queue. */
    status?: Status;
    /** Optional task-specific data that can be passed to the `execute` function. */
    payload?: any; // optional task-specific data
    /** The actual asynchronous function containing the task's business logic. */
    execute: () => Promise<void | any>; // The actual work to be done for the task
}

/**
 * Metadata about a worker, typically used internally by the `WorkerManager`.
 */
export interface WorkerMeta {
    /** The current status of the worker. */
    status: Status;
    /** A list of capabilities or tags associated with the worker. */
    capabilities: string[];
    /** An array of tasks currently assigned to or processed by this worker. */
    tasks?: Task[];
}

/**
 * Represents a simulated execution sequence for tasks.
 */
export interface PreRunSequence {
    /** The ID of the worker that would execute the tasks. */
    workerId: string;
    /** A list of descriptions of tasks in their simulated execution order. */
    sequence: string[]; // e.g., ["would run: buildDocs", "would run: emitBadges"]
}

/**
 * Provides status information for a worker managed by the `WorkerManager`.
 */
export interface WorkerStatus {
    /** The name of the task currently being processed by the worker, if any. */
    currentTask?: string | undefined;
    /** The progress of the current task, typically a number between 0 and 1. */
    progress?: number;
    /** The ID of the last milestone emitted by the worker. */
    lastMilestone?: string | undefined;
    /** True if the worker is currently idle and available for new tasks. */
    isIdle: boolean;
}

/**
 * Manages a pool of reusable workers to process a dynamic queue of tasks.
 */
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
    /**
     * Retrieves the current status and assigned task of a specific worker in the pool.
     * @param workerId The ID of the pool worker to inspect.
     * @returns A `WorkerStatus` object or `undefined` if the worker is not found.
     */
    getWorkerStatus(workerId: string): WorkerStatus | undefined;
}

/**
 * Defines the execution strategy for workers within a `SynchronikProcess`.
 */
export type RunMode = "parallel" | "sequential" | "batched" | "isolated";

/**
 * The base interface for all executable units in the Synchronik engine.
 */
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
     * - `isolated`: Workers run sequentially with a configurable delay. See `isolationDelayMs`.
     * - `batched`: Workers run in concurrent groups of a configurable size. See `batchSize`.
     */
    runMode?: RunMode;

    // 🎯 Event hooks
    /**
     * An optional hook that is called when the unit's status changes to 'running'.
     */
    onStart?: () => void;
    /**
     * An optional hook that is called when the unit's status changes to 'completed'.
     */
    onComplete?: () => void;

    /**
     * An optional hook that is called when the unit enters an 'error' state
     * after all retries have been exhausted.
     * @param error The error that caused the final failure.
     */
    onError?: (error: Error) => void;
}

/**
 * Represents the smallest unit of work in the engine.
 * It encapsulates an asynchronous function (`run`) and its configuration.
 */
export interface SynchronikWorker extends SynchronikUnit {
    /**
     * The core asynchronous function that contains the worker's business logic.
     * If this function throws an unhandled error, the engine's retry mechanism will be triggered.
     */
    run: () => Promise<void>;
    /** The interval in milliseconds at which the worker should be run by the automatic loop. */
    intervalMs?: number;
    /** The maximum time in milliseconds that a single `run` attempt is allowed to take before it's considered a failure. @default 10000 */
    timeoutMs?: number;
    /** The maximum number of times to retry the `run` function upon failure. @default 0 */
    maxRetries?: number;
    /**
     * The delay in milliseconds between retry attempts.
     * Can be a fixed number or a function that returns a dynamic delay.
     * The function receives the current attempt number (starting from 1).
     * @example 1000 // 1 second fixed delay
     * @example (attempt) => Math.pow(2, attempt) * 100 // Exponential backoff
     * @default 0
     */
    retryDelayMs?: number | ((attempt: number) => number);
    task?: string | undefined;
    processId?: string;
}

/**
 * Represents a collection of `SynchronikWorker` instances grouped into a single, manageable workflow.
 * A process defines how its workers are executed via its `runMode`.
 */
export interface SynchronikProcess extends SynchronikUnit {
    workers: SynchronikWorker[];
    runAll?: () => Promise<void>;

    /**
     * The delay in milliseconds between each worker execution when `runMode` is 'isolated'.
     * @default 100
     */
    isolationDelayMs?: number;

    /**
     * The number of workers to execute concurrently when `runMode` is 'batched'.
     * @default 2
     */
    batchSize?: number;
}

/**
 * The primary public interface for interacting with the Synchronik engine.
 */
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
    subscribeToEvents: (
        listener: (event: SynchronikEvent) => void
    ) => () => void; // returns unsubscribe function

    /** Starts the engine's background processes (main loop and watcher). */
    start: () => void;
    /** Gracefully stops the engine's background processes. */
    stop: () => Promise<void>;
}

/**
 * A union type representing all possible events emitted by the engine's event bus.
 */
export type SynchronikEvent =
    | { type: "start"; unitId: string }
    | { type: "complete"; unitId: string }
    | { type: "error"; unitId: string; error: Error }
    | {
          type: "milestone";
          milestoneId: string;
          payload?: Record<string, unknown>;
      };

/**
 * Emits milestone events, providing a way to track significant points in a unit's lifecycle.
 */

export interface MilestoneEmitter {
    emit: (milestoneId: string, payload?: Record<string, unknown>) => void;
    emitForUnit: (
        unitId: string,
        stage: string,
        payload?: Record<string, unknown>
    ) => void;
}

/**
 * An interface for a visualizer component that can render engine state.
 */
export interface SynchronikVisualizer {
    /**
     * Renders the status of a specific unit.
     * @param unitId The ID of the unit.
     * @param status The new status of the unit.
     * @param message An optional message to display with the status.
     */
    renderUnitStatus: (
        unitId: string,
        status: SynchronikUnit["status"],
        message?: string
    ) => void;

    /**
     * Renders a milestone event.
     * @param milestoneId The ID of the milestone.
     * @param payload Optional data associated with the milestone.
     * @param message An optional message to display with the milestone.
     */
    renderMilestone: (
        milestoneId: string,
        payload?: Record<string, unknown>,
        message?: string
    ) => void;

    renderUnitMode?: (unitId: string, mode: RunMode) => void;
    /**
     * Attaches the visualizer to the central event bus to receive real-time updates.
     * @param eventBus The `SynchronikEventBus` instance.
     */

    attachToEventBus: (eventBus: SynchronikEventBus) => void;
}

/**
 * Represents a visualizer that can render the execution flow of tasks.
 */
export interface SynchronikEventBus {
    emit: (event: SynchronikEvent) => void;
    subscribe: <T extends SynchronikEvent["type"]>(
        type: T,
        listener: (event: Extract<SynchronikEvent, { type: T }>) => void
    ) => () => void;
    subscribeAll: (listener: (event: SynchronikEvent) => void) => () => void;
}

/** Manages the registration, state updates, and release of units. */
export interface SynchronikLifecycle {
    /**
     * Registers a new unit with the engine.
     * @param unit The unit to register.
     */
    register: (unit: SynchronikUnit) => void;
    /**
     * Updates the state of an existing unit.
     * @param id The ID of the unit to update.
     * @param updates A partial object of properties to update.
     */
    update: (
        id: string,
        updates: Partial<Pick<SynchronikUnit, "status" | "lastRun" | "enabled">>
    ) => void;
    /**
     * Releases a unit from the engine, removing it from the registry.
     * @param id The ID of the unit to release.
     */
    release: (id: string) => void;

    emitMilestone: (
        milestoneId: string,
        payload?: Record<string, unknown>
    ) => void;
}

/**
 * Manages the status of Synchronik units, providing methods to set and retrieve their current state.
 * It integrates with the lifecycle manager and visualizer to ensure status changes are propagated and rendered.
 */
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

/** The engine's main execution loop. */
export interface SynchronikLoop {
    /** Executes a single cycle of the loop, identifying and running eligible units. */
    run: () => Promise<void>;
    /** The strategy used by the loop to execute units (e.g., 'auto', 'parallel', 'sequential'). */
    executionStrategy?: "auto" | "parallel" | "sequential";
}

/** Manages background scanning for stale or paused units. */
export interface UnitWatcher {
    /** Scans all registered units and applies watcher logic (e.g., releasing stale units, unpausing). */
    scan: () => void;
}

/**
 * @export
 * @interface SynchronikManager
 * @typedef {SynchronikManager}
 */
export interface SynchronikManager {
    start: () => void;
    stop: () => Promise<void>;
    registerUnit: (unit: SynchronikUnit) => void;
    releaseUnit: (id: string) => void;
    updateStatus: StatusTracker["setStatus"];
    getRegistrySnapshot: () => SynchronikUnit[];
    onMilestone: (
        handler: (
            milestoneId: string,
            payload?: Record<string, unknown>
        ) => void
    ) => () => void;

    // 🔧 Manual control
    startAll: () => void;
    stopAll: () => void;
    runWorkerById: (workerId: string) => Promise<void>;
    runProcessById: (id: string) => Promise<void>;

    /**
     * Updates the configuration of a registered unit at runtime.
     * @param unitId The ID of the unit to update.
     * @param config A partial object of the unit's properties to update.
     */
    updateUnitConfig: (unitId: string, config: Partial<SynchronikUnit>) => void;

    /**
     * Creates and integrates a worker pool manager.
     * @param poolSize - The number of concurrent workers in the pool.
     */
    useWorkerPool: (poolSize?: number) => WorkerManager;
}

/**
 * An interface for a simple console-based dashboard.
 */
export interface SynchronikDashboard {
    /** Renders a snapshot of the current state of all registered units to the console. */
    render: () => void;
    /** Attaches the dashboard to a Synchronik manager instance to receive events. */
    attachToManager: (manager: SynchronikManager) => void;
    showUnitStatus: (unitId: string) => void;
    showMilestoneArc: (unitId: string) => void;
    triggerBadgeGlow: (unitId: string, badge: string) => void;
}
