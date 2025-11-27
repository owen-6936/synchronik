/**
 * Represents the possible lifecycle statuses of any Synchronik unit.
 */
/**
 * Represents the possible lifecycle statuses of any Synchronik unit.
 */
export type Status =
    | "idle"
    | "running"
    | "error"
    | "completed"
    | "paused"
    | undefined;

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

    /**
     * Retrieves an array of all worker instances currently in the pool.
     * @returns An array of `SynchronikWorker` objects.
     */
    getPoolWorkers(): SynchronikWorker[];

    /**
     * Dynamically adjusts the number of workers in the pool.
     * @param newSize The target number of workers for the pool.
     */
    resize(newSize: number): void;
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
     * An object for storing arbitrary metadata about the unit.
     * The engine uses this to store properties like `runCount`.
     * @default {}
     */
    meta?: Record<string, any>;

    /**
     * Determines how workers within a process are executed.
     * - `parallel`: All workers run concurrently.
     * - `sequential`: Workers run one after another.
     * - `isolated`: Workers run sequentially with a configurable delay. See `isolationDelayMs`.
     * - `batched`: Workers run in concurrent groups of a configurable size. See `batchSize`.
     */
    runMode?: RunMode;

    /**
     * An optional field to store the last encountered error for the unit.
     * This is typically set when the unit's status transitions to 'error'.
     */
    error?: Error | undefined;

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
    run: () => Promise<any>;
    /** The interval in milliseconds at which the worker should be run by the automatic loop. */
    intervalMs?: number;
    /**
     * If true, the worker will be automatically run by the engine's main loop on its schedule.
     * If false or undefined, the worker will only run when manually triggered.
     * @default false
     */
    runOnInterval?: boolean;
    /**
     * The maximum number of times the worker should run on its interval before being disabled.
     * @default Infinity
     */
    maxRuns?: number;
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
    /** The ID of the process this worker belongs to, if any. */
    processId?: string;
    /** The current status of the worker. Unlike other units, this is not optional for a worker. */
    status?: Status;
    /**
     * An array of worker IDs that must be successfully completed before this worker can run.
     * All depended-upon workers must belong to the same process.
     * @default []
     */
    dependsOn?: (string | Dependency)[];
}

/**
 * Defines a conditional dependency between workers.
 */
export interface Dependency {
    /** The ID of the worker that must be completed. */
    id: string;
    /**
     * An optional function that evaluates the result of the parent worker.
     * If the function returns `false`, this dependency is considered unmet, and the current worker will be skipped.
     */
    condition?: (result: any) => boolean;
}

/**
 * Represents a collection of `SynchronikWorker` instances grouped into a single, manageable workflow.
 * A process defines how its workers are executed via its `runMode`.
 */
export interface SynchronikProcess extends SynchronikUnit {
    status?: Status;
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
 * Updates the configuration of a registered unit at runtime.
 * @param workerId The ID of the unit to update.
 * @param config A partial object of the unit's properties to update.
 */
export type UpdateWorkerConfig<T extends SynchronikUnit> = (
    workerId: string,
    config: Partial<T>
) => void;

/**
 * Updates the configuration of a registered process at runtime.
 * @param processId The ID of the process to update.
 * @param config A partial object of the process's properties to update
 */
export type UpdateProcessConfig<T extends SynchronikProcess> = (
    processId: string,
    config: Partial<T>
) => void;

/**
 * The primary public interface for interacting with the Synchronik engine.
 */
export interface SynchronikManager {
    // Core registration and control
    /**
     * Registers a new unit with the engine.
     * @param unit The unit to register.
     */
    registerUnit: (unit: SynchronikUnit) => void;

    /**
     * Sets all registered units to an 'idle' status, effectively enabling them for execution.
     */
    startAll: () => void;
    /**
     * Sets all registered units to a 'paused' status, preventing them from being executed.
     */
    stopAll: () => void;

    // Execution

    /**
     * Executes a single worker by its ID.
     * @param id The ID of the worker to run.
     */
    runWorkerById: (workerId: string) => Promise<void>;

    /**
     * Executes a process and all of its associated workers according to its `runMode`.
     * @param id The ID of the process to run.
     */
    runProcessById: (processId: string) => Promise<void>;
    /**
     * Stops a specific worker by setting its `enabled` flag to `false`.
     * @param workerId The ID of the worker to stop.
     */
    stopWorkerById: (workerId: string) => void;
    /**
     * Disables a specific unit, preventing it from being executed.
     * @param id The ID of the unit to disable.
     * @deprecated Use disableWorker or disableProcess instead.
     */
    disableUnit: (id: string) => void;
    /**
     * Enables a specific unit, allowing it to be executed.
     * @param id The ID of the unit to enable.
     * @deprecated Use enableWorker or enableProcess instead.
     */
    enableUnit: (id: string) => void;
    /**
     * Enables a specific worker, allowing it to be executed.
     * @param id The ID of the worker to enable.
     */
    enableWorker: (workerId: string) => void;
    /**
     * Disables a specific worker, preventing it from being executed.
     * @param id The ID of the worker to disable.
     */
    disableWorker: (workerId: string) => void;
    /**
     * Enables a specific process, allowing it to be executed.
     * @param id The ID of the process to enable.
     */
    enableProcess: (processId: string) => void;
    /**
     * Disables a specific process, preventing it from being executed.
     * @param id The ID of the process to disable.
     */
    disableProcess: (processId: string) => void;

