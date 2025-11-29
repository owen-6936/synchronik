# 5. State Persistence & Hydration

A core feature of a production-grade workflow engine is resilience. The Synchronik engine achieves this through its **State Persistence and Hydration** mechanism. This allows the engine to save its entire state to a persistent storage and reload it upon restart, ensuring that no progress is lost due to server crashes, deployments, or planned downtime.

## The Problem: In-Memory State is Fragile

By default, the Synchronik engine holds the status, metadata, and run history of all its workers and processes in memory. This is fast and efficient, but it has a major drawback: if the Node.js process terminates, all of this information is lost.

* A 3-hour video transcoding process that was 90% complete would be forgotten.
* A daily report worker that had already run would be seen as `idle` again.
* All historical metadata, like `runCount` and average execution times, would be reset.

State persistence solves this problem by giving the engine a long-term memory.

## How It Works: The Storage Adapter

The persistence feature is designed around a simple but powerful "Storage Adapter" pattern. This is defined by the `StorageAdapter` interface:

```typescript
export interface StorageAdapter {
    /** Saves the current state of all units to the persistent storage. */
    saveState(units: SynchronikUnit[]): Promise<void>;
    /** Loads the state of all units from the persistent storage. */
    loadState(): Promise<SynchronikUnit[] | null>;
}
```

Synchronik ships with a default `FileStorageAdapter` that saves the engine's state to a local JSON file.

### The Process

1. **Initialization & Hydration**: When you initialize the manager with a storage adapter, it first calls `adapter.loadState()`. If state is found, the manager "hydrates" itself, merging the persisted data (like `status`, `meta`, `runCount`) into the worker and process definitions that have been registered in your code.
2. **Automatic Saving**: After hydration, any action that changes the state of a unit (e.g., a worker's status changing from `running` to `completed`, or a configuration update) will automatically trigger a call to `adapter.saveState()`, persisting the new state to your storage medium.

## Usage

Using the persistence feature is straightforward.

1. Import `createSynchronikManager` and `FileStorageAdapter`.
2. Create an instance of the manager and the adapter.
3. **Register your units first.** This is crucial because the adapter only saves data, not functions. The `run` methods must be available in memory for hydration to work.
4. Call `await manager.useStorage(adapter)`.

### Example: A Persistent Counter

The following example demonstrates the feature in action. Each time you run this script, the `runCount` of the worker will increase, proving that the state is being successfully saved and loaded between runs.

```typescript
// examples/10-persistent-engine.ts

import { createSynchronikManager } from "../src/index.js";
import { FileStorageAdapter } from "../src/core/storage/FileStorageAdapter.js";
import type { SynchronikWorker } from "../src/types/synchronik.js";

const STATE_FILE = "persistent-engine-state.json";

const counterWorker: SynchronikWorker = {
    id: "counter-worker",
    name: "Persistent Counter",
    enabled: true,
    status: "idle",
    run: async function () {
        console.log("⚙️  Counter worker is running...");
    },
};

async function main() {
    console.log("--- 🚀 Initializing Persistent Engine ---");

    const manager = createSynchronikManager();
    const adapter = new FileStorageAdapter(STATE_FILE);

    // Register the worker definition first
    manager.registerUnit(counterWorker);

    // Initialize storage, which loads the state from the file if it exists
    await manager.useStorage(adapter);

    // Log the state loaded from disk
    let workerState = manager.getUnitById("counter-worker");
    console.log(
        `State before run: Status='${workerState?.status}', Run Count=${
            workerState?.meta?.runCount ?? 0
        }`
    );

    // Reset status to 'idle' to ensure it can run
    await manager.updateStatus("counter-worker", "idle");
    await manager.runWorkerById("counter-worker");

    // Log the new state, which has been saved back to disk
    workerState = manager.getUnitById("counter-worker");
    console.log(
        `State after run:  Status='${workerState?.status}', Run Count=${
            workerState?.meta?.runCount ?? 0
        }`
    );

    console.log(`\n✅ State saved. Run this script again to see the runCount increase.`);
}

main().catch(console.error);
```

**Running this multiple times will produce output like:**

```bash
# First run
State before run: Status='idle', Run Count=0
State after run:  Status='completed', Run Count=1

# Second run
State before run: Status='completed', Run Count=1
State after run:  Status='completed', Run Count=2

# Third run
State before run: Status='completed', Run Count=2
State after run:  Status='completed', Run Count=3
```

## Benefits

* **Resilience**: Your workflows can survive server crashes and restarts.
* **Zero-Downtime Deployments**: A new server process can be deployed and will pick up the state exactly where the old one left off.
* **Scalability Foundation**: While the `FileStorageAdapter` is for single-node persistence, you can implement a custom adapter (e.g., for Redis or a database) to enable a multi-node, horizontally-scaled architecture.
