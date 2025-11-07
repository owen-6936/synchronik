import type { SynchronikRegistry } from "../types/registry.js";
import type { SynchronikLifecycle, UnitWatcher } from "../types/synchronik.js";

export function createUnitWatcher(
  registry: SynchronikRegistry,
  lifecycle: SynchronikLifecycle,
  options?: {
    idleThresholdMs?: number;
    autoUnpause?: boolean;
  }
): UnitWatcher {
  const idleThreshold = options?.idleThresholdMs ?? 5 * 60 * 1000; // default: 5 minutes

  return {
    scan() {
      const now = Date.now();

      for (const worker of registry.listWorkers()) {
        const lastRun = worker.lastRun?.getTime() ?? 0;
        const idleTime = now - lastRun;

        // Auto-release stale workers
        if (worker.status === "idle" && idleTime > idleThreshold) {
          lifecycle.release(worker.id);
          lifecycle.emitMilestone(`worker:${worker.id}:released`, { idleTime });
        }

        // Auto-unpause if enabled
        if (options?.autoUnpause && worker.status === "paused") {
          lifecycle.update(worker.id, { status: "idle" });
          lifecycle.emitMilestone(`worker:${worker.id}:unpaused`);
        }
      }
    },
  };
}
