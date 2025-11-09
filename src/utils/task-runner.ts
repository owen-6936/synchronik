/**
 * Represents a single, named sub-task within a worker.

 * @see runWorkerTasks
 */
export interface WorkerTask<T = any> {
    id: string;
    execute: () => Promise<T>;
}

/**
 * Options for configuring the TaskRunner's behavior.

 * @see runWorkerTasks
 */
export interface TaskRunnerOptions {
    maxRetries?: number | undefined;
    retryDelayMs?: number | ((attempt: number) => number) | undefined;
}

/**
 * The result of a TaskRunner execution, providing detailed metadata.

 * @see runWorkerTasks
 */
export interface TaskRunnerResult<T = any> {
    totalTasks: number;
    successful: { id: string; result: T }[];
    failed: { id: string; error: string }[];
    successPercentage: number;
}

/**
 * Configuration for running a homogenous set of tasks over a collection of items.

 * This is the "task containerizer" you described.
 *
 * @template TItem The type of items in the collection.
 * @template TResult The type of result returned by the execute function.
 */
export interface TaskRunnerConfig<TItem, TResult> extends TaskRunnerOptions {
    /**
     * An array of items to be processed. For each item, a task will be generated.
     * @example ["tt102", "tt305", "tt355"]
     */
    items: TItem[];

    /**
     * The asynchronous function to execute for each item in the `items` array.
     * @param item The item from the collection being processed.
     */
    execute: (item: TItem) => Promise<TResult>;

    /**
     * An optional function to generate a unique ID for each task, used for logging and results.
     * If not provided, a simple string representation of the item is used.
     * @param item The item being processed.
     * @returns A unique string identifier.
     */
    getTaskId?: (item: TItem) => string;
}

/**
 * Overload for running a homogenous set of tasks from a configuration object.

 */
export async function runWorkerTasks<TItem, TResult>(
    config: TaskRunnerConfig<TItem, TResult>
): Promise<TaskRunnerResult<TResult>>;

/**
 * Overload for running a heterogeneous array of pre-defined tasks.

 */
export async function runWorkerTasks<TResult>(
    tasks: WorkerTask<TResult>[],
    options?: TaskRunnerOptions
): Promise<TaskRunnerResult<TResult>>;

/**

 * Executes a series of internal worker tasks with
 * granular retry logic and fault tolerance. A single task failure will not
 * stop the others.
 *
 * This function can be used in two ways:
 * 1. By providing a `TaskRunnerConfig` object to automatically generate and run tasks for a list of items.
 * 2. By providing an explicit array of `WorkerTask` objects for more complex scenarios.

 *
 * @returns A promise that resolves with a detailed result object.
 */
export async function runWorkerTasks<TItem, TResult>(
    configOrTasks: TaskRunnerConfig<TItem, TResult> | WorkerTask<TResult>[],
    options: TaskRunnerOptions = {}
): Promise<TaskRunnerResult<TResult>> {
    const successful: { id: string; result: TResult }[] = [];
    const failed: { id: string; error: string }[] = [];

    const { tasks, runnerOptions } = resolveTasksAndOptions(
        configOrTasks,
        options
    );
    const { maxRetries = 0 } = runnerOptions;

    for (const task of tasks) {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await task.execute();

                if (attempt > 0) {
                    // Optional: Log that a retry succeeded.
                    // console.log(`Task '${task.id}' succeeded after ${attempt} retries.`);
                }

                successful.push({ id: task.id, result });
                lastError = null; // Clear error on success
                break; // Exit retry loop
            } catch (err) {
                lastError = err as Error;

                if (attempt < maxRetries) {
                    const { retryDelayMs } = runnerOptions;
                    let delay = 0;
                    if (typeof retryDelayMs === "function") {
                        delay = retryDelayMs(attempt + 1);
                    } else if (typeof retryDelayMs === "number") {
                        delay = retryDelayMs;
                    }
                    if (delay > 0) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, delay)
                        );
                    }
                }
            }
        }

        if (lastError) {
            failed.push({ id: task.id, error: lastError.message });
        }
    }

    const totalTasks = tasks.length;
    const successPercentage =
        totalTasks > 0 ? (successful.length / totalTasks) * 100 : 100;

    return {
        totalTasks,
        successful,
        failed,
        successPercentage,
    };
}

/**
 * Internal helper to resolve the arguments from the overloaded function signature.
 */
function resolveTasksAndOptions<TItem, TResult>(
    configOrTasks: TaskRunnerConfig<TItem, TResult> | WorkerTask<TResult>[],
    options: TaskRunnerOptions
): { tasks: WorkerTask<TResult>[]; runnerOptions: TaskRunnerOptions } {
    if (Array.isArray(configOrTasks)) {
        // Signature: runWorkerTasks(tasks: WorkerTask[], options?: TaskRunnerOptions)
        return {
            tasks: configOrTasks,
            runnerOptions: options,
        };
    }

    // Signature: runWorkerTasks(config: TaskRunnerConfig)
    const config = configOrTasks;
    const tasks = config.items.map((item) => ({
        id: config.getTaskId ? config.getTaskId(item) : String(item),
        execute: () => config.execute(item),
    }));

    return {
        tasks,
        runnerOptions: {
            maxRetries: config.maxRetries,
            retryDelayMs: config.retryDelayMs,
        },
    };
}
