import type {
    SynchronikEvent,
    SynchronikLoop,
    SynchronikManager,
    SynchronikProcess,
    SynchronikRegistry,
    SynchronikUnit,
    SynchronikWorker,
    WorkerManager,
} from "../types/synchronik.js";
import { createMilestoneEmitter, SynchronikEventBus } from "./event.js";
import { createSynchronikLifecycle } from "./lifecycle.js";
import { createSynchronikLoop } from "./loop.js";
import { ReactiveRegistry } from "./ReactiveRegistry.js";
import { SynchronikWorkerManager } from "./workers-manager.js";
import { createSynchronikVisualizer } from "./visualizer.js";
import { createUnitWatcher } from "./watcher.js";
import {
    executeWorkersByRunMode,
    executeWorkerWithRetry,
} from "../utils/run-mode.js";

/**
 * Creates and initializes a new SynchronikManager instance.
 * This is the main entry point for creating and controlling the orchestration engine.
 * @returns A `SynchronikManager` instance with a full API for managing workflows.
 * @param options Configuration options for the manager.
 * @param options.loopInterval The interval in milliseconds at which the main execution loop runs. @default 1000
 * @param options.watcherInterval The interval in milliseconds at which the unit watcher runs. @default 60000
 */
export function createSynchronikManager(options?: {
    loopInterval?: number;
    watcherInterval?: number;
}): SynchronikManager {
    /**

     * ----------------------------------------------------------------
     * Core Component Initialization
     * ----------------------------------------------------------------
     * All core modules of the Synchronik engine are instantiated here.
     */
    const loopIntervalMs = options?.loopInterval ?? 1000;
    const watcherIntervalMs = options?.watcherInterval ?? 60 * 1000;

    const eventBus = new SynchronikEventBus();
    const milestoneEmitter = createMilestoneEmitter(eventBus);
    const registry: SynchronikRegistry = new ReactiveRegistry(
        milestoneEmitter,
        eventBus
    );

    const lifecycle = createSynchronikLifecycle(
        registry,
        eventBus,
        milestoneEmitter
    );
    const visualizer = createSynchronikVisualizer();
    const loop: SynchronikLoop = createSynchronikLoop(registry);
    const watcher = createUnitWatcher(registry, lifecycle, {
        idleThresholdMs: 10 * 60 * 1000,
        autoUnpause: true,
    });

    // Connect the visualizer to the event bus to render real-time updates.
    visualizer.attachToEventBus(eventBus);

    /**

     * ----------------------------------------------------------------
     * Interval Management
     * ----------------------------------------------------------------
     * These variables hold the interval IDs for the main execution
     * loop and the unit watcher, allowing them to be started and stopped.
     */
    let loopInterval: NodeJS.Timeout | null = null;
    let watcherInterval: NodeJS.Timeout | null = null;

    const managerApi: SynchronikManager = {
        /**
         * Starts the engine's background processes, including the main execution loop and the unit watcher.
         */
        start() {
            loopInterval = setInterval(() => loop.run(), loopIntervalMs);
            watcherInterval = setInterval(
                () => watcher.scan(),
                watcherIntervalMs
            );
        },

        /**
         * Gracefully stops the engine. It clears the background intervals and attempts to complete any in-progress work before exiting.
         */
        async stop() {
            if (loopInterval) clearInterval(loopInterval);
            if (watcherInterval) clearInterval(watcherInterval);

            const processes = registry.listProcesses();

            for (const process of processes) {
                if (process.status === "paused") continue;

                registry.updateUnitState(process.id, { status: "running" });

                for (const worker of process.workers) {
                    if (
                        worker.status === "paused" ||
                        !worker.enabled ||
                        worker.status === "idle"
                    )
                        continue;

                    registry.updateUnitState(worker.id, {
                        status: "running",
                    });

                    try {
                        await worker.run();
                        registry.updateUnitState(worker.id, {
                            status: "completed",
                        });
                    } catch (err) {
                        registry.updateUnitState(worker.id, {
                            status: "error",
                            error: err as Error,
                        });
                    }
                }

                registry.updateUnitState(process.id, {
                    status: "completed",
                });
            }
        },

        /**
         * Sets all registered units to an 'idle' status, effectively enabling them for execution.
         */
        startAll() {
            for (const unit of registry.listUnits()) {
                if (unit.status === "paused") {
                    lifecycle.update(unit.id, { status: "idle" });
                }
            }
        },

        /**
         * Sets all registered units to a 'paused' status, preventing them from being executed.
         */
        stopAll() {
            for (const unit of registry.listUnits()) {
                lifecycle.update(unit.id, { status: "paused" });
            }
        },

        /**
         * Executes a single worker by its ID.
         * @param id The ID of the worker to run.
         */
        async runWorkerById(id) {
            const worker = registry.getWorkerById(id);
            if (!worker) {
                return;
            }

            try {
                await executeWorkerWithRetry(worker, registry);
            } catch {
                // The error is already handled and logged by executeWorkerWithRetry, so we just catch it here to prevent it from crashing the test.
            }
        },

        /**
         * Executes a process and all of its associated workers according to its `runMode`.
         * @param id The ID of the process to run.
         */
        async runProcessById(id) {
            const process = registry.getProcessById(id);
            if (!process || process.status === "paused") return;

            registry.updateUnitState(id, { status: "running" });
            milestoneEmitter.emitForUnit(id, "running", {
                runMode: process.runMode ?? "sequential",
            });

            const workers = process.workers.filter((w) => w.enabled);

            await executeWorkersByRunMode({
                workers,
                process,
                execute: async (worker) => {
                    try {
                        const result = await executeWorkerWithRetry(
                            worker,
                            registry,
                            {
                                processId: process.id,
                            }
                        );

                        // After the manual run, handle the run count and disable if maxRuns is reached.
                        if (worker.status === "completed") {
                            const newRunCount =
                                (worker.meta?.runCount ?? 0) + 1;
                            const newMeta = {
                                ...worker.meta,
                                runCount: newRunCount,
                            };

                            // Update the registry with the new meta object
                            registry.updateUnitState(worker.id, {
                                meta: newMeta,
                            });

                            if (
                                worker.maxRuns &&
                                newRunCount >= worker.maxRuns
                            ) {
                                lifecycle.update(worker.id, { enabled: false });
                            } else if (worker.runOnInterval) {
                                registry.updateUnitState(worker.id, {
                                    lastRun: undefined as any,
                                });
                            }
                        }
                        return result;
                    } catch (error) {
                        // Catch errors from individual workers to allow the process to continue (e.g., for batched mode)
                        return Promise.reject(error); // Propagate rejection so graph can handle it
                    }
                },
            });

            registry.updateUnitState(id, { status: "completed" });
            milestoneEmitter.emitForUnit(id, "completed", {
                runMode: process.runMode ?? "sequential",
            });
        },

        /**
         * Disables a specific unit, preventing it from being executed.
         * @param id The ID of the unit to disable.
         * @deprecated Use disableWorker or disableProcess instead.
         */
        disableUnit: (id) => lifecycle.update(id, { enabled: false }),
        /**
         * Disables a specific worker, preventing it from being executed.
         * @param id The ID of the worker to disable.
         */
        disableWorker: (id) => lifecycle.update(id, { enabled: false }),
        /**
         * Disables a specific process, preventing it from being executed.
         * @param id The ID of the process to disable.
         */
        disableProcess: (id) => lifecycle.update(id, { enabled: false }),

        /**
         * Enables a specific unit, allowing it to be executed.
         * @param id The ID of the unit to enable.
         * @deprecated Use enableWorker or enableProcess instead.
         */
        enableUnit: (id) => lifecycle.update(id, { enabled: true }),
        /**
         * Enables a specific worker, allowing it to be executed.
         * @param id The ID of the worker to enable.
         */
        enableWorker: (id) => lifecycle.update(id, { enabled: true }),
        /**
         * Enables a specific process, allowing it to be executed.
         * @param id The ID of the process to enable.
         */
        enableProcess: (id) => lifecycle.update(id, { enabled: true }),

        /**
         * Retrieves the current status of a unit (e.g., 'idle', 'running').
         * @param id The ID of the unit.
         */
        getUnitStatus(id: string): SynchronikUnit["status"] | undefined {
            const unit = registry.getUnitById(id);
            return unit?.status;
        },

        /**
         * Lists all registered units (both workers and processes).
         * @returns An array of all `SynchronikUnit` objects.
         */
        listUnits(): SynchronikUnit[] {
            return registry.listUnits();
        },

        /**
         * Lists all registered processes.
         * @returns An array of all `SynchronikProcess` objects.
         */
        listProcesses(): SynchronikProcess[] {
            return registry.listProcesses();
        },

        /**
         * Lists all registered workers.
         * @returns An array of all `SynchronikWorker` objects.
         */
        listWorkers(): SynchronikWorker[] {
            return registry.listWorkers();
        },

        /**
         * Emits a custom milestone event.
         * @param id A unique identifier for the milestone.
         * @param payload Optional data to include with the milestone.
         */
        emitMilestone(id: string, payload?: Record<string, unknown>) {
            milestoneEmitter.emit(id, payload);
        },

        /**
         * Subscribes to all events emitted by the engine's event bus.
         * @param listener A function that will be called with every `SynchronikEvent`.
         * @returns An `unsubscribe` function to stop listening.
         */
        subscribeToEvents(
            listener: (event: SynchronikEvent) => void
        ): () => void {
            return eventBus.subscribeAll(listener);
        },

        // --- Direct Lifecycle, Registry, and Tracker Access ---

        /**
         * Registers a new unit with the engine.
         * @param unit The unit to register.
         */
        registerUnit: lifecycle.register,
        /**
         * Stops a specific worker by setting its `enabled` flag to `false`.
         * @param workerId The ID of the worker to stop.
         */
        stopWorkerById: (workerId: string) =>
            lifecycle.update(workerId, { enabled: false }),
        /** Releases a unit from the engine, removing it from the registry. */
        releaseUnit: lifecycle.release,
        /** Manually sets the status of a unit. Uses the active status management system. */
        updateStatus: (unitId, status, options) => {
            registry.updateUnitState(unitId, {
                status,
                ...options?.payload,
            });
        },

        /**
         * Returns a snapshot of all units currently in the registry.
         * @returns An array of `SynchronikUnit` objects.
         */
        getRegistrySnapshot() {
            return registry.listUnits();
        },

        /**
         * Subscribes to 'milestone' events.
         * @param handler A function to be called when a milestone is emitted.
         * @returns An `unsubscribe` function.
         */
        onMilestone(handler) {
            return eventBus.subscribe("milestone", (event) => {
                handler(event.milestoneId, event.payload);
            });
        },

        /**
         * Creates and integrates a `WorkerManager` (worker pool) with the core engine.
         * @param poolSize The number of concurrent workers in the pool.
         */
        useWorkerPool(poolSize: number = 5): WorkerManager {
            const workerManager = new SynchronikWorkerManager(poolSize);

            // Integrate the two: The WorkerManager will use the core Manager to execute tasks.
            workerManager.setExecutor(this.runWorkerById, {
                registerUnit: this.registerUnit,
                releaseUnit: this.releaseUnit,
            });

            // Register the pool workers with the core manager so they are visible.
            const poolWorkers = workerManager.getPoolWorkers();
            poolWorkers.forEach((worker) => this.registerUnit(worker));

            // Start the worker manager's loop when the core manager starts.
            const originalStart = this.start;
            this.start = () => {
                originalStart();
                workerManager.start();
            };

            return workerManager;
        },

        /**
         * Updates the configuration of a specific worker at runtime.
         * @param workerId The ID of the worker to update.
         * @param config A partial `SynchronikWorker` configuration object.
         */
        updateWorkerConfig(workerId, config) {
            registry.updateWorkerConfig(workerId, config);
        },
        /**
         * Updates the configuration of a specific process at runtime.
         * @param processId The ID of the process to update.
         * @param config A partial `SynchronikProcess` configuration object.
         */
        updateProcessConfig(processId, config) {
            registry.updateProcessConfig(processId, config);
        },
    };

    return managerApi;
}
