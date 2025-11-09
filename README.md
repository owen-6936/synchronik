<div align="center">
  <h1>
    Synchronik ✨
  </h1>
  <p>
    A modular orchestration engine for building resilient, observable, and milestone-driven workflows in Node.js.
  </p>
</div>

[![Node.js Version](https://img.shields.io/badge/Node.js-18+-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strongly%20Typed-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache--2.0-green)](LICENSE)
[![CI](https://github.com/owen-6936/synchronik/actions/workflows/ci.yml/badge.svg)](https://github.com/owen-6936/synchronik/actions/workflows/ci.yml)
[![CodeQL](https://github.com/owen-6936/synchronik/actions/workflows/codeql.yml/badge.svg)](https://github.com/owen-6936/synchronik/actions/workflows/codeql.yml)
[![Build Status](https://img.shields.io/github/actions/workflow/status/owen-6936/synchronik/publish.yml?branch=release/v1.0.0)](https://github.com/owen-6936/synchronik/actions/workflows/publish.yml)

## 📖 Overview

`Synchronik` is a lightweight, event-driven orchestration engine designed to bring clarity and control to complex asynchronous workflows. It transforms tangled processes into clean, observable, and milestone-driven automation.

Whether you're coordinating data pipelines, managing background jobs, or building resilient micro-services, Synchronik provides the core components to let your code orchestrate itself while you focus on the business logic.

### 🎯 Key Features

* **Modular Architecture:** Composed of distinct, swappable components (`Manager`, `Registry`, `Loop`, `Watcher`) for clear separation of concerns.
* **Event-Driven:** Subscribe to the entire lifecycle of your tasks. React to `start`, `complete`, `error`, and custom `milestone` events in real-time.
* **Robust State Management:** Reliably track the status of every task (`idle`, `running`, `paused`, `completed`, `error`).
* **Automatic & Manual Control:** Run tasks on a scheduled interval with the main execution loop or trigger them manually via the API.
* **Extensible by Design:** Register your own asynchronous functions as `Workers` and group them into `Processes`.
* **Resilience Built-In:** Includes a `Watcher` to detect and handle stale or stuck tasks, ensuring your engine remains healthy.
* **Visualization Hooks:** The event bus makes it trivial to connect real-time dashboards and monitoring tools.

---

## Getting Started

```bash
npm install synchronik
```

The service will begin fetching and updating in batches, pausing between each API call to respect rate limits.

---

That is an essential and often overlooked step, Owen\! A logical folder structure is the foundation of a professional, maintainable service like **`popflix-synchron`**. It will make navigating your TypeScript and configuration files much easier.

Based on your technology choices (Node.js, TypeScript, SWC), here is the recommended project structure:

---

## 📁 Recommended Folder Structure for `popflix-synchron`

This structure cleanly separates the source code (`src`) from configuration files and build outputs (`dist`).

```bash
synchronik/
├── src/
│   ├── core/
│   │   ├── manager.ts
│   │   ├── registry.ts
│   │   ├── lifecycle.ts
│   │   ├── event.ts
│   │   ├── status-tracker.ts
│   │   ├── loop.ts
│   │   ├── watcher.ts
│   │   └── dashboard.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── ... (other type definition files)
│   ├── index.ts
│   └── app.ts (example usage)
├── dist/
├── node_modules/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── swc-config.json
├── README.md
└── LICENSE

```

### Key Rationale

* **`src/`**: Contains all the TypeScript source code.
  * **`core/`**: Houses the fundamental building blocks of the `Synchronik` engine (Manager, Registry, Event Bus, etc.). This separation makes the core logic easily identifiable and testable.
  * **`types/`**: Dedicated to TypeScript type definitions, ensuring a clear and centralized place for all interfaces and types used across the project.
  * **`index.ts`**: The main entry point for the library, exporting all public APIs.
  * **`app.ts`**: An example file demonstrating how to use the `Synchronik` engine. This is useful for quick testing and as a reference for new users.
* **`dist/`**: The output directory for compiled JavaScript files. This keeps the generated code separate from the source.
* **`node_modules/`**: Standard location for npm-installed packages.
* **`.env` / `.env.example`**: For environment variables, crucial for configuration in different deployment environments.
* **`.gitignore`**: Specifies intentionally untracked files that Git should ignore.
* **`package.json`**: Defines project metadata, scripts, and dependencies.
* **`tsconfig.json`**: TypeScript compiler configuration.
* **`swc-config.json`**: SWC (Speedy Web Compiler) configuration for fast transpilation.
* **`README.md`**: Project documentation.
* **`LICENSE`**: Project licensing information.

---

## 🚀 Usage Examples

### Basic Worker Example

This example demonstrates how to create a simple worker and register it with the `SynchronikManager`. The worker will run periodically, logging a message to the console.

```typescript
import { createSynchronikManager, SynchronikWorker } from 'synchronik';

async function runBasicWorker() {
  const manager = createSynchronikManager();

  // Define a simple worker
  const mySimpleWorker: SynchronikWorker = {
    id: 'simple-logger-worker',
    name: 'Simple Logger',
    enabled: true,
    intervalMs: 2000, // Run every 2 seconds
    run: async () => {
      console.log(`Worker 'simple-logger-worker' is running at ${new Date().toLocaleTimeString()}`);
    },


---

## 🤝 Contribution & License

This project is a personal development effort by **Owen**.

This project is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for details.

---

## 🏛️ Core Engine Architecture

The Synchronik engine is built around a modular architecture orchestrated by a central `SynchronikManager`. While the manager provides the primary public API, it's helpful to understand the components it coordinates internally.

| Component | File (`src/core/`) | Role |
| :--- | :--- | :--- |
| **Manager** | `manager.ts` | The main public interface. It integrates all other components and provides methods to control the engine's lifecycle, execute units, and subscribe to events. |
| **Registry** | `registry.ts` | An in-memory database that stores the state of all registered units (workers and processes). |
| **Lifecycle** | `lifecycle.ts` | Manages the registration, state updates, and release of units. It ensures that state changes are valid and emits corresponding events. |
| **Event Bus** | `event.ts` | A publish-subscribe system that broadcasts events (`start`, `complete`, `error`, `milestone`) across the engine, allowing components to react to changes in real-time. |
| **Status Tracker**| `status-tracker.ts` | A dedicated module for setting and tracking the status of units. It acts as the single source of truth for status changes and emits milestones accordingly. |
| **Loop** | `loop.ts` | The heart of the engine's execution logic. It runs on a configurable interval, identifies `idle` units, and executes them. |
| **Watcher** | `watcher.ts` | A background process that scans for stale or stuck units and can automatically un-pause them, ensuring the engine remains healthy. |
| **Dashboard** | `dashboard.ts` | A simple, optional console utility for visualizing the state of the engine in real-time. |

### The `SynchronikManager`

The `SynchronikManager` is the primary abstraction and your main entry point for interacting with the engine. It exposes a clean and powerful API for orchestrating complex workflows without needing to manage the underlying components directly.

#### Creating a Manager

You can create a manager instance using the `createSynchronikManager` factory function.

```typescript
import { createSynchronikManager } from 'popflix-synchron'; // or your local path

const manager = createSynchronikManager();
```

#### Core Lifecycle Methods

These methods control the overall state of the engine.

* **`manager.start()`**
    Starts the engine's background processes, including the main execution `loop` and the `watcher`.

    ```typescript
    manager.start();
    console.log("Synchronik engine is running.");
    ```

* **`manager.stop()`**
    Gracefully stops the engine. It clears the background intervals and attempts to complete any in-progress work before exiting.

    ```typescript
    await manager.stop();
    console.log("Synchronik engine has stopped.");
    ```

* **`manager.startAll()` / `manager.stopAll()`**
    These methods provide bulk control over all registered units, setting their status to `idle` or `paused` respectively.

    ```typescript
    // Pause all operations
    manager.stopAll();

    // Resume all operations
    manager.startAll();
    ```

#### Unit Registration and Management

These methods allow you to add, remove, and inspect units in the engine.

* **`manager.registerUnit(unit)`**
    Adds a new worker or process to the engine's registry.

    ```typescript
    const myWorker = {
      id: 'my-first-worker',
      status: 'idle',
      run: async () => { console.log('Worker is running!'); }
    };
    manager.registerUnit(myWorker);
    ```

* **`manager.releaseUnit(id)`**
    Removes a unit from the registry.

    ```typescript
    manager.releaseUnit('my-first-worker');
    ```

* **`manager.updateUnitConfig(unitId, config)`**
    Updates the configuration of a registered unit at runtime. This is useful for dynamically changing behavior, such as increasing the number of retries for a failing worker.

    ```typescript
    // Increase the retries for a worker that is struggling
    manager.updateUnitConfig('data-ingestion-worker', { maxRetries: 5 });
    ```

* **`manager.updateStatus(unitId, status)`**
    Manually sets the status of a unit. This is useful for resetting a failed worker back to `idle` so it can be run again.

    ```typescript
    manager.updateStatus('failing-worker', 'idle');
    ```

* **`manager.listUnits()`**
    Returns an array of all currently registered units.

    ```typescript
    const allUnits = manager.listUnits();
    console.log(`There are ${allUnits.length} units registered.`);
    ```

#### Manual Execution

While the engine can run units automatically, you can also trigger them manually.

* **`manager.runUnitById(id)`**
    Immediately executes a single unit (worker or process) by its ID, provided it is not paused.

    ```typescript
    await manager.runUnitById('my-first-worker');
    ```

* **`manager.runProcessById(id)`**
    Executes a process and all of its associated workers in parallel.

    ```typescript
    // Assuming 'my-process' is a registered process with workers
    await manager.runProcessById('my-process');
    ```

#### Event Subscription and Milestones

The engine is event-driven. You can subscribe to these events to monitor its activity or trigger external actions.

* **`manager.subscribeToEvents(listener)`**
    Subscribes to all core events (`start`, `complete`, `error`, `milestone`). Returns an `unsubscribe` function.

    ```typescript
    const unsubscribe = manager.subscribeToEvents(event => {
      console.log(`Event received: ${event.type} for unit ${event.unitId}`);
    });

    // Later, to stop listening:
    unsubscribe();
    ```

* **`manager.onMilestone(handler)`**
    A convenience method to subscribe only to `milestone` events.

    ```typescript
    manager.onMilestone((milestoneId, payload) => {
      console.log(`Milestone: ${milestoneId}`, payload);
    });
    ```

* **`manager.emitMilestone(id, payload)`**
    Allows you to emit your own custom milestones from anywhere in your application.

    ```typescript
    manager.emitMilestone('user-logged-in', { userId: 123 });
    ```

---

### Advanced Usage: Processes and Workers

This section has been updated to reflect a more robust pattern for handling internal task failures within a worker.

A `Process` is a special type of unit that groups multiple `Workers` together. It allows you to define a structured workflow and control how its workers are executed using different `runMode` strategies. This is useful for orchestrating complex jobs where several tasks need to run with specific concurrency rules.

Here is an example of how to define and run a process that manages two workers: one for fetching user data and another for fetching product data.

```typescript
import {
  createSynchronikManager,
  SynchronikProcess,
  SynchronikWorker,
  runWorkerTasks, // Import the new task runner utility
} from 'synchronik';

async function main() {
  // 1. Create the manager
  const manager = createSynchronikManager();

  // 2. Define your workers. Let's create a factory for convenience.
  const dataIngestionWorker: SynchronikWorker = {
    id: 'data-ingestion-worker',
    name: 'Data Ingestion Worker',
    enabled: true,
    // The worker itself can have retries for catastrophic failures
    maxRetries: 1,

    // The worker's `run` function orchestrates its internal sub-tasks.
    onError: (error) => {
      // This hook is called only if the worker itself fails all its retries.
      // It's perfect for logging critical, unrecoverable worker failures.
      console.error(`CRITICAL: Worker '${dataIngestionWorker.id}' failed permanently.`, error);
    },

    run: async () => {
      console.log('Worker [data-ingestion-worker]: Starting batch of internal tasks...');

      // 1. Define the list of items to process.
      const movieIdsToFetch = ["tt1375666", "tt0133093", "tt0068646", "tt9999999"]; // The last one will fail.

      // 2. Use the `runWorkerTasks` utility to process the list with retries and fault tolerance.
      const results = await runWorkerTasks({
        items: movieIdsToFetch,
        execute: async (id) => {
          await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
          if (id === "tt9999999") throw new Error(`Movie ID ${id} not found (404)`);
          return { movieId: id, title: `Movie Title for ${id}` };
        },
        maxRetries: 2, // Retry each failed movie fetch up to 2 times
        retryDelayMs: (attempt) => Math.pow(2, attempt) * 50,
      });

      // 3. The worker's job is done. It emits a detailed milestone with the results.
      manager.emitMilestone('ingestion-complete', results);
      console.log(`Worker [data-ingestion-worker]: Finished with ${results.successPercentage.toFixed(2)}% success.`);
    },
  };

  // 3. Define the process that groups the workers
  const dataIngestionProcess: SynchronikProcess = {
    id: 'data-ingestion-process',
    name: 'Nightly Data Ingestion',
    description: 'Fetches all primary data from external APIs in controlled batches.',
    enabled: true,
    runMode: 'parallel', // We can run multiple of these complex workers at once
    workers: [dataIngestionWorker /*, other_workers... */],
    onComplete: () => {
      console.log('EVENT: The entire data ingestion process has completed successfully.');
    }
  };

  // 4. Register the process. The manager will automatically register its workers.
  manager.registerUnit(dataIngestionProcess);

  // 5. Subscribe to events to see the orchestration in action
  manager.onMilestone((milestoneId, payload) => {
    // Listen for the custom milestone emitted by the worker.
    if (milestoneId === 'ingestion-complete') {
      console.log('--- Ingestion Worker Results ---');
      console.log(`Success: ${payload.successPercentage}%`, payload.failed);
    }
    console.log(`EVENT: Milestone hit -> ${milestoneId}`, payload);
  });

  manager.subscribeToEvents((event) => {
    if (event.type === 'milestone') {
      return; // Handled by onMilestone
    }
    console.log(`EVENT: Unit '${event.unitId}' changed status to -> ${event.type}`);
  });

  // 6. Run the entire process by its ID
  console.log('--- Starting Data Ingestion Process ---');
  await manager.runProcessById('data-ingestion-process');
}

main();

```

When you run this code, you will see the `SynchronikManager` start the process, execute both workers concurrently, and then mark the process as complete only after both workers have finished their tasks. The event log will clearly show the status changes for each unit.

---

### Understanding Run Modes

A `SynchronikProcess` can execute its workers using one of four strategies, defined by the `runMode` property. This provides fine-grained control over concurrency and execution flow.

#### 1. `sequential` (Default)

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

#### 2. `parallel`

* **What it is:** Executes all workers concurrently using `Promise.all()`.
* **When to use it:** Use this for maximum speed when workers are independent of each other and you are not concerned about overwhelming a system with too many simultaneous requests (e.g., hitting API rate limits).
* **How to use it:**

    ```typescript
    const process: SynchronikProcess = {
      id: 'parallel-process',
      runMode: 'parallel',
      workers: [workerA, workerB, workerC], // A, B, and C run at the same time
    };
    ```

#### 3. `batched`

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

#### 4. `isolated`

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

* **Integrated Worker Pool:** Added a `useWorkerPool()` method to the `SynchronikManager` to create and manage a pool of reusable workers for dynamic task queuing.
* **Task Management API:**
  * `addTask`: Add a new task with its `execute` function to a prioritized queue.
  * `pauseTask`: Pause a pending task, which also blocks all subsequent tasks.
  * `resumeTask`: Resume a paused task, allowing the queue to proceed.
  * `cancelTask`: Remove a task from the pending queue entirely.
* **Pre-Run Simulation:** Added a `simulateRun()` method to preview the execution order of pending tasks without running them.

---

## 🔬 Showcase: Projectile Motion Lecture

This example demonstrates how `Synchronik` can orchestrate a multi-step calculation, presenting it as a "short lecture" with clear, sequential steps and milestone-driven progress. Crucially, it highlights the performance benefits of `parallel` execution when tasks involve significant computational load.

**Scenario:** We want to calculate the characteristics of a projectile launched from the ground with an initial velocity and angle, under constant gravity.
The steps include:

1. Setting Initial Conditions
2. Calculating Initial Velocity Components
3. Calculating Time to Peak Height
4. Calculating Maximum Height
5. Calculating Total Time of Flight
6. Calculating Horizontal Range
7. Generating Lecture Notes File

---

## Resulting Lecture Notes

check out the generated lecture notes file: [projectile_motion_lecture.txt](projectile_motion_lecture.txt)
