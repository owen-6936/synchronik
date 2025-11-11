# Understanding Run Modes

A `SynchronikProcess` can execute its workers using one of four strategies, defined by the `runMode` property. This provides fine-grained control over concurrency and execution flow.

### 1. `sequential` (Default)

* **What it is:** Executes workers one by one, waiting for each to complete before starting the next.
* **When to use it:** This is the safest and most predictable mode. Use it when the order of execution matters, or when tasks are dependent on the completion of previous ones.
* **How to use it:**

    ```typescript
    const process: SynchronikProcess = {
      id: 'sequential-process',
      runMode: 'sequential', // This is the default, so it can be omitted
      workers: [workerA, workerB, workerC], // B runs after A, C runs after B
    };
    ```

### 2. `parallel`

* **What it is:** Executes all workers concurrently. Thanks to `Promise.allSettled`, a failure in one worker will not stop the others.
* **When to use it:** Use this for maximum speed when workers are independent of each other and you are not concerned about overwhelming a system with too many simultaneous requests (e.g., hitting API rate limits).
* **How to use it:**

    ```typescript
    const process: SynchronikProcess = {
      id: 'parallel-process',
      runMode: 'parallel',
      workers: [workerA, workerB, workerC], // A, B, and C run at the same time
    };
    ```

### 3. `batched`

* **What it is:** A hybrid between `sequential` and `parallel`. It executes workers in concurrent groups of a configurable size (`batchSize`).
* **When to use it:** Ideal for controlling concurrency. Use it when you want the speed of parallelism but need to avoid overwhelming a system. It's perfect for tasks like API calls or database operations where you want to limit the number of concurrent connections.
* **How to use it:**

    ```typescript
    const process: SynchronikProcess = {
      id: 'batched-process',
      runMode: 'batched',
      batchSize: 2, // Runs 2 workers at a time. Defaults to 2 if not set.
      workers: [workerA, workerB, workerC, workerD], // [A, B] run, then [C, D] run
    };
    ```

### 4. `isolated`

* **What it is:** Executes workers sequentially, but with a configurable delay (`isolationDelayMs`) between the completion of one worker and the start of the next.
* **When to use it:** Useful for workflows that need a "cooldown" period between steps, or to prevent tasks from executing too closely together. This can be helpful when interacting with sensitive systems or for creating more observable, step-by-step flows for demonstration purposes.
* **How to use it:**

    ```typescript
    const process: SynchronikProcess = {
      id: 'isolated-process',
      runMode: 'isolated',
      isolationDelayMs: 500, // Waits 500ms between each worker. Defaults to 100ms.
      workers: [workerA, workerB, workerC], // A runs, waits 500ms, B runs, waits 500ms...
    };
    ```
