type Status = "idle" | "running" | "error" | "completed" | "paused";
interface Task {
    arrangementId: number;
    name: string;
    status?: Status;
    payload?: any;
    execute: () => Promise<void | any>;
}
interface WorkerStatus {
    currentTask?: string | undefined;
    progress?: number;
    lastMilestone?: string | undefined;
    isIdle: boolean;
}
interface WorkerManager {
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
    updateTask(taskName: string, updates: Partial<Omit<Task, "arrangementId" | "name">>): void;
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
    getWorkerStatus(workerId: string): WorkerStatus | undefined;
}
type RunMode = "parallel" | "sequential" | "batched" | "isolated";
interface SynchronikUnit {
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
    onStart?: () => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
}
interface SynchronikWorker extends SynchronikUnit {
    run: () => Promise<void>;
    intervalMs?: number;
    timeoutMs?: number;
    maxRetries?: number;
    task?: string | undefined;
    processId?: string;
}
interface SynchronikProcess extends SynchronikUnit {
    workers: SynchronikWorker[];
    runAll?: () => Promise<void>;
}
type SynchronikEvent = {
    type: "start";
    unitId: string;
} | {
    type: "complete";
    unitId: string;
} | {
    type: "error";
    unitId: string;
    error: Error;
} | {
    type: "milestone";
    milestoneId: string;
    payload?: Record<string, unknown>;
};
interface SynchronikVisualizer {
    renderUnitStatus: (unitId: string, status: SynchronikUnit["status"], message?: string) => void;
    renderMilestone: (milestoneId: string, payload?: Record<string, unknown>, message?: string) => void;
    renderUnitMode?: (unitId: string, mode: RunMode) => void;
    attachToEventBus: (eventBus: SynchronikEventBus) => void;
}
interface SynchronikEventBus {
    emit: (event: SynchronikEvent) => void;
    subscribe: <T extends SynchronikEvent["type"]>(type: T, listener: (event: Extract<SynchronikEvent, {
        type: T;
    }>) => void) => () => void;
    subscribeAll: (listener: (event: SynchronikEvent) => void) => () => void;
}
interface StatusTracker {
    setStatus: (unitId: string, status: SynchronikUnit["status"], options?: {
        emitMilestone?: boolean;
        payload?: Record<string, unknown>;
    }) => void;
    getStatus: (unitId: string) => SynchronikUnit["status"];
}
interface SynchronikManager {
    registerUnit: (unit: SynchronikUnit) => void;
    startAll: () => void;
    stopAll: () => void;
    runWorkerById: (workerId: string) => Promise<void>;
    runProcessById: (processId: string) => Promise<void>;
    getUnitStatus: (id: string) => SynchronikUnit["status"];
    listUnits: () => SynchronikUnit[];
    listWorkers?: () => SynchronikWorker[];
    listProcesses?: () => SynchronikProcess[];
    emitMilestone: (milestoneId: string, payload?: Record<string, unknown>) => void;
    subscribeToEvents: (listener: (event: SynchronikEvent) => void) => () => void;
}
interface SynchronikManager {
    start: () => void;
    stop: () => Promise<void>;
    registerUnit: (unit: SynchronikUnit) => void;
    releaseUnit: (id: string) => void;
    updateStatus: StatusTracker["setStatus"];
    getRegistrySnapshot: () => SynchronikUnit[];
    onMilestone: (handler: (milestoneId: string, payload?: Record<string, unknown>) => void) => () => void;
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
interface SynchronikDashboard {
    render: () => void;
    attachToManager: (manager: SynchronikManager) => void;
    showUnitStatus: (unitId: string) => void;
    showMilestoneArc: (unitId: string) => void;
    triggerBadgeGlow: (unitId: string, badge: string) => void;
}

declare function createSynchronikManager(): SynchronikManager;

/**
 * Creates a simple console-based dashboard for visualizing the state of the Synchronik engine.
 * It can be attached to a manager instance to listen for events and render updates.
 *
 * @returns A `SynchronikDashboard` instance.
 */
declare function createSynchronikDashboard(): SynchronikDashboard;

export { type SynchronikEvent, type SynchronikManager, type SynchronikProcess, type SynchronikUnit, type SynchronikVisualizer, type SynchronikWorker, type Task, createSynchronikDashboard, createSynchronikManager };
