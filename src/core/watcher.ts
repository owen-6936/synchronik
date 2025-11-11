import type {
    SynchronikLifecycle,
    UnitWatcher,
    SynchronikRegistry,
} from "../types/synchronik.js";

/**
 * Creates a unit watcher to maintain engine health.
 * The watcher scans for stale or paused units and can take corrective action.
 *
 * @param registry The central unit registry.
 * @param lifecycle The lifecycle manager to perform actions like releasing or updating units.
 * @param options Configuration for the watcher's behavior.
 * @returns A `UnitWatcher` instance with a `scan` method.
 */
export function createUnitWatcher(
    registry: SynchronikRegistry,
    lifecycle: SynchronikLifecycle,
    options?: {
        /** The time in milliseconds a worker can be idle before it's considered stale and released. @default 300000 (5 minutes) */
        idleThresholdMs?: number;
        /** If true, automatically sets the status of 'paused' workers to 'idle' during a scan. */
        autoUnpause?: boolean;
    }
): UnitWatcher {
    const idleThreshold = options?.idleThresholdMs ?? 5 * 60 * 1000; // default: 5 minutes

    return {
        /**
         * Scans all registered workers for stale or paused states and takes action based on the watcher's configuration.
         */
        scan() {
            const now = Date.now();

            for (const worker of registry.listWorkers()) {
                const lastRun = worker.lastRun?.getTime() ?? 0;
                const idleTime = now - lastRun;

                // Auto-release stale workers
                if (worker.status === "idle" && idleTime > idleThreshold) {
                    lifecycle.release(worker.id);
                    lifecycle.emitMilestone(`worker:${worker.id}:released`, {
                        idleTime,
                    });
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
