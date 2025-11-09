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
 */
export function createSynchronikManager(): SynchronikManager {
    /**

     * ----------------------------------------------------------------
     * Core Component Initialization
     * ----------------------------------------------------------------
     * All core modules of the Synchronik engine are instantiated here.
     */
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
        start() {
            loopInterval = setInterval(() => loop.run(), 60 * 1000);
            watcherInterval = setInterval(() => watcher.scan(), 60 * 1000);
        },

        async stop() {
            if (loopInterval) clearInterval(loopInterval);
            if (watcherInterval) clearInterval(watcherInterval);

            const processes = registry.listProcesses();

            for (const process of processes) {
                if (process.status === "paused") continue;

                tracker.setStatus(process.id, "running");

                for (const worker of process.workers) {
                    if (worker.status === "paused") continue;

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

            await executeWorkerWithRetry(worker, tracker);
        },
        async runProcessById(id) {
            const process = registry.getProcessById(id);
            if (!process || process.status === "paused") return;

            tracker.setStatus(id, "running", {
                emitMilestone: true,
                payload: { runMode: process.runMode ?? "sequential" },
            });

            const workers = process.workers.filter(
                (w) =>
                    w.enabled &&
                    w.status !== "paused" &&
                    w.status !== "completed"
            );

            await executeWorkersByRunMode({
                workers,
                process,
                execute: (worker) => this.runWorkerById(worker.id),
            });

            tracker.setStatus(id, "completed", {
                emitMilestone: true,
                payload: { runMode: process.runMode ?? "sequential" },
            });
        },

        getUnitStatus(id: string): SynchronikUnit["status"] | undefined {
            const unit = registry.getUnitById(id);
            return unit?.status;
        },

        listUnits(): SynchronikUnit[] {
            return registry.listUnits();
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
        releaseUnit: lifecycle.release,
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
            workerManager.setExecutor(this.runWorkerById);

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

        updateUnitConfig(unitId, config) {
            registry.updateUnitState(unitId, config);
        },
    };

    return managerApi;
}
