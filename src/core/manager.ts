import type {
    SynchronikEvent,
    SynchronikManager,
    SynchronikUnit,
    WorkerManager,
} from "../types/synchronik.js";
import { createMilestoneEmitter, SynchronikEventBus } from "./event.js";
import { createSynchronikLifecycle } from "./lifecycle.js";
import { createSynchronikLoop } from "./loop.js";
import { createSynchronikRegistry } from "./registry.js";
import { createStatusTracker } from "./status-tracker.js";
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
    const registry = createSynchronikRegistry();
    const eventBus = new SynchronikEventBus();
    const milestoneEmitter = createMilestoneEmitter(eventBus);
    const lifecycle = createSynchronikLifecycle(
        registry,
        eventBus,
        milestoneEmitter
    );
    const visualizer = createSynchronikVisualizer();
    const tracker = createStatusTracker(lifecycle, visualizer);
    const loop = createSynchronikLoop(registry, tracker);
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

                tracker.setStatus(process.id, "running");

                for (const worker of process.workers) {
                    if (
                        worker.status === "paused" ||
                        !worker.enabled ||
                        worker.status === "idle"
                    )
                        continue;

                    tracker.setStatus(worker.id, "running");

                    try {
                        await worker.run();
                        tracker.setStatus(worker.id, "completed", {
                            emitMilestone: true,
                        });
                    } catch (err) {
                        tracker.setStatus(worker.id, "error", {
                            emitMilestone: true,
                            payload: { error: String(err) },
                        });
                    }
                }

                tracker.setStatus(process.id, "completed", {
                    emitMilestone: true,
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

        async runWorkerById(id) {
            /**
             * Executes a single worker by its ID.
             * @param id The ID of the worker to run.
             */
            const worker = registry.getWorkerById(id);
            if (!worker) {
                return;
            }

            await executeWorkerWithRetry(worker, tracker);
        },

        async runProcessById(id) {
            /**
             * Executes a process and all of its associated workers according to its `runMode`.
             * @param id The ID of the process to run.
             */
            const process = registry.getProcessById(id);
            if (!process || process.status === "paused") return;

            tracker.setStatus(id, "running", {
                emitMilestone: true,
                payload: { runMode: process.runMode ?? "sequential" },
            });

            const workers = process.workers.filter((w) => w.enabled);

            await executeWorkersByRunMode({
                workers,
                process,
                execute: async (worker) => {
                    await executeWorkerWithRetry(worker, tracker, {
                        processId: process.id,
                    });

                    // After the manual run, handle the run count and disable if maxRuns is reached.
                    if (worker.status === "completed") {
                        const runCount = (worker.meta?.runCount ?? 0) + 1;
                        registry.updateUnitState(worker.id, {
                            meta: { ...worker.meta, runCount },
                        });
                        if (worker.maxRuns && runCount >= worker.maxRuns) {
                            lifecycle.update(worker.id, { enabled: false });
                        } else if (worker.runOnInterval) {
                            // CRITICAL FIX: For interval workers that just completed a manual run,
                            // clear their lastRun timestamp. This makes them immediately eligible
                            // for the interval loop on its next tick, without waiting for the full intervalMs
                            // from the manual run's completion.
                            registry.updateUnitState(worker.id, {
                                lastRun: undefined as any,
                            });
                        }
                    }
                },
            });

            tracker.setStatus(id, "completed", {
                emitMilestone: true,
                payload: { runMode: process.runMode ?? "sequential" },
            });
        },

        /**
         * Disables a specific unit, preventing it from being executed.
         * @param id The ID of the unit to disable.
         */
        disableUnit(id) {
            lifecycle.update(id, { enabled: false });
        },

        /**
         * Enables a specific unit, allowing it to be executed.
         * @param id The ID of the unit to enable.
         */
        enableUnit(id) {
            lifecycle.update(id, { enabled: true });
        },

        /**
         * Retrieves the current status of a unit (e.g., 'idle', 'running').
         * @param id The ID of the unit.
         */
        getUnitStatus(id: string): SynchronikUnit["status"] | undefined {
            const unit = registry.getUnitById(id);
            return unit?.status;
        },

        listUnits(): SynchronikUnit[] {
            return registry.listUnits();
        },

        /**
         * Emits a custom milestone event.
         * @param id A unique identifier for the milestone.
         * @param payload Optional data to include with the milestone.
         */
        emitMilestone(id: string, payload?: Record<string, unknown>) {
            milestoneEmitter.emit(id, payload);
        },

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
        /** Manually sets the status of a unit. */
        updateStatus: tracker.setStatus,

        getRegistrySnapshot() {
            return registry.listUnits();
        },

        onMilestone(handler) {
            return eventBus.subscribe("milestone", (event) => {
                handler(event.milestoneId, event.payload);
            });
        },

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

        updateWorkerConfig(workerId, config) {
            registry.updateWorkerConfig(workerId, config);
        },
        updateProcessConfig(processId, config) {
            registry.updateProcessConfig(processId, config);
        },
    };

    return managerApi;
}
