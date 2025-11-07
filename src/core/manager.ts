import type {
  SynchronikEvent,
  SynchronikManager,
  SynchronikUnit,
} from "../types/synchronik.js";
import { createMilestoneEmitter, SynchronikEventBus } from "./event.js";
import { createSynchronikLifecycle } from "./lifecycle.js";
import { createSynchronikLoop } from "./loop.js";
import { createSynchronikRegistry } from "./registry.js";
import { createStatusTracker } from "./status-tracker.js";
import { createSynchronikVisualizer } from "./visualizer.js";
import { createUnitWatcher } from "./watcher.js";

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

  return {
    /**
     * Starts the Synchronik engine's background processes.
     * This includes the main execution loop and the unit watcher.
     */
    start() {
      loopInterval = setInterval(() => loop.run(), 60 * 1000);
      watcherInterval = setInterval(() => watcher.scan(), 60 * 1000);
    },

    /**
     * Gracefully stops the Synchronik engine.
     * It clears the background intervals and attempts to complete any in-progress work.
     */
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
            tracker.setStatus(worker.id, "completed", { emitMilestone: true });
          } catch (err) {
            tracker.setStatus(worker.id, "error", {
              emitMilestone: true,
              payload: { error: String(err) },
            });
          }
        }

        tracker.setStatus(process.id, "completed", { emitMilestone: true });
      }
    },

    /**
     * Starts all registered units that are currently in a 'paused' state
     * by setting their status to 'idle'.
     */
    startAll() {
      for (const unit of registry.listUnits()) {
        if (unit.status === "paused") {
          lifecycle.update(unit.id, { status: "idle" });
        }
      }
    },

    /**
     * Stops all registered units by setting their status to 'paused'.
     * This prevents them from being executed by the main loop.
     */
    stopAll() {
      for (const unit of registry.listUnits()) {
        lifecycle.update(unit.id, { status: "paused" });
      }
    },

    /**
     * Manually triggers the execution of a single worker by its ID.
     * @param id The ID of the worker to run.
     */
    async runWorkerById(id) {
      const unit = registry.getUnitById(id);
      if (!unit || unit.status === "paused") return;

      // Ensure it's a worker
      if (!("run" in unit) || typeof unit.run !== "function") return;

      tracker.setStatus(id, "running");

      try {
        await unit.run();
        tracker.setStatus(id, "completed", { emitMilestone: true });
      } catch (err) {
        tracker.setStatus(id, "error", {
          emitMilestone: true,
          payload: { error: String(err) },
        });
      }
    },
    /**
     * Manually triggers the execution of a process and all its associated workers.
     * The execution order is determined by the process's `runMode` property.
     * ('sequential', 'parallel', or 'isolated'). Defaults to 'sequential'.
     * @param id The ID of the process to run.
     */
    async runProcessById(id) {
      const process = registry.getProcessById(id);
      if (!process || process.status === "paused") return;

      tracker.setStatus(id, "running", {
        emitMilestone: true,
        payload: { runMode: process.runMode ?? "sequential" },
      });

      const workers = process.workers.filter(
        (w) => w.enabled && w.status !== "paused" && w.status !== "completed"
      );

      const runMode = process.runMode ?? "sequential";

      if (runMode === "parallel") {
        await Promise.all(workers.map((w) => this.runWorkerById(w.id)));
      } else if (runMode === "isolated") {
        for (const worker of workers) {
          await this.runWorkerById(worker.id);
          await new Promise((r) => setTimeout(r, 100)); // clarity delay
        }
      } else {
        // default: sequential
        for (const worker of workers) {
          await this.runWorkerById(worker.id);
        }
      }

      tracker.setStatus(id, "completed", {
        emitMilestone: true,
        payload: { runMode },
      });
    },

    /**
     * Retrieves the current status of a specific unit.
     * @param id The ID of the unit.
     * @returns The unit's status, or undefined if not found.
     */
    getUnitStatus(id: string): SynchronikUnit["status"] | undefined {
      const unit = registry.getUnitById(id);
      return unit?.status;
    },

    /**
     * Lists all currently registered units.
     * @returns An array of all Synchronik units.
     */
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

    /**
     * Subscribes to all events emitted by the Synchronik engine.
     * @param listener A callback function to handle incoming events.
     * @returns An unsubscribe function.
     */
    subscribeToEvents(listener: (event: SynchronikEvent) => void): () => void {
      return eventBus.subscribeAll(listener);
    },

    // --- Direct Lifecycle, Registry, and Tracker Access ---

    registerUnit: lifecycle.register,
    releaseUnit: lifecycle.release,
    updateStatus: tracker.setStatus,

    /**
     * Retrieves a snapshot of all units currently in the registry.
     * @returns An array of all Synchronik units.
     */
    getRegistrySnapshot() {
      return registry.listUnits();
    },

    /**
     * Subscribes specifically to 'milestone' events.
     * @param handler A callback function to handle milestone events.
     * @returns An unsubscribe function.
     */
    onMilestone(handler) {
      return eventBus.subscribe("milestone", (event) => {
        handler(event.milestoneId, event.payload);
      });
    },
  };
}
