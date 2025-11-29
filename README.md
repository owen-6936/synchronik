<div align="center">
  <h1>
    ✨ **Synchronik** ✨
  </h1>
  <p>
    A modular orchestration engine for building resilient, observable, and milestone-driven workflows in **Node.js**.
  </p>
</div>

[![Node.js Version](https://img.shields.io/badge/Node.js-18+-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strongly%20Typed-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache--2.0-green)](LICENSE)
[![CI](https://github.com/owen-6936/synchronik/actions/workflows/ci.yml/badge.svg)](https://github.com/owen-6936/synchronik/actions/workflows/ci.yml)
[![CodeQL](https://github.com/owen-6936/synchronik/actions/workflows/codeql.yml/badge.svg)](https://github.com/owen-6936/synchronik/actions/workflows/codeql.yml)
[![Build Status](https://img.shields.io/github/actions/workflow/status/owen-6936/synchronik/publish.yml?branch=release/v2.3.0)](https://github.com/owen-6936/synchronik/actions/workflows/publish.yml)
[![JSR](https://jsr.io/badges/@nexicore/synchronik)](https://jsr.io/@nexicore/synchronik)
![npm version](https://img.shields.io/npm/v/synchronik)

---

## 📖 Overview

`Synchronik` is a lightweight, event-driven orchestration engine designed to bring **clarity and control** to complex asynchronous workflows. It transforms tangled processes into clean, observable, and milestone-driven automation.

Whether you're coordinating data pipelines, managing background jobs, or building resilient micro-services, Synchronik provides the core components to let your code orchestrate itself while you focus on the business logic.

### 🎯 Key Features

* **Declarative Workflows:** Define complex processes as simple `SynchronikWorker` and `SynchronikProcess` objects.
* **Dependency Graphs:** Create powerful, conditional workflows using the `dependsOn` property to orchestrate tasks with precision.
* **Event-Driven Architecture:** Subscribe to the entire lifecycle of your tasks. React to `start`, `complete`, `error`, and custom `milestone` events in real-time.
* **Built-in Performance & Resource Monitoring:** Automatically track worker execution times and monitor the engine's CPU and memory usage.
* **Resilience and Retries:** Configure automatic retries with exponential backoff for workers, making your workflows fault-tolerant.
* **State Persistence & Hydration:** Save the engine's state to a file and automatically reload it on restart, making workflows resilient to crashes and deployments.
* **Flexible Run Modes:** Execute workers `sequentially`, in `parallel`, in `batched` groups, or `isolated` with delays.
* **Automatic & Manual Control:** Run tasks on a scheduled interval or trigger them manually via a clean API.

---

## 🤔 Why Synchronik?

Modern Node.js applications often involve complex asynchronous operations that can become difficult to manage, observe, and debug. Synchronik addresses these challenges by providing a structured framework to solve common problems:

* **❌ Problem: "Callback Hell" & Unstructured `async/await` Chains.**
  * **✅ Solution:** Synchronik lets you define each step as a distinct `Worker` and orchestrate them within a `Process`, turning tangled code into a clean, declarative workflow.
* **❌ Problem: Lack of Visibility into Background Jobs.**
  * **✅ Solution:** The event-driven architecture emits events for every lifecycle change, while built-in monitoring provides live insights into performance and resource usage.
* **❌ Problem: Handling Failures and Retries is Repetitive.**
  * **✅ Solution:** Define `maxRetries` and `retryDelayMs` on your workers, and the engine handles the rest, complete with `onError` hooks for final failure states.
* **❌ Problem: Server Restarts or Crashes Lose All Progress.**
  * **✅ Solution:** The new State Persistence feature saves the engine's state to a file, allowing it to "remember" the status of all workflows and resume exactly where it left off.

---

## 🚀 Getting Started

### Installation

Install the package using npm:

```bash
npm install synchronik
````

### Basic Usage

You can create an instance of the manager and define a basic Worker to start orchestrating:

```typescript
import { createSynchronikManager } from 'synchronik';

// 1. Create the manager
const manager = createSynchronikManager();

// 2. Define a worker (your business logic)
const myWorker: SynchronikWorker = {
  id: 'daily-report-worker',
  status: 'idle',
  run: async () => { 
    console.log('Generating the daily report...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
    console.log('Report generation complete!');
  }
};

// 3. Register the worker
manager.registerUnit(myWorker);

// 4. Start the engine and manually run the worker
manager.start();
await manager.runWorkerById('daily-report-worker');

// 5. Clean up
await manager.stop();
```

---

## 💾 State Persistence & Hydration

A core feature of a production-grade workflow engine is resilience. The Synchronik engine achieves this through its **State Persistence and Hydration** mechanism. This allows the engine to save its entire state to a persistent storage and reload it upon restart, ensuring that no progress is lost.

### How It Works: The Storage Adapter

The feature is designed around a simple `StorageAdapter` interface. Synchronik ships with a default `FileStorageAdapter` that saves the engine's state to a local JSON file.

1. **Initialization & Hydration**: When you initialize the manager with a storage adapter, it first calls `adapter.loadState()`. If state is found, the manager "hydrates" itself, merging the persisted data (like `status`, `meta`, `runCount`) into the worker and process definitions that have been registered in your code.
2. **Automatic Saving**: After hydration, any action that changes the state of a unit (e.g., a worker's status changing or a configuration update) will automatically trigger a call to `adapter.saveState()`, persisting the new state.

### Usage

Using the persistence feature is straightforward.

1. Import `createSynchronikManager` and `FileStorageAdapter`.
2. Create an instance of the manager and the adapter.
3. **Register your units first.** This is crucial because the adapter only saves data, not functions. The `run` methods must be available in memory for hydration to work.
4. Call `await manager.useStorage(adapter)`.

```typescript
import { createSynchronikManager } from 'synchronik';
import { FileStorageAdapter } from 'synchronik'; // Adjust path as needed

const manager = createSynchronikManager();
const adapter = new FileStorageAdapter("my-app-state.json");

// 1. Register all your workers and processes
manager.registerUnit(myWorker);

// 2. Initialize storage. This will load the state from the file if it exists.
await manager.useStorage(adapter);

// Now the manager is ready, with its state restored from the last run.
manager.start();
```

### Benefits

* **Resilience**: Your workflows can survive server crashes and restarts.
* **Zero-Downtime Deployments**: A new server process can be deployed and will pick up the state exactly where the old one left off.
* **Scalability Foundation**: While the `FileStorageAdapter` is for single-node persistence, you can implement a custom adapter (e.g., for Redis or a database) to enable a multi-node, horizontally-scaled architecture.

---

## ✨ Advanced Workflows with `dependsOn`

The engine now supports the creation of complex workflows where workers can depend on the successful completion of other workers. This transforms Synchronik from a simple task runner into a true workflow orchestrator.

### Basic Usage

Define a simple dependency by adding a `dependsOn` array with the ID of the prerequisite worker. In this example, `worker-B` will only start after `worker-A` has successfully completed.

```typescript
const workerA = {
  id: 'A-prepare-data',
  name: 'Prepare Data',
  run: async () => { /* ... */ }
};

const workerB = {
  id: 'B-process-data',
  name: 'Process Data',
  run: async () => { /* ... */ },
  dependsOn: ['A-prepare-data'] // Depends on worker A
};
```

### Conditional Dependencies

For dynamic workflows, you can define a dependency as an object that includes a `condition` function. This function receives the result from the parent worker and must return `true` for the dependency to be met.

**Example:** Run `thorough-cleanup` only if the processed video was long.

```typescript
import type { SynchronikWorker, Dependency } from "./types/synchronik";

// 1. The parent worker returns a result
const ffmpegWorker: SynchronikWorker = {
    id: 'ffmpeg-process',
    run: async () => {
        const duration = 125; // seconds
        return { duration }; // This result is passed to the condition
    }
};

// 2. The dependent worker defines a condition
const thoroughCleanup: SynchronikWorker = {
    id: 'thorough-cleanup',
    dependsOn: [{
        id: 'ffmpeg-process',
        condition: (result) => result.duration >= 60
    }]
};
```

---

## 🏛️ Core Engine Architecture

The Synchronik engine is built around a modular architecture orchestrated by a central `SynchronikManager`. Understanding the internal components helps in advanced usage and extension.

| Component | File (`src/core/`) | Role |
| :--- | :--- | :--- |
| **Manager** | `manager.ts` | The main public interface. It integrates all other components and provides the high-level API for controlling the engine. |
| **Reactive Registry** | `ReactiveRegistry.ts` | A reactive, in-memory database that stores unit state and automatically handles status propagation, event emission, and state persistence. |
| **Lifecycle** | `lifecycle.ts` | Manages the registration and release of units, ensuring state changes are valid. |
| **Event Bus** | `event.ts` | A publish-subscribe system that broadcasts events (`start`, `complete`, `error`, `milestone`) across the engine. |
| **Loop** | `loop.ts` | The heart of automatic execution. It runs on a configurable interval, identifies idle units, and executes them. |
| **Watcher** | `watcher.ts` | A background process that scans for stale or stuck units to ensure engine health and resilience. |
| **Storage Adapter** | `storage/FileStorageAdapter.ts` | Handles saving and loading the engine's state to a persistent medium (e.g., a file), enabling resilience across restarts. |
| **Dashboard** | `dashboard.ts` | An optional console utility for visualizing the state of the engine in real-time. |

---

## 🧑‍💻 The SynchronikManager API

The `SynchronikManager` is the primary abstraction and your main entry point for interacting with the engine.

### Creating a Manager

You can create a manager instance using the `createSynchronikManager` factory function:

```typescript
import { createSynchronikManager } from 'synchronik';

// Create a manager that automatically emits resource stats every 5 seconds
const manager = createSynchronikManager({
  loopInterval: 1000, // Main execution loop interval
  statsEmissionIntervalMs: 5000 
});
```

### Core Lifecycle Methods

These methods control the overall state of the engine:

* `manager.start()`: Starts the engine's background processes, including the main execution loop and the watcher.

    ```typescript
    manager.start();
    console.log("Synchronik engine is running.");
    ```

* `manager.stop()`: Gracefully stops the engine. It clears background intervals and attempts to complete any in-progress work.

    ```typescript
    await manager.stop();
    console.log("Synchronik engine has stopped.");
    ```

* `manager.startAll()` / `manager.stopAll()`: Provides bulk control over all registered units, setting their status to `idle` or `paused`, respectively.

    ```typescript
    // Pause all operations
    manager.stopAll(); 

    // Resume all operations
    manager.startAll(); 
    ```

### Unit Registration and Management

These methods allow you to add, remove, and inspect units in the engine:

* `manager.registerUnit(unit)`: Adds a new worker or process to the engine's registry.

    ```typescript
    const myWorker = {
      id: 'my-first-worker',
      status: 'idle',
      run: async () => { console.log('Worker is running!'); }
    };
    manager.registerUnit(myWorker);
    ```

* `manager.releaseUnit(id)`: Removes a unit from the registry.

    ```typescript
    manager.releaseUnit('my-first-worker');
    ```

* `manager.updateWorkerConfig(workerId, config)` / `manager.updateProcessConfig(processId, config)`: **Asynchronously** updates the configuration of a registered unit at runtime.

    ```typescript
    // This method is now async and should be awaited
    await manager.updateWorkerConfig('data-ingestion-worker', { maxRetries: 5 });
    ```

* `manager.updateStatus(unitId, status)`: **Asynchronously** sets the status of a unit (e.g., resetting a failed worker to `idle`).

    ```typescript
    // This method is now async and should be awaited
    await manager.updateStatus('failing-worker', 'idle');
    ```

* `manager.listUnits()`: Returns an array of all currently registered units.

    ```typescript
    const allUnits = manager.listUnits();
    console.log(`There are ${allUnits.length} units registered.`);
    ```

### Observability & Monitoring

Synchronik is designed to be highly observable. You can monitor everything from individual worker completions to the engine's own resource usage.

### Manual Execution

Trigger workers or processes manually outside of the main execution loop:

* `manager.runWorkerById(id)`: Immediately executes a single worker by its ID.

    ```typescript
    await manager.runWorkerById('my-first-worker');
    ```

* `manager.runProcessById(id)`: Executes a process and all of its associated workers.

    ```typescript
    await manager.runProcessById('my-process');
    ```

### Event Subscription and Milestones

Monitor activity via the event bus:

* `manager.subscribeToEvents(listener)`: Subscribes to all core events (`start`, `complete`, `error`, `milestone`). Returns an unsubscribe function.

    ```typescript
    const unsubscribe = manager.subscribeToEvents(event => {
      console.log(`Event received: ${event.type} for unit ${event.unitId}`);
    });

    // Later, to stop listening:
    // unsubscribe(); 
    ```

* `manager.onMilestone(handler)`: A convenience method to subscribe only to milestone events.

    ```typescript
    manager.onMilestone((milestoneId, payload) => {
      console.log(`Milestone: ${milestoneId}`, payload);
    });
    ```

* `manager.emitMilestone(id, payload)`: Allows you to emit your own custom milestones from anywhere in your application.

    ```typescript
    manager.emitMilestone('user-logged-in', { userId: 123 });
    ```

---

## 🚀 Runnable Examples

You can find runnable code examples in the `examples/` directory. These provide practical demonstrations of `Synchronik`'s features.

* **`1-basic-worker.ts`**: A "Hello World" example showing how to create and run a simple worker on a schedule.
* **`2-advanced-process.ts`**: Demonstrates the `runWorkerTasks` utility for processing a list of sub-tasks with fault tolerance and retries.
* **`3-showcase-physics.ts`**: A multi-step sequential process that performs a series of calculations, showcasing how to model an ordered workflow.
* **`4-resilient-scraper.ts`**: A real-world example of a fault-tolerant API scraper that uses retries and progress reporting.
* **`5-multi-stage-pipeline.ts`**: Shows how to chain multiple processes together, each with a different `runMode` (`parallel`, `batched`, `sequential`) to create a complex pipeline.
* **`6-health-monitor.ts`**: A live system monitor using interval-based workers to check the status of services.
* **`7-dynamic-health-monitor.ts`**: An advanced health monitor that uses a `WorkerPool` to dynamically queue and execute health checks efficiently.
* **`8-status-tracker-usage.ts`**: Demonstrates how to use the status tracker to monitor and react to unit status changes.
* **`9-dependency-graph-usage.ts`**: Demonstrates the powerful `dependsOn` feature to create complex, conditional workflows.
* **`10-persistent-engine.ts`**: A real-world demonstration of the State Persistence feature, showing how the engine can remember its state across restarts.

---

## � Project Structure

For a professional, maintainable service like Synchronik, a logical folder structure is essential. This structure cleanly separates the source code (`src`) from configuration files and build outputs (`dist`):

```bash
synchronik/
├── src/
│   ├── core/
│   │   ├── manager.ts
│   │   ├── registry.ts
│   │   ├── ReactiveRegistry.ts
│   │   ├── lifecycle.ts
│   │   ├── event.ts
│   │   ├── loop.ts
│   │   ├── watcher.ts
│   │   ├── FileStorageAdapter.ts
│   │   └── dashboard.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── ... (other type definition files)
│   ├── index.ts           # Main library entry point
│   └── app.ts             # Example usage file
├── dist/                  # Compiled JavaScript output
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

---

## 🤝 Contribution & License

This project is a personal development effort by **Owen**.

This project is licensed under the **Apache-2.0 License**. See the `LICENSE` file for details.
