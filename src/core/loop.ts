import type { SynchronikRegistry } from "../types/registry.js";
import type { StatusTracker, SynchronikLoop } from "../types/synchronik.js";
import {
    executeWorkersByRunMode,
    executeWorkerWithRetry,
} from "../utils/run-mode.js";

/**
 * Creates the main execution loop for the Synchronik engine.
 * This loop runs periodically, identifies idle units, and executes them.
 *
 * @param registry The central unit registry.
 * @param tracker The status tracker for updating unit statuses.
 * @returns A `SynchronikLoop` instance.
 */
export function createSynchronikLoop(
    registry: SynchronikRegistry,
    tracker: StatusTracker
): SynchronikLoop {
    return {
        async run() {
            const processes = registry.listProcesses();

            for (const process of processes) {
                if (process.status === "paused") continue;

                tracker.setStatus(process.id, "running");

                const workers = process.workers.filter(
                    (w) =>
                        w.enabled &&
                        w.status !== "completed" &&
                        w.status !== "paused"
                );

                tracker.setStatus(process.id, "running", {
                    emitMilestone: true,
                    payload: { runMode: process.runMode ?? "sequential" },
                });

                await executeWorkersByRunMode({
                    workers,
                    process,
                    execute: (worker) =>
                        executeWorkerWithRetry(worker, tracker, {
                            processId: process.id,
                        }),
                });

                tracker.setStatus(process.id, "completed", {
                    emitMilestone: true,
                    payload: { runMode: process.runMode ?? "sequential" },
                });
            }
        },
    };
}
