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
[![Build Status](https://img.shields.io/github/actions/workflow/status/owen-6936/synchronik/publish.yml?branch=release/v1.2.1)](https://github.com/owen-6936/synchronik/actions/workflows/publish.yml)
[![JSR](https://jsr.io/badges/@nexicore/synchronik)](https://jsr.io/@nexicore/synchronik)
![npm version](https://img.shields.io/npm/v/synchronik)

---

## 📖 Overview

`Synchronik` is a lightweight, event-driven orchestration engine designed to bring **clarity and control** to complex asynchronous workflows. It transforms tangled processes into clean, observable, and milestone-driven automation.

Whether you're coordinating data pipelines, managing background jobs, or building resilient micro-services, Synchronik provides the core components to let your code orchestrate itself while you focus on the business logic.

### 🎯 Key Features

* **Modular Architecture:** Composed of distinct, swappable components (`Manager`, `Registry`, `Loop`, `Watcher`) for clear separation of concerns.
* **Event-Driven:** Subscribe to the entire lifecycle of your tasks. React to `start`, `complete`, `error`, and custom `milestone` events in real-time.
* **Robust State Management:** Reliably track the status of every task (`idle`, `running`, `paused`, `completed`, `error`).
* **Automatic & Manual Control:** Run tasks on a scheduled interval with the main execution loop or trigger them manually via the API.
* **Extensible by Design:** Register your own asynchronous functions as **Workers** and group them into **Processes**.
* **Resilience Built-In:** Includes a `Watcher` to detect and handle stale or stuck tasks, ensuring your engine remains healthy.
* **Visualization Hooks:** The event bus makes it trivial to connect real-time dashboards and monitoring tools.

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
const myWorker = {
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
await manager.runUnitById('daily-report-worker');

// 5. Clean up
await manager.stop();
```

---

## 🏛️ Core Engine Architecture

The Synchronik engine is built around a modular architecture orchestrated by a central `SynchronikManager`. Understanding the internal components helps in advanced usage and extension.

| Component | File (`src/core/`) | Role |
| :--- | :--- | :--- |
| **Manager** | `manager.ts` | The main public interface. It integrates all other components and provides methods to control the engine's lifecycle and API. |
| **Registry** | `registry.ts` | An in-memory database that stores the state and configuration of all registered units (workers and processes). |
| **Lifecycle** | `lifecycle.ts` | Manages the registration, state updates, and release of units, ensuring state changes are valid. |
| **Event Bus** | `event.ts` | A publish-subscribe system that broadcasts events (`start`, `complete`, `error`, `milestone`) across the engine. |
| **Status Tracker**| `status-tracker.ts` | Manages the setting and tracking of unit status, acting as the single source of truth for state changes. |
| **Loop** | `loop.ts` | The heart of automatic execution. It runs on a configurable interval, identifies idle units, and executes them. |
| **Watcher** | `watcher.ts` | A background process that scans for stale or stuck units to ensure engine health and resilience. |
| **Dashboard** | `dashboard.ts` | An optional console utility for visualizing the state of the engine in real-time. |

---

## 🧑‍💻 The SynchronikManager API

The `SynchronikManager` is the primary abstraction and your main entry point for interacting with the engine.

### Creating a Manager

You can create a manager instance using the `createSynchronikManager` factory function:

```typescript
import { createSynchronikManager } from 'synchronik';

const manager = createSynchronikManager();
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

* `manager.updateUnitConfig(unitId, config)`: Updates the configuration of a registered unit at runtime (e.g., increasing retries).

    ```typescript
    manager.updateUnitConfig('data-ingestion-worker', { maxRetries: 5 });
    ```

* `manager.updateStatus(unitId, status)`: Manually sets the status of a unit (e.g., resetting a failed worker to `idle`).

    ```typescript
    manager.updateStatus('failing-worker', 'idle');
    ```

* `manager.listUnits()`: Returns an array of all currently registered units.

    ```typescript
    const allUnits = manager.listUnits();
    console.log(`There are ${allUnits.length} units registered.`);
    ```

### Manual Execution

Trigger units manually outside of the main execution loop:

* `manager.runUnitById(id)`: Immediately executes a single unit (worker or process) by its ID.

    ```typescript
    await manager.runUnitById('my-first-worker');
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

---

## � Project Structure

For a professional, maintainable service like Synchronik, a logical folder structure is essential. This structure cleanly separates the source code (`src`) from configuration files and build outputs (`dist`):

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