    /**
     * Retrieves the current status of a unit (e.g., 'idle', 'running').
     * @param id The ID of the unit.
     */
    getUnitStatus: (id: string) => SynchronikUnit["status"];
    /**
     * Lists all registered units (both workers and processes).
     * @returns An array of all `SynchronikUnit` objects.
     */
    listUnits: () => SynchronikUnit[];

    /**
     * Lists all registered workers.
     * @returns An array of all `SynchronikWorker` objects.
     */
    listWorkers?: () => SynchronikWorker[];
    /**
     * Lists all registered processes.
     * @returns An array of all `SynchronikProcess` objects.
     */
    listProcesses?: () => SynchronikProcess[];

    // 🎯 Milestone broadcasting
    /**
     * Emits a custom milestone event.
     * @param id A unique identifier for the milestone.
     * @param payload Optional data to include with the milestone.
     */
    emitMilestone: (
        milestoneId: string,
        payload?: Record<string, unknown>
    ) => void;

    // 📡 Real-time event subscription

    /**
     * Subscribes to all events emitted by the engine's event bus.
     * @param listener A function that will be called with every `SynchronikEvent`.
     * @returns An `unsubscribe` function to stop listening.
     */
    subscribeToEvents: (
        listener: (event: SynchronikEvent) => void
    ) => () => void; // returns unsubscribe function

    /** Starts the engine's background processes (main loop and watcher). */
    start: () => void;

    /**
     * Gracefully stops the engine. It clears the background intervals and attempts to complete any in-progress work before exiting.
     */
    stop: () => Promise<void>;

    // Unit Management
    releaseUnit: (id: string) => void;
    /**
     * Manually sets the status of a unit.
     * @param unitId The ID of the unit to update.
     * @param status The new status to set.
     * @param options Optional parameters, including a payload for the emitted milestone.
     */
    updateStatus: (
        unitId: string,
        status: Status,
        options?: { payload?: Record<string, unknown> }
    ) => void;

    /**
     * Returns a snapshot of all units currently in the registry.
     * @returns An array of `SynchronikUnit` objects.
     */
    getRegistrySnapshot: () => SynchronikUnit[];

    /**
     * Updates the configuration of a registered process at runtime.
     * @param processId The ID of the process to update.
     * @param config A partial object of the process's properties to update.
     */
    updateProcessConfig: UpdateProcessConfig<SynchronikProcess>;
    /**
     * Updates the configuration of a registered worker at runtime.
     * @param workerId The ID of the worker to update.
     * @param config A partial object of the worker's properties to update.
     */
    updateWorkerConfig: UpdateWorkerConfig<SynchronikWorker>;

    /**
     * Creates and integrates a worker pool manager.
     * @param poolSize - The number of concurrent workers in the pool.
     */
    useWorkerPool: (poolSize?: number) => WorkerManager;

    /**
     * Subscribes to 'milestone' events.
     * @param handler A function to be called when a milestone is emitted.
     * @returns An `unsubscribe` function.
     */
    onMilestone: (
        handler: (
            milestoneId: string,
            payload?: Record<string, unknown>
        ) => void
    ) => () => void;

