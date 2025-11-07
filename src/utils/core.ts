import type { SynchronikEvent, SynchronikUnit } from "../types/synchronik.js";

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

export function createEvent<T extends string>(
  type: T,
  payload: Record<string, unknown> = {}
): { type: T; payload: Record<string, unknown> } {
  return { type, payload };
}
