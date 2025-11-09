import type {
    SynchronikProcess,
    SynchronikUnit,
    SynchronikWorker,
} from "./synchronik.js";

/**
 * An in-memory database that stores and manages the state of all registered units.
 */
export interface SynchronikRegistry {
    /** Registers a new unit, adding it to the internal maps. */
    registerUnit: (unit: SynchronikUnit) => void;
    /** Retrieves a unit by its unique ID. */
    getUnitById: (id: string) => SynchronikUnit | undefined;
    /** Retrieves a worker by its unique ID. */
    getWorkerById: (id: string) => SynchronikWorker | undefined;
    /** Retrieves a process by its unique ID. */
    getProcessById: (id: string) => SynchronikProcess | undefined;

    /** Returns an array of all currently registered units. */
    listUnits: () => SynchronikUnit[];
    /** Returns an array of all currently registered workers. */
    listWorkers: () => SynchronikWorker[];
    /** Returns an array of all currently registered processes. */
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

    /** Removes a unit and its associations from the registry. */
    releaseUnit: (id: string) => void;

    /** Retrieves all workers associated with a specific process ID. */
    getWorkersForProcess: (processId: string) => SynchronikWorker[];
    /** Finds all processes that contain a specific worker ID. */
    getProcessesForWorker: (workerId: string) => SynchronikProcess[];

    /** Returns all units that currently have the specified status. */
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
