import type {
    Status,
    MilestoneEmitter,
    ISynchronikEventBus,
    SynchronikProcess,
    SynchronikRegistry,
    SynchronikUnit,
    SynchronikWorker,
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
    private milestoneEmitter?: MilestoneEmitter;
    private eventBus?: ISynchronikEventBus;

    constructor(
        milestoneEmitter: MilestoneEmitter,
        eventBus: ISynchronikEventBus
    ) {
        this.milestoneEmitter = milestoneEmitter;
        this.eventBus = eventBus;
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
    getUnitById = (id: string) => this.units.get(id);
    /**
     * Retrieves a worker by its ID.
     * @param id The ID of the worker.
     */
    getWorkerById = (id: string) => this.workers.get(id);
    /**
     * Retrieves a process by its ID.
     * @param id The ID of the process.
     */
    getProcessById = (id: string) => this.processes.get(id);
    /**
     * Retrieves all workers associated with a given process.
     * @param processId The ID of the process.
     */
    getWorkersForProcess = (processId: string) =>
        this.getProcessById(processId)?.workers ?? [];

    /**
     * Updates the state of a unit and triggers reactive side effects, such as event emission and parent process status updates.
     */
    updateUnitState<T extends SynchronikUnit>(
        id: string,
        updates: Partial<T>
    ): void {
        const unit = this.units.get(id);
        if (!unit) return;

        const oldStatus = unit.status;
        Object.assign(unit, updates);
        const newStatus = unit.status;

        // If the status has changed, emit a milestone.
        if (newStatus && newStatus !== oldStatus) {
            if (newStatus === "error" && this.eventBus && updates.error) {
                // Emit a dedicated 'error' event for failures.
                this.eventBus.emit({
                    type: "error",
                    unitId: id,
                    error: updates.error as Error,
                });
            } else if (this.milestoneEmitter) {
                this.milestoneEmitter.emitForUnit(
                    id,
                    String(newStatus),
                    updates
                );
            }
        }

        // --- Integrated Status Logic ---
        // If the updated unit is a worker with a process, trigger process status update.
        const worker = this.workers.get(id);
        if (worker?.processId) {
            this.updateProcessStatus(worker.processId);
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
            // Directly update the process status without causing a recursive loop
            Object.assign(process, { status: newProcessStatus });
            if (this.milestoneEmitter) {
                this.milestoneEmitter.emitForUnit(
                    processId,
                    String(newProcessStatus)
                );
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
    listUnits = () => Array.from(this.units.values());
    /**
     * Lists all registered workers.
     */
    listWorkers = () => Array.from(this.workers.values());
    /**
     * Lists all registered processes.
     */
    listProcesses = () => Array.from(this.processes.values());
    /**
     * Updates the configuration of a process.
     */
    updateProcessConfig = (id: string, config: Partial<SynchronikProcess>) =>
        this.updateUnitState(id, config);
    /**
     * Updates the configuration of a worker.
     */
    updateWorkerConfig = (id: string, config: Partial<SynchronikWorker>) =>
        this.updateUnitState(id, config);
    /**
     * Removes a unit from the registry.
     */
    releaseUnit = (id: string) => {
        this.units.delete(id);
        this.workers.delete(id);
        this.processes.delete(id);
    };
    getProcessesForWorker = () => []; // Placeholder
    findUnitsByStatus = () => []; // Placeholder
}
