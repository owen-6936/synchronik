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
 * @param options.watcherInterval The interval in milliseconds at which the unit watcher runs. @default 60000.
 * @param options.statsEmissionIntervalMs If provided, the engine will automatically emit its resource stats on this interval.
 */
export function createSynchronikManager(options?: {
    loopInterval?: number;
    watcherInterval?: number;
    statsEmissionIntervalMs?: number;
}): SynchronikManager {
    /**

     * ----------------------------------------------------------------
     * Core Component Initialization
     * ----------------------------------------------------------------
     * All core modules of the Synchronik engine are instantiated here.
     */
    const loopIntervalMs = options?.loopInterval ?? 1000;
    const watcherIntervalMs = options?.watcherInterval ?? 60 * 1000;
    const statsEmissionIntervalMs = options?.statsEmissionIntervalMs;

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
    let statsInterval: NodeJS.Timeout | null = null;

    // State for CPU percentage calculation
    let lastCpuUsage: NodeJS.CpuUsage | undefined;
    let lastCpuTime: number | undefined;

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

            if (statsEmissionIntervalMs) {
                statsInterval = setInterval(() => {
                    const stats = this.getEngineStats();
                    milestoneEmitter.emit("engine:stats", stats);
                }, statsEmissionIntervalMs);
            }
        },

        async stop() {
            if (loopInterval) clearInterval(loopInterval);
            if (watcherInterval) clearInterval(watcherInterval);
            if (statsInterval) clearInterval(statsInterval);

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

        startAll() {
            for (const unit of registry.listUnits()) {
                if (unit.status === "paused") {
                    lifecycle.update(unit.id, { status: "idle" });
                }
            }
        },

        stopAll() {
            for (const unit of registry.listUnits()) {
                lifecycle.update(unit.id, { status: "paused" });
            }
        },

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
                            registry
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

        disableUnit: (id) => lifecycle.update(id, { enabled: false }),

        disableWorker: (id) => lifecycle.update(id, { enabled: false }),

        disableProcess: (id) => lifecycle.update(id, { enabled: false }),

        enableUnit: (id) => lifecycle.update(id, { enabled: true }),

        enableWorker: (id) => lifecycle.update(id, { enabled: true }),

        enableProcess: (id) => lifecycle.update(id, { enabled: true }),

        getUnitStatus(id: string): SynchronikUnit["status"] | undefined {
            const unit = registry.getUnitById(id);
            return unit?.status;
        },

        listUnits(): SynchronikUnit[] {
            return registry.listUnits();
        },

        listProcesses(): SynchronikProcess[] {
            return registry.listProcesses();
        },

        listWorkers(): SynchronikWorker[] {
            return registry.listWorkers();
        },

        emitMilestone(id: string, payload?: Record<string, unknown>) {
            milestoneEmitter.emit(id, payload);
        },

        subscribeToEvents(
            listener: (event: SynchronikEvent) => void
        ): () => void {
            return eventBus.subscribeAll(listener);
        },

        // --- Direct Lifecycle, Registry, and Tracker Access ---

        registerUnit: lifecycle.register,

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

        getEngineStats() {
            const memoryUsage = process.memoryUsage();

            // --- CPU Percentage Calculation ---
            const currentCpuTime = Date.now();
            const currentCpuUsage = process.cpuUsage();

            let cpuPercentage = 0;

            if (lastCpuTime && lastCpuUsage) {
                const elapsedTime = (currentCpuTime - lastCpuTime) * 1000; // elapsed time in microseconds
                const elapsedUserUsage =
                    currentCpuUsage.user - lastCpuUsage.user;
                const elapsedSystemUsage =
                    currentCpuUsage.system - lastCpuUsage.system;

                if (elapsedTime > 0) {
                    const totalElapsedUsage =
                        elapsedUserUsage + elapsedSystemUsage;
                    cpuPercentage = (totalElapsedUsage / elapsedTime) * 100;
                }
            }

            // Update last values for the next call
            lastCpuTime = currentCpuTime;
            lastCpuUsage = currentCpuUsage;

            return {
                memory: {
                    rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
                    heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                    heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                    external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
                },
                cpu: `${cpuPercentage.toFixed(2)}%`,
            };
        },
    };

    return managerApi;
}
