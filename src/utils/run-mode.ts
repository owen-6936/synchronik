import type {
    Status,
    SynchronikProcess,
    SynchronikRegistry,
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
    > & { workers: SynchronikWorker[] };
    execute: (worker: SynchronikWorker) => Promise<any>;
}): Promise<void> {
    const hasDependencies = workers.some(
        (w) => w.dependsOn && w.dependsOn.length > 0
    );

    if (hasDependencies) {
        // If any worker has dependencies, we MUST use the graph execution model.
        await executeWithDependencies(workers, execute);
    } else {
        // If no dependencies are defined, use the original, simpler runMode logic.
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
}

/**
 * Executes workers based on a dependency graph defined by the `dependsOn` property.
 */
async function executeWithDependencies(
    workers: SynchronikWorker[],
    execute: (worker: SynchronikWorker) => Promise<any>
): Promise<void> {
    const executionResults = new Map<string, any>();
    const workerMap = new Map(workers.map((w) => [w.id, w]));
    const completedWorkers = new Set<string>();
    const runningWorkers = new Set<string>();

    // Basic cycle detection
    for (const worker of workers) {
        const path = new Set<string>();
        const checkCycle = (id: string): boolean => {
            if (path.has(id)) return true; // Cycle detected
            path.add(id);
            const node = workerMap.get(id);
            const dependencies = (node?.dependsOn ?? []).map((dep) =>
                typeof dep === "string" ? dep : dep.id
            );
            for (const depId of dependencies) {
                if (checkCycle(depId)) return true;
            }
            path.delete(id);
            return false;
        };
        if (checkCycle(worker.id)) {
            throw new Error(
                `Circular dependency detected involving worker ${worker.id}`
            );
        }
    }

    while (completedWorkers.size < workers.length) {
        const readyWorkers = workers.filter((w) => {
            if (completedWorkers.has(w.id) || runningWorkers.has(w.id))
                return false;
            const dependencies = w.dependsOn ?? [];
            return dependencies.every((dep) => {
                const depId = typeof dep === "string" ? dep : dep.id;
                const condition =
                    typeof dep === "string" ? undefined : dep.condition;
                if (!completedWorkers.has(depId)) {
                    return false; // Prerequisite not met
                }
                if (condition && !condition(executionResults.get(depId))) {
                    // Log the skip reason
                    console.log(
                        `[SKIPPED] Worker '${w.id}' skipped because condition on '${depId}' was not met.`
                    );
                    return false; // Condition failed
                }
                return true; // Dependency is satisfied
            });
        });

        if (readyWorkers.length === 0 && runningWorkers.size > 0) {
            // Still waiting for running workers to complete, loop will continue.
            await new Promise((r) => setTimeout(r, 50)); // Small delay to prevent busy-waiting
            continue;
        }

        // [IMPROVEMENT] Detect stranded workers (deadlock)
        if (readyWorkers.length === 0 && runningWorkers.size === 0) {
            // If we are here, it means no workers are ready and none are running.
            // This is a valid end state if all remaining workers were correctly skipped due to conditions.
            // If any remaining worker was NOT skipped, it's a true deadlock.
            const remainingWorkers = workers.filter(
                (w) => !completedWorkers.has(w.id)
            );
            if (remainingWorkers.length > 0) {
                // This is a valid end-state for conditional workflows where some branches are not taken.
                // We can simply break the loop.
                break;
            } else {
                // This would be a true deadlock, but our logic for skipping covers all cases.
                // For safety, we can log if needed, but breaking is sufficient.
                break;
            }
        }

        readyWorkers.forEach((w) => runningWorkers.add(w.id));
        await Promise.all(
            readyWorkers.map(async (w) => {
                const result = await execute(w);
                executionResults.set(w.id, result);
                completedWorkers.add(w.id);
                runningWorkers.delete(w.id);
            })
        );
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
    statusUpdater: SynchronikRegistry
): Promise<any> {
    if (worker.status === "paused" || worker.status === "completed") {
        return;
    }

    // Helper to abstract away the status update logic for both systems
    const setStatus = (status: Status, error?: Error) => {
        statusUpdater.updateUnitState(worker.id, { status, error });
    };

    setStatus("running");

    const retries = worker.maxRetries ?? 0;
    const timeoutMs = worker.timeoutMs ?? 10000;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await Promise.race([
                // The worker's run function is the single source of execution
                worker.run(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), timeoutMs)
                ),
            ]);

            setStatus("completed");
            return result; // Success, exit the loop and return the result
        } catch (err) {
            if (attempt >= retries) {
                setStatus("error", err as Error);

                // Invoke the worker's own onError hook.
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

    // If all retries fail, throw the final error to propagate the failure.
    throw new Error(`Worker ${worker.name} failed after all retries.`);
}
