import type {
    SynchronikProcess,
    SynchronikRegistry,
    SynchronikUnit,
    SynchronikWorker,
} from "../types/synchronik.js";
/**
 * Creates a registry for managing Synchronik units (workers and processes).
 * The registry stores and provides access to all registered units.
 * @returns A `SynchronikRegistry` instance.
 */

export function createSynchronikRegistry(): SynchronikRegistry {
    const units = new Map<string, SynchronikUnit>();
    const workers = new Map<string, SynchronikWorker>();
    const processes = new Map<string, SynchronikProcess>();

    return {
        /**
         * Registers a new unit with the engine.
         * This adds it to the appropriate internal data structures (units, workers, processes).
         * @param unit The unit to register.
         */
        registerUnit(unit) {
            units.set(unit.id, unit);

            if ("run" in unit) {
                workers.set(unit.id, unit as SynchronikWorker);
            }

            if ("workers" in unit) {
                processes.set(unit.id, unit as SynchronikProcess);

                for (const worker of (unit as SynchronikProcess).workers) {
                    units.set(worker.id, worker);
                    workers.set(worker.id, worker);
                }
            }
        },

        /**
         * Retrieves a unit by its ID.
         * @param id The ID of the unit to retrieve.
         * @returns The unit, or undefined if not found.
         */
        getUnitById(id) {
            return units.get(id);
        },

        /**
         * Retrieves a worker by its ID.
         * @param id The ID of the worker to retrieve.
         * @returns The worker, or undefined if not found.
         */
        getWorkerById(id) {
            return workers.get(id);
        },

        /**
         * Retrieves a process by its ID.
         * @param id The ID of the process to retrieve.
         * @returns The process, or undefined if not found.
         */
        getProcessById(id) {
            return processes.get(id);
        },

        /**
         * Lists all currently registered units.
         * @returns An array of all Synchronik units.
         */
        listUnits() {
            return Array.from(units.values());
        },

        listWorkers() {
            return Array.from(workers.values());
        },

        listProcesses() {
            return Array.from(processes.values());
        },

        updateUnitState<T extends SynchronikUnit>(
            /**
             * Updates the state of an existing unit.
             * @param id The ID of the unit to update.
             * @param updates A partial object of properties to update.
             */
            id: string,
            updates: Partial<T>
        ) {
            const unit = units.get(id);
            if (!unit) return;

            Object.assign(unit, updates);

            // Optional: update worker/process maps if needed
            if ("run" in unit) workers.set(id, unit as SynchronikWorker);
            if ("workers" in unit) processes.set(id, unit as SynchronikProcess);
        },

        updateWorkerConfig(workerId, config) {
            const worker = workers.get(workerId);
            if (!worker) return;

            Object.assign(worker, config);
            workers.set(workerId, worker);
        },
        updateProcessConfig(processId, config) {
            const process = processes.get(processId);
            if (!process) return;

            Object.assign(process, config);
            processes.set(processId, process);
        },

        releaseUnit(id) {
            const unit = units.get(id);
            if (!unit) return;

            units.delete(id);
            workers.delete(id);
            processes.delete(id);

            if ("workers" in unit) {
                for (const worker of (unit as SynchronikProcess).workers) {
                    units.delete(worker.id);
                    workers.delete(worker.id);
                }
            }
        },
        getWorkersForProcess(processId) {
            const process = processes.get(processId);
            return process?.workers ?? [];
        },

        getProcessesForWorker(workerId) {
            return Array.from(processes.values()).filter((p) =>
                p.workers.some((w) => w.id === workerId)
            );
        },

        findUnitsByStatus(status) {
            return Array.from(units.values()).filter(
                (u) => u.status === status
            );
        },
    };
}
