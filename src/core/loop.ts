import type { SynchronikRegistry } from "../types/registry.js";
import type {
  StatusTracker,
  SynchronikLoop,
  SynchronikWorker,
} from "../types/synchronik.js";

export function createSynchronikLoop(
  registry: SynchronikRegistry,
  tracker: StatusTracker
): SynchronikLoop {
  async function runWorker(
    worker: SynchronikWorker,
    processId: string
  ): Promise<void> {
    if (worker.status === "paused" || worker.status === "completed") return;

    tracker.setStatus(worker.id, "running");

    const retries = worker.maxRetries ?? 0;
    const timeoutMs = worker.timeoutMs ?? 10000;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await Promise.race([
          worker.run(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeoutMs)
          ),
        ]);

        tracker.setStatus(worker.id, "completed", {
          emitMilestone: true,
          payload: { processId, attempt },
        });
        return;
      } catch (err) {
        if (attempt === retries) {
          try {
            tracker.setStatus(worker.id, "error", {
              emitMilestone: true,
              payload: {
                processId,
                error: String((err as Error).message),
                attempt,
              },
            });
          } catch (trackerError) {
            console.error("Tracker failed to set error status:", trackerError);
          }
        }
      }
    }
  }

  return {
    async run() {
      const processes = registry.listProcesses();

      for (const process of processes) {
        if (process.status === "paused") continue;

        tracker.setStatus(process.id, "running");

        const workers = process.workers.filter(
          (w) => w.enabled && w.status !== "completed" && w.status !== "paused"
        );

        const runMode = process.runMode ?? "sequential";

        tracker.setStatus(process.id, "running", {
          emitMilestone: true,
          payload: { runMode },
        });

        if (runMode === "parallel") {
          await Promise.all(workers.map((w) => runWorker(w, process.id)));
        } else if (runMode === "isolated") {
          for (const worker of workers) {
            await runWorker(worker, process.id);
            await new Promise((r) => setTimeout(r, 100)); // small delay for clarity
          }
        } else {
          // default: sequential
          for (const worker of workers) {
            await runWorker(worker, process.id);
          }
        }

        tracker.setStatus(process.id, "completed", {
          emitMilestone: true,
          payload: { runMode },
        });
      }
    },
  };
}
