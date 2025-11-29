import { createSynchronikManager } from "../src/index.js";
import { FileStorageAdapter } from "../src/core/FileStorageAdapter.js";
import type { SynchronikWorker } from "../src/types/synchronik.js";

/**
 * A simple worker that increments a counter in its metadata on each run.
 * The `run` function itself is simple; the magic happens in how the engine
 * tracks its state.
 */
const counterWorker: SynchronikWorker = {
    id: "counter-worker",
    name: "Persistent Counter",
    enabled: true,
    status: "idle",
    run: async function () {
        console.log("⚙️  Counter worker is running...");
        // In a real worker, you might do database work or call an API.
        // The engine will automatically update the status and runCount after this completes.
    },
};

async function main() {
    console.log("--- 🚀 Initializing Persistent Engine ---");

    // 1. Create the manager and the storage adapter.
    // By default, FileStorageAdapter will use 'synchronik-state.json'.
    // You can specify a custom file: new FileStorageAdapter("my-custom-state.json")
    const manager = createSynchronikManager();
    const adapter = new FileStorageAdapter();

    // 2. Register the worker definition.
    // This provides the `run` function, which is not persisted.
    manager.registerUnit(counterWorker);

    // 3. Initialize storage. This will load the state from `persistent-engine-state.json` if it exists.
    await manager.useStorage(adapter);

    // 4. Log the state BEFORE the run to show what was loaded from disk.
    let workerState = manager.getUnitById("counter-worker");
    console.log(
        `State before run: Status='${workerState?.status}', Run Count=${
            workerState?.meta?.runCount ?? 0
        }`
    );

    // 5. Run the worker.
    // We must reset its status to 'idle' first, because its persisted state
    // from the last run is likely 'completed', which would prevent it from running again.
    await manager.updateStatus("counter-worker", "idle");
    await manager.runWorkerById("counter-worker");

    // 6. Log the state AFTER the run, showing the newly incremented runCount.
    workerState = manager.getUnitById("counter-worker");
    console.log(
        `State after run:  Status='${workerState?.status}', Run Count=${
            workerState?.meta?.runCount ?? 0
        }`
    );

    console.log(
        `\n✅ State saved. Run this script again to see the runCount increase.`
    );
}

main().catch(console.error);
