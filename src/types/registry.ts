import type {
  SynchronikProcess,
  SynchronikUnit,
  SynchronikWorker,
} from "./synchronik.js";

export interface SynchronikRegistry {
  registerUnit: (unit: SynchronikUnit) => void;
  getUnitById: (id: string) => SynchronikUnit | undefined;
  getWorkerById: (id: string) => SynchronikWorker | undefined;
  getProcessById: (id: string) => SynchronikProcess | undefined;

  listUnits: () => SynchronikUnit[];
  listWorkers: () => SynchronikWorker[];
  listProcesses: () => SynchronikProcess[];

  updateUnitState: (
    id: string,
    updates: Partial<Pick<SynchronikUnit, "status" | "lastRun" | "enabled">>
  ) => void;

  releaseUnit: (id: string) => void;

  getWorkersForProcess: (processId: string) => SynchronikWorker[];
  getProcessesForWorker: (workerId: string) => SynchronikProcess[];

  findUnitsByStatus: (status: SynchronikUnit["status"]) => SynchronikUnit[];
}

export type RegistryState = {
  units: Map<string, SynchronikUnit>;
  processes: Map<string, SynchronikProcess>;
  workers: Map<string, SynchronikWorker>;
};