    /**
     * Retrieves a snapshot of the engine's current resource consumption.
     * This includes memory usage for the Node.js process and raw CPU time.
     *
     * @returns An object containing memory and CPU usage statistics.
     * @property memory - Memory usage statistics formatted as strings in MB.
     * @property memory.rss - "Resident Set Size", the total memory allocated for the process in physical RAM.
     * @property memory.heapTotal - The total size of the V8 memory heap.
     * @property memory.heapUsed - The actual memory being used by the application's objects. This is useful for tracking potential memory leaks.
     * @property memory.external - Memory used by C++ objects bound to JavaScript objects managed by V8.
     * @property cpu - The CPU usage percentage since the last time this method was called. The first call will return "0.00%".
     *
     * @example
     * const stats = manager.getEngineStats();
     * console.log(stats);
     * // {
     * //   memory: {
     * //     rss: "45.12 MB",
     * //     heapTotal: "8.50 MB",
     * //     heapUsed: "5.73 MB",
     * //     external: "1.02 MB"
     * //   },
     * //   cpu: "12.34%"
     * // }
     */
    getEngineStats: () => {
        memory: {
            rss: string;
            heapTotal: string;
            heapUsed: string;
            external: string;
        };
        cpu: string;
    };
}

/**
 * An in-memory database that stores and manages the state of all registered units.
 */
export interface SynchronikRegistry {
    /**
     * Registers a new unit with the engine.
     * This adds it to the appropriate internal data structures (units, workers, processes).
     * @param unit The unit to register.
     */
    registerUnit: (unit: SynchronikUnit) => void;
    /**
     * Retrieves a unit by its ID.
     * @param id The ID of the unit to retrieve.
     * @returns The unit, or undefined if not found.
     */
    getUnitById: (id: string) => SynchronikUnit | undefined;
    /**
     * Retrieves a worker by its ID.
     * @param id The ID of the worker to retrieve.
     * @returns The worker, or undefined if not found.
     */
    getWorkerById: (id: string) => SynchronikWorker | undefined;
    /**
     * Retrieves a process by its ID.
     * @param id The ID of the process to retrieve.
     * @returns The process, or undefined if not found.
     */
    getProcessById: (id: string) => SynchronikProcess | undefined;

    /**
     * Lists all currently registered units.
     * @returns An array of all Synchronik units.
     */
    listUnits: () => SynchronikUnit[];
    /** List all currently registered workers.
     * @returns An array of all Synchronik Workers.
     */
    listWorkers: () => SynchronikWorker[];
    /** List all currently registered processes.
     *  @returns An array of all Synchronik Processes.
     */
    listProcesses: () => SynchronikProcess[];

    /**
     * Merges a partial configuration into an existing unit's state.
     * @param id The ID of the unit to update.
     * @param updates A partial object of the unit's properties to update.
     */
    updateUnitState: <T extends SynchronikUnit>(
        id: string,
        updates: Partial<T>
    ) => void;

    /**
     * Updates the configuration of a registered process at runtime.
     * @param processId The ID of the process to update.
     * @param config A partial object of the process's properties to update
     */
    updateProcessConfig: UpdateProcessConfig<SynchronikProcess>;
    /**
     * Updates the configuration of a registered unit at runtime.
     * @param workerId The ID of the unit to update.
     * @param config A partial object of the unit's properties to update.
     */
    updateWorkerConfig: UpdateWorkerConfig<SynchronikWorker>;

    /** Removes a unit and its associations from the registry.
     *  @param id The ID of the unit to release
     */
    releaseUnit: (id: string) => void;

    /** Retrieves all workers associated with a specific process ID.
     * @param processId The id of the process.
     * @returns An array of the process workers.
     */
    getWorkersForProcess: (processId: string) => SynchronikWorker[];
    /** Finds all processes that contain a specific worker ID.
     * @param The ID of the worker.
     * @returns An array of processes the worker is currently attached to.
     */
    getProcessesForWorker: (workerId: string) => SynchronikProcess[];

    /** Returns all units that currently have the specified status.
     *  @param status The status of the unit to find, e.g "idle", "error"...
     *  @returns The array of Synchronik units with that status specified.
     */
    findUnitsByStatus: (status: SynchronikUnit["status"]) => SynchronikUnit[];
}

/**
 * Represents the internal state of the registry, containing maps of all units.
 */
export type RegistryState = {
    /** A map of all units, keyed by their ID. */
    units: Map<string, SynchronikUnit>;
    /** A map of all processes, keyed by their ID. */
    processes: Map<string, SynchronikProcess>;
    /** A map of all workers, keyed by their ID. */
    workers: Map<string, SynchronikWorker>;
};

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
    /**
     * Emits a generic milestone event.
     * @param milestoneId A unique identifier for the milestone.
     * @param payload Optional data to include with the event.
     */
    emit: (milestoneId: string, payload?: Record<string, unknown>) => void;
    /**
     * Emits a milestone event specifically for a unit's lifecycle stage (e.g., 'completed', 'released').
     * @param unitId The ID of the unit.
     * @param stage The lifecycle stage (e.g., 'completed', 'released').
     * @param payload Optional data to include with the event.
     */
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

    attachToEventBus: (eventBus: ISynchronikEventBus) => void;
}

/**
 * Represents a visualizer that can render the execution flow of tasks.
 */
export interface ISynchronikEventBus {
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
        updates: Partial<
            Pick<SynchronikUnit, "status" | "lastRun" | "enabled">
        > & { error?: Error | undefined }
    ) => void;
    /**
     * Releases a unit from the engine, removing it from the registry.
     * @param id The ID of the unit to release.
     */
    release: (id: string) => void;
    /**
     * Emits a custom milestone event.
     * @param milestoneId A unique identifier for the milestone.
     * @param payload Optional data to include with the milestone.
     */
    emitMilestone: (
        milestoneId: string,
        payload?: Record<string, unknown>
    ) => void;
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
