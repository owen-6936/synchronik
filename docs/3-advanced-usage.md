# Advanced Usage: Orchestrating Sub-Tasks

A common pattern is for a single `SynchronikWorker` to manage a collection of its own internal sub-tasks, like processing a list of items from an API. The `runWorkerTasks` utility is designed specifically for this scenario.

It provides a declarative, fault-tolerant way to process a list of items, complete with retries and detailed reporting, without causing the parent worker to fail.

## Using `runWorkerTasks`

Here is an example of a single worker that fetches a list of movie IDs and processes them. One of the IDs is invalid and will fail, but the worker itself will succeed and report on the partial failure.

```typescript
import {
  createSynchronikManager,
  type SynchronikProcess,
  type SynchronikWorker,
  runWorkerTasks, // Import the new task runner utility
} from 'synchronik';

async function main() {
  // 1. Create the manager
  const manager = createSynchronikManager();

  // 2. Define a worker that uses the task runner
  const dataIngestionWorker: SynchronikWorker = {
    id: 'data-ingestion-worker',
    name: 'Data Ingestion Worker',
    enabled: true,
    maxRetries: 1, // Retries for catastrophic worker failures

    // This hook is for critical, unrecoverable worker failures.
    onError: (error) => {
      console.error(`CRITICAL: Worker '${dataIngestionWorker.id}' failed permanently.`, error);
    },

    run: async () => {
      console.log('Worker [data-ingestion-worker]: Starting batch of internal tasks...');

      const movieIdsToFetch = ["tt1375666", "tt0133093", "tt0068646", "tt9999999"]; // The last one will fail.

      // Use `runWorkerTasks` to process the list with fault tolerance.
      const results = await runWorkerTasks({
        items: movieIdsToFetch,
        execute: async (id) => {
          await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
          if (id === "tt9999999") throw new Error(`Movie ID ${id} not found (404)`);
          return { movieId: id, title: `Movie Title for ${id}` };
        },
        maxRetries: 2, // Retry each failed movie fetch up to 2 times
        retryDelayMs: (attempt) => Math.pow(2, attempt) * 50, // Exponential backoff
      });

      // The worker's job is done. It emits a detailed milestone with the results.
      manager.emitMilestone('ingestion-complete', results);
      console.log(`Worker [data-ingestion-worker]: Finished with ${results.successPercentage.toFixed(2)}% success.`);
    },
  };

  // 3. Define a process to run the worker
  const dataIngestionProcess: SynchronikProcess = {
    id: 'data-ingestion-process',
    name: 'Nightly Data Ingestion',
    enabled: true,
    runMode: 'parallel',
    workers: [dataIngestionWorker],
  };

  // 4. Register and run
  manager.registerUnit(dataIngestionProcess);

  manager.onMilestone((milestoneId, payload) => {
    if (milestoneId === 'ingestion-complete') {
      console.log('--- Ingestion Worker Results ---');
      console.log(`Success Rate: ${payload.successPercentage}%`);
      console.log('Failed Tasks:', payload.failed);
    }
  });

  console.log('--- Starting Data Ingestion Process ---');
  await manager.runProcessById('data-ingestion-process');
}

main();
```
