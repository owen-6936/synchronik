import type {
    WorkerManager,
    Task,
    WorkerStatus,
    SynchronikWorker,
} from "../types/synchronik.js";
/**
 * @class SynchronikWorkerManager
 * @implements {WorkerManager}
 *
 * A higher-level manager for orchestrating workers based on their capabilities and assigned tasks.
 * This class provides a layer of abstraction on top of the core Synchronik engine,
 * focusing on task assignment and status tracking in a capability-driven workflow.
 */

export class SynchronikWorkerManager implements WorkerManager {
    private pendingTasks: Task[] = [];
    private idleWorkers: SynchronikWorker[] = [];
    private activeWorkers = new Map<string, SynchronikWorker>();
    private arrangementCounter = 1;
    private loopInterval: NodeJS.Timeout | null = null;
    private executor: (workerId: string) => Promise<void> = async () => {};
    private mainManager: {
        registerUnit: (unit: SynchronikWorker) => void;
        releaseUnit: (id: string) => void;
    } | null = null;

    constructor(poolSize: number = 2) {
        for (let i = 0; i < poolSize; i++) {
            const workerId = `pool-worker-${i + 1}`;
            const worker: SynchronikWorker = {
                id: workerId,
                name: `Pool Worker ${i + 1}`,
                enabled: true,
                status: "idle",
                run: async () => {}, // Placeholder, will be replaced by task's execute
            };
            this.idleWorkers.push(worker);
            this.activeWorkers.set(workerId, worker); // Keep track of all workers
        }
    }

    /**
     * Injects the execution function from the core manager.
     * @param executor - The function to run a worker by its ID.
     */
    setExecutor(
        executor: (workerId: string) => Promise<void>,
        mainManager: {
            registerUnit: (unit: SynchronikWorker) => void;
            releaseUnit: (id: string) => void;
        }
    ): void {
        this.executor = executor;
        this.mainManager = mainManager;
    }

    getPoolWorkers(): SynchronikWorker[] {
        return Array.from(this.activeWorkers.values());
    }

    /**
     * Adds a new task to the manager, assigning it a unique arrangementId.
     * @param {Omit<Task, "arrangementId">} taskData - The task data without an arrangementId.
     * @returns {Task | null} The full Task object with its new arrangementId, or null if the name is a duplicate.
     */
    addTask(taskData: Omit<Task, "arrangementId">): Task | null {
        if (this.pendingTasks.some((t) => t.name === taskData.name)) {
            console.warn(`Task with name "${taskData.name}" already exists.`);
            return null;
        }

        const newTask: Task = {
            ...taskData,
            arrangementId: this.arrangementCounter++,
            status: "idle",
        };

        this.pendingTasks.push(newTask);
        this.pendingTasks.sort((a, b) => a.arrangementId - b.arrangementId); // Keep sorted
        return newTask;
    }

    /**
     * Updates an existing task's properties.
     * @param {string} taskName - The name of the task to update.
     * @param {Partial<Omit<Task, "arrangementId" | "name">>} updates - The properties to update.
     */
    updateTask(
        taskName: string,
        updates: Partial<Omit<Task, "arrangementId" | "name">>
    ): void {
        const task = this.pendingTasks.find((t) => t.name === taskName);
        if (!task) {
            console.error(`Cannot update: Task "${taskName}" not found.`);
            return;
        }
        // Merge updates into the existing task
        Object.assign(task, updates);
    }

    /**
     * Pauses a pending task. All tasks with a higher arrangementId will wait.
     * @param {string} taskName - The name of the task to pause.
     */
    pauseTask(taskName: string): void {
        const task = this.pendingTasks.find((t) => t.name === taskName);
        if (task && task.status === "idle") {
            task.status = "paused";
        } else {
            console.warn(
                `Cannot pause: Task "${taskName}" is not pending or idle.`
            );
        }
    }

    /**
     * Resumes a paused task.
     * @param {string} taskName - The name of the task to resume.
     */
    resumeTask(taskName: string): void {
        const task = this.pendingTasks.find((t) => t.name === taskName);
        if (task && task.status === "paused") {
            task.status = "idle";
        } else {
            console.warn(`Cannot resume: Task "${taskName}" is not paused.`);
        }
    }

