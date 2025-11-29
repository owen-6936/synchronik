import type {
    Status,
    MilestoneEmitter,
    ISynchronikEventBus,
    SynchronikProcess,
    SynchronikRegistry,
    SynchronikUnit,
    SynchronikWorker,
    StorageAdapter,
} from "../types/synchronik.js";

/**
 * An in-memory implementation of the SynchronikRegistry that includes reactive
 * status propagation logic. When a worker's status is updated, it automatically
 * re-evaluates and updates the status of its parent process.
 */
export class ReactiveRegistry implements SynchronikRegistry {
    private units = new Map<string, SynchronikUnit>();
    private workers = new Map<string, SynchronikWorker>();
    private processes = new Map<string, SynchronikProcess>();
    private executionTimers = new Map<string, number>();
    private eventBus?: ISynchronikEventBus;
    private storageAdapter?: StorageAdapter | undefined;

    constructor(
        eventBus: ISynchronikEventBus,
        storageAdapter?: StorageAdapter
    ) {
        this.eventBus = eventBus;
        this.storageAdapter = storageAdapter;
    }

    /**
     * Registers a new unit (worker or process) with the registry.
     * @param unit The unit to register.
     */
    registerUnit(unit: SynchronikUnit): void {
        this.units.set(unit.id, unit);
        if ("run" in unit) {
            this.workers.set(unit.id, unit as SynchronikWorker);
        }
        if ("workers" in unit) {
            const process = unit as SynchronikProcess;
            this.processes.set(unit.id, process);
            process.workers.forEach((worker) => this.registerUnit(worker));
        }
    }

    /**
     * Retrieves a unit by its ID.
     * @param id The ID of the unit.
     */
    getUnitById = (id: string): SynchronikUnit | undefined =>
        this.units.get(id);
    /**
     * Retrieves a worker by its ID.
     * @param id The ID of the worker.
     */
    getWorkerById = (id: string): SynchronikWorker | undefined =>
        this.workers.get(id);
    /**
     * Retrieves a process by its ID.
     * @param id The ID of the process.
     */
    getProcessById = (id: string): SynchronikProcess | undefined =>
        this.processes.get(id);
    /**
     * Retrieves all workers associated with a given process.
     * @param processId The ID of the process.
     */
    getWorkersForProcess = (processId: string): SynchronikWorker[] =>
        this.getProcessById(processId)?.workers ?? [];

    /**
     * Updates the state of a unit and triggers reactive side effects, such as event emission and parent process status updates.
     */
    async updateUnitState<T extends SynchronikUnit>(
        id: string,
        updates: Partial<T>,
        _isHydration = false // Add a flag to skip persistence during hydration
    ): Promise<void> {
        const unit = this.units.get(id);
        if (!unit) return;

        // Create a snapshot of configuration properties before the update.
        // We exclude runtime state like 'status' and 'lastRun'.
        const { run: _, ...cloneablePart } = unit as any;
        const configBeforeJson = JSON.stringify(cloneablePart);

        const oldStatus = unit.status;
        Object.assign(unit, updates);
        const newStatus = unit.status; // Get the potentially new status

        // Ensure meta object exists for the lifetime of the unit
        if (!unit.meta) {
            unit.meta = {};
        }

        // --- Execution Speed Calculation ---
        if (newStatus === "running") {
            this.executionTimers.set(id, Date.now());
        } else if (newStatus === "completed" || newStatus === "error") {
            const startTime = this.executionTimers.get(id);

            if (startTime && newStatus === "completed") {
                const duration = Date.now() - startTime;

                if (!Array.isArray(unit.meta.executionTimesMs)) {
                    unit.meta.executionTimesMs = [];
                }

                // Add the new duration to the history
                const times = unit.meta.executionTimesMs as number[];
                times.push(duration);

                // Calculate and store the average execution time
                const totalExecutionTime = times.reduce(
                    (sum, time) => sum + time,
                    0
                );
                unit.meta.averageExecutionTimeMs =
                    totalExecutionTime / times.length;
            }
            this.executionTimers.delete(id); // Clean up timer on completion or error
        }

        // Compare the configuration snapshot to detect any changes.
        const { run: __, ...cloneableUnitAfter } = unit as any; // Exclude the run function for a correct comparison
        const configAfterJson = JSON.stringify(cloneableUnitAfter); // Stringify the cloneable part

        const statusChanged = newStatus && newStatus !== oldStatus;
        const configChanged = configBeforeJson !== configAfterJson;

        if (statusChanged || configChanged) {
            if (this.eventBus) {
                // Determine the primary reason for the update
                const reason = statusChanged
                    ? "status-change"
                    : "config-change";

                // Emit a single, unified 'updated' event
                this.eventBus.emit({
                    type: "updated",
                    unitId: id,
                    payload: {
                        ...unit, // Spread the unit properties first
                        reason, // Then explicitly set our event-specific properties
                        previous: oldStatus,
                        current: newStatus,
                    },
                });

                // Also emit specific lifecycle events if the status changed
                if (statusChanged) {
                    if (newStatus === "running")
                        this.eventBus.emit({ type: "start", unitId: id });
                    if (newStatus === "completed")
                        this.eventBus.emit({ type: "complete", unitId: id });
                    if (newStatus === "error" && updates.error) {
                        this.eventBus.emit({
                            type: "error",
                            unitId: id,
                            error: updates.error as Error,
                        });
                    }
                }
            }
        }

        // --- Integrated Status Logic ---
        // If the updated unit is a worker with a process, trigger process status update.
        const worker = this.workers.get(id);
        if (worker?.processId) {
            this.updateProcessStatus(worker.processId);
        }

        // --- State Persistence ---
        if (this.storageAdapter && !_isHydration) {
            try {
                await this.storageAdapter.saveState(this.listUnits());
            } catch (error) {
                // Log the persistence error but do not crash the application.
                // The in-memory state remains valid.
                console.error("[Synchronik] Failed to save state:", error);
            }
        }
    }

