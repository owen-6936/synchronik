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

  visualizer.attachToEventBus(eventBus);

  let loopInterval: NodeJS.Timeout | null = null;
  let watcherInterval: NodeJS.Timeout | null = null;

  return {
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

        await Promise.all(
          process.workers.map(async (worker) => {
            if (worker.status === "paused") return;
            tracker.setStatus(worker.id, "running");

            try {
              await worker.run();
              tracker.setStatus(worker.id, "completed");
            } catch (err) {
              tracker.setStatus(worker.id, "error", {
                emitMilestone: true,
                payload: { error: String(err) },
              });
            }
          })
        );

        tracker.setStatus(process.id, "completed");
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

    async runUnitById(id) {
      const unit = registry.getUnitById(id);
      if (!unit || unit.status === "paused") return;

      tracker.setStatus(id, "running");

      try {
        if ("run" in unit && typeof unit.run === "function") {
          await unit.run();
          tracker.setStatus(id, "completed", { emitMilestone: true });
        }
      } catch (err) {
        tracker.setStatus(id, "error", {
          emitMilestone: true,
          payload: { error: String(err) },
        });
      }
    },

    async runProcessById(id) {
      const process = registry.getProcessById(id);
      if (!process || process.status === "paused") return;

      tracker.setStatus(id, "running");

      await Promise.all(
        process.workers.map((worker) => this.runUnitById(worker.id))
      );

      tracker.setStatus(id, "completed", { emitMilestone: true });
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

    subscribeToEvents(listener: (event: SynchronikEvent) => void): () => void {
      return eventBus.subscribeAll(listener);
    },
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
  };
}