    /**
     * Cancels and removes a pending task from the queue.
     * @param {string} taskName - The name of the task to cancel.
     */
    cancelTask(taskName: string): void {
        const initialLength = this.pendingTasks.length;
        this.pendingTasks = this.pendingTasks.filter(
            (t) => t.name !== taskName
        );
        if (this.pendingTasks.length === initialLength) {
            console.warn(
                `Cannot cancel: Task "${taskName}" not found in pending queue.`
            );
        }
    }

    /**
     * Starts the worker manager's loop to assign tasks to idle workers.
     */
    start(): void {
        if (this.loopInterval) return; // Already running

        this.loopInterval = setInterval(() => {
            if (this.pendingTasks.length > 0 && this.idleWorkers.length > 0) {
                // Implement cascading pause: if the highest priority task is paused, wait.
                if (
                    this.pendingTasks[0] &&
                    this.pendingTasks[0].status === "paused"
                ) {
                    return;
                }

                const task = this.pendingTasks.shift(); // Get the highest priority task
                const worker = this.idleWorkers.shift(); // Get an idle worker

                if (task && worker) {
                    this.executeTask(worker, task);
                }
            }
        }, 10); // Check for work every 10ms
    }

    /**
     * Stops the worker manager's loop.
     */
    stop(): void {
        if (this.loopInterval) {
            clearInterval(this.loopInterval);
            this.loopInterval = null;
        }
    }

    /**
     * Simulates the execution flow of pending tasks.
     * @returns {string} A string describing the ordered sequence of tasks.
     */
    simulateRun(): string {
        if (this.pendingTasks.length === 0) {
            return "No tasks pending for execution.";
        }

        const sequence = this.pendingTasks
            .map((task, index) => `${index + 1}. ${task.name}`)
            .join(", ");

        return `Execution sequence: ${sequence}`;
    }

    /**
     * Dynamically adjusts the number of workers in the pool.
     * @param newSize The target number of workers for the pool.
     */
    resize(newSize: number): void {
        const currentSize = this.activeWorkers.size;

        if (newSize > currentSize) {
            // Scale up: Add new workers
            for (let i = currentSize; i < newSize; i++) {
                const workerId = `pool-worker-${i + 1}`;
                const worker: SynchronikWorker = {
                    id: workerId,
                    name: `Pool Worker ${i + 1}`,
                    enabled: true,
                    status: "idle",
                    run: async () => {}, // Placeholder
                };
                this.idleWorkers.push(worker);
                this.activeWorkers.set(workerId, worker);
                this.mainManager?.registerUnit(worker);
                console.log(
                    `[Worker Pool] Scaled up. Added worker: ${workerId}`
                );
            }
        } else if (newSize < currentSize) {
            // Scale down: Remove idle workers
            const workersToRemove = currentSize - newSize;
            for (let i = 0; i < workersToRemove; i++) {
                // Remove from the end of the idle list to avoid disrupting active tasks
                const workerToRemove = this.idleWorkers.pop();
                if (workerToRemove) {
                    this.activeWorkers.delete(workerToRemove.id);
                    this.mainManager?.releaseUnit(workerToRemove.id);
                    console.log(
                        `[Worker Pool] Scaled down. Removed worker: ${workerToRemove.id}`
                    );
                } else {
                    // Not enough idle workers to remove immediately.
                    console.warn(
                        "[Worker Pool] Scale-down requested, but no idle workers are available to remove."
                    );
                    break; // Stop trying to remove more workers
                }
            }
        }
    }

    private async executeTask(worker: SynchronikWorker, task: Task) {
        worker.status = "running";
        worker.task = task.name;
        task.status = "running";
        // The worker's run function is temporarily replaced with the task's execute logic.
        worker.run = task.execute;

        // Use the core manager's executor.
        await this.executor(worker.id);

        // The core manager will handle status updates, so we just return the worker to the pool.
        worker.status = "idle";
        worker.task = undefined;
        this.idleWorkers.push(worker);
    }

    getWorkerStatus(workerId: string): WorkerStatus | undefined {
        const worker = this.activeWorkers.get(workerId);
        if (!worker) {
            return undefined;
        }

        return {
            currentTask: worker.task || undefined,
            lastMilestone: undefined, // This should be retrieved from the core event system
            isIdle: worker.status === "idle",
        };
    }

    // This method is no longer needed as workers are not generated on the fly.
    generateWorkers(): SynchronikWorker[] {
        return Array.from(this.activeWorkers.values());
    }
}
