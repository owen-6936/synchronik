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

        getUnitById(id) {
            return units.get(id);
        },

        getWorkerById(id) {
            return workers.get(id);
        },

        getProcessById(id) {
            return processes.get(id);
        },

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