    /**
     * Re-calculates and updates the status of a process based on the current statuses of its workers.
     */
    private updateProcessStatus(processId: string): void {
        const process = this.getProcessById(processId);
        if (!process) return;

        const workers = this.getWorkersForProcess(processId);
        const newProcessStatus = this.calculateProcessStatus(workers);

        if (process.status !== newProcessStatus) {
            const oldStatus = process.status;
            Object.assign(process, { status: newProcessStatus });

            // Also emit a unified 'updated' event for the process status change
            if (this.eventBus) {
                this.eventBus.emit({
                    type: "updated",
                    unitId: processId,
                    payload: {
                        ...process,
                        reason: "status-change",
                        previous: oldStatus,
                        current: newProcessStatus,
                    },
                });
            }
        }
    }

    /**
     * Calculates the aggregate status of a process from its workers' statuses.
     */
    private calculateProcessStatus(workers: SynchronikWorker[]): Status {
        if (workers.length === 0) return "idle";

        const workerStatuses = workers.map((w) => w.status);

        if (workerStatuses.some((s) => s === "error")) return "error";
        if (workerStatuses.some((s) => s === "running")) return "running";
        if (workerStatuses.every((s) => s === "completed")) return "completed";

        return "idle";
    }

    // --- Other required methods ---
    /**
     * Lists all registered units.
     */
    listUnits = (): SynchronikUnit[] => Array.from(this.units.values());
    /**
     * Lists all registered workers.
     */
    listWorkers = (): SynchronikWorker[] => Array.from(this.workers.values());
    /**
     * Lists all registered processes.
     */
    listProcesses = (): SynchronikProcess[] =>
        Array.from(this.processes.values());
    /**
     * Updates the configuration of a process.
     */
    updateProcessConfig = async (
        id: string,
        config: Partial<SynchronikProcess>
    ): Promise<void> => await this.updateUnitState(id, config);
    /**
     * Updates the configuration of a worker.
     */
    updateWorkerConfig = async (
        id: string,
        config: Partial<SynchronikWorker>
    ): Promise<void> => await this.updateUnitState(id, config);
    /**
     * Removes a unit from the registry.
     */
    releaseUnit = (id: string): void => {
        this.units.delete(id);
        this.workers.delete(id);
        this.processes.delete(id);
    };
    getProcessesForWorker = () => []; // Placeholder
    findUnitsByStatus = () => []; // Placeholder
}
