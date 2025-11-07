import type { SynchronikRegistry } from "../types/registry.js";
import type {
  SynchronikProcess,
  SynchronikUnit,
  SynchronikWorker,
} from "../types/synchronik.js";

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

    updateUnitState(id, updates) {
      const unit = units.get(id);
      if (!unit) return;

      Object.assign(unit, updates);

      // Optional: update worker/process maps if needed
      if ("run" in unit) workers.set(id, unit as SynchronikWorker);
      if ("workers" in unit) processes.set(id, unit as SynchronikProcess);
    },

    releaseUnit(id) {
      units.delete(id);
      workers.delete(id);
      processes.delete(id);
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
      return Array.from(units.values()).filter((u) => u.status === status);
    },
  };
}
