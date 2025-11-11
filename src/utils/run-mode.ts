import type {
    SynchronikProcess,
    StatusTracker,
    SynchronikWorker,
} from "../types/synchronik.js";

/**
 * Executes a list of workers based on the run mode specified in a process.
 * This utility centralizes the run mode logic for both manual and automatic execution.
 *
 * @param options - The options for execution.
 * @param options.workers - The array of workers to execute.
 * @param options.process - The process object containing run mode settings.
 * @param options.execute - A function that takes a worker and returns a promise for its execution.
 */
export async function executeWorkersByRunMode({
    workers,
    process,
    execute,
}: {
    workers: SynchronikWorker[];
    process: Pick<
        SynchronikProcess,
        "runMode" | "isolationDelayMs" | "batchSize"
    >;
    execute: (worker: SynchronikWorker) => Promise<void>;
}): Promise<void> {
    const runMode = process.runMode ?? "sequential";

    if (runMode === "parallel") {
        await Promise.allSettled(workers.map(execute));
    } else if (runMode === "isolated") {
        const delay = process.isolationDelayMs ?? 100;
        for (const worker of workers) {
            await execute(worker);
            await new Promise((r) => setTimeout(r, delay));
        }
    } else if (runMode === "batched") {
        const batchSize = process.batchSize ?? 2;
        for (let i = 0; i < workers.length; i += batchSize) {
            const batch = workers.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(execute));
        }
    } else {
        // default: sequential
        for (const worker of workers) {
            await execute(worker);
        }
    }
}

/**
 * Executes a single worker with retry and timeout logic.
 *
 * @param worker The worker to execute.
 * @param tracker The status tracker to report progress.
 * @param options Optional parameters for execution context.
 */
export async function executeWorkerWithRetry(
    worker: SynchronikWorker,
    tracker: StatusTracker,
    options?: {
        processId?: string;
    }
): Promise<void> {
    if (worker.status === "paused" || worker.status === "completed") {
        return;
    }

    tracker.setStatus(worker.id, "running");

    const retries = worker.maxRetries ?? 0;
    const timeoutMs = worker.timeoutMs ?? 10000;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            await Promise.race([
                // The worker's run function is the single source of execution
                worker.run(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), timeoutMs)
                ),
            ]);

            tracker.setStatus(worker.id, "completed", {
                emitMilestone: true,
                payload: { processId: options?.processId, attempt },
            });
            return; // Success, exit the loop
        } catch (err) {
            if (attempt >= retries) {
                tracker.setStatus(worker.id, "error", {
                    emitMilestone: true,
                    payload: {
                        processId: options?.processId,
                        error: err as Error,
                        attempt,
                    },
                });

                // Invoke the worker's own onError hook, if it exists.
                if (worker.onError) {
                    worker.onError(err as Error);
                }
            } else {
                // It's not the last attempt, so calculate delay and wait before retrying.
                const { retryDelayMs } = worker;
                let delay = 0;

                if (typeof retryDelayMs === "function") {
                    delay = retryDelayMs(attempt + 1);
                } else if (typeof retryDelayMs === "number") {
                    delay = retryDelayMs;
                }

                if (delay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
    }
}
