import type {
    SynchronikLoop,
    SynchronikRegistry,
    SynchronikWorker,
} from "../types/synchronik.js";
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
    registry: SynchronikRegistry
): SynchronikLoop {
    return {
        async run() {
            // --- [RESTORED] Original Process-driven execution for manual/non-interval runs ---
            // This block handles running processes as a whole, respecting their runMode.
            const processes = registry.listProcesses();
            for (const process of processes) {
                // We only consider processes that are idle and enabled.
                if (process.status !== "idle" || !process.enabled) continue;

                // Filter for workers that are part of this process but are NOT on an interval schedule.
                const nonIntervalWorkers = process.workers.filter(
                    (w) => w.enabled && !w.runOnInterval
                );

                if (nonIntervalWorkers.length === 0) continue;

                registry.updateUnitState(process.id, {
                    status: "running",
                    runMode: process.runMode ?? "sequential",
                });

                await executeWorkersByRunMode({
                    workers: nonIntervalWorkers,
                    process,
                    execute: async (worker) => {
                        try {
                            await executeWorkerWithRetry(worker, registry);
                        } catch {
                            // Catch errors to prevent them from crashing the loop. The status is already set to 'error' inside executeWorkerWithRetry.
                        }
                    },
                });

                registry.updateUnitState(process.id, {
                    status: "completed",
                    runMode: process.runMode ?? "sequential",
                });
            }

            // --- [EXTENSION] New Worker-driven execution for interval-based runs ---
            // This block runs completely separately and only targets individual workers
            // that are explicitly configured to run on an interval.
            const intervalWorkers = registry
                .listWorkers()
                .filter(isWorkerEligibleForRun);

            for (const worker of intervalWorkers) {
                // CRITICAL FIX: Set the worker to idle BEFORE execution.
                // This resets its state, making it ready for the run. The `executeWorkerWithRetry`
                // function will then correctly transition it to 'running' and 'completed'.
                if (worker.status !== "idle") {
                    registry.updateUnitState(worker.id, { status: "idle" });
                }

                try {
                    await executeWorkerWithRetry(worker, registry);
                } catch {
                    // Also catch errors for interval workers.
                }

                // After the run, if it's an interval worker that completed, handle its state.
                if (worker.status === "completed") {
                    const runCount = (worker.meta?.runCount ?? 0) + 1;
                    registry.updateUnitState(worker.id, {
                        meta: { ...worker.meta, runCount },
                    });
                    if (worker.runOnInterval) {
                        if (worker.maxRuns && runCount >= worker.maxRuns) {
                            registry.updateUnitState(worker.id, {
                                enabled: false,
                            });
                        }
                    }
                }
            }
        },
    };
}

function isWorkerEligibleForRun(worker: SynchronikWorker): boolean {
    if (!worker.enabled || !worker.runOnInterval || !worker.intervalMs)
        return false;

    // Only consider workers that are in a terminal state (idle, completed, or error) for a new run.
    if (!["idle", "completed", "error"].includes(worker.status ?? "idle"))
        return false;

    const now = Date.now();
    const timeSinceLastRun = worker.lastRun
        ? now - worker.lastRun.getTime()
        : Infinity;
    return timeSinceLastRun >= worker.intervalMs;
}
