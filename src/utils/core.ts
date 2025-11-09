import type { SynchronikEvent, SynchronikUnit } from "../types/synchronik.js";

/**
 * Maps an event type to a corresponding unit status.
 * This is a helper function for converting event types into human-readable statuses.
 *
 * @param type The event type (e.g., 'start', 'complete', 'error').
 * @returns The corresponding unit status, or undefined if no mapping exists.
 */
export function mapEventTypeToStatus(
    type: SynchronikEvent["type"]
): SynchronikUnit["status"] | undefined {
    switch (type) {
        case "start":
            return "running";
        case "complete":
            return "completed";
        case "error":
            return "error";
        default:
            return undefined;
    }
}

/**
 * Executes an asynchronous task and handles any errors that occur.
 * This is a utility function for safely executing asynchronous operations.
 *
 * @template T The type of the task's result.
 * @param task The asynchronous function to execute.
 * @param onError An optional callback function to handle any errors that occur.
 */
export async function runAsyncTask<T>(
    task: () => Promise<T>,
    onError?: (err: unknown) => void
): Promise<T | undefined> {
    try {
        return await task();
    } catch (err) {
        onError?.(err);
        return undefined;
    }
}

/**
 * Executes a list of asynchronous tasks and collects their results.
 * This is a utility function for running multiple asynchronous operations concurrently.
 *
 * @template T The type of the tasks' results.
 * @param tasks An array of asynchronous functions to execute.
 * @param onComplete An optional callback function to execute when all tasks have completed.
 * @param onError An optional callback function to handle any errors that occur.
 * @returns An array of the tasks' results, or an empty array if an error occurs.
 */
export async function runAllTasks<T>(
    tasks: (() => Promise<T>)[],
    onComplete?: () => void,
    onError?: (err: unknown) => void
): Promise<(T | undefined)[]> {
    try {
        const results = await Promise.all(
            tasks.map((task) => runAsyncTask(task, onError))
        );
        onComplete?.();
        return results;
    } catch (err) {
        onError?.(err);
        return [];
    }
}

/**
 * Creates a standardized event object.
 * This is a helper function for creating consistent event objects throughout the engine.
 *
 * @param type The type of the event.
 * @param payload Optional data to include with the event.
 */
export function createEvent<T extends string>(
    type: T,
    payload: Record<string, unknown> = {}
): { type: T; payload: Record<string, unknown> } {
    return { type, payload };
}
