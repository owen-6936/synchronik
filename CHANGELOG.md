# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.1.0] - 2025-11-09

### ✨ Added (v1.1.0)

- **Configurable `isolationDelayMs` for `isolated` run mode:**
  - The `isolated` run mode now accepts an optional `isolationDelayMs` property on `SynchronikProcess` to customize the delay between worker executions. Defaults to 100ms.
- **`runWorkerTasks` Utility (Task Containerizer):**
  - Introduced a new utility function `runWorkerTasks` for declarative, fault-tolerant processing of lists of sub-tasks within a worker.
  - Supports retries with exponential backoff for individual sub-tasks.
  - Provides a detailed `TaskRunnerResult` including `successful`, `failed` tasks, and `successPercentage`.
  - Designed to be called from within a `SynchronikWorker`'s `run` method, allowing workers to report on internal task success/failure without the worker itself entering an `error` state.
- **`onError` Hook for `SynchronikUnit`:**
  - Added an optional `onError` callback to the `SynchronikUnit` interface. This hook is invoked when a worker (or process) fails permanently after exhausting all its retries.
  - Provides a direct, unit-specific mechanism for handling critical failures.
- **`updateUnitConfig` Method on `SynchronikManager`:**
  - Added a new `manager.updateUnitConfig(unitId, config)` method to allow dynamic, runtime modification of any unit's properties (e.g., `maxRetries`, `retryDelayMs`).
  - Enables adaptive and responsive workflow management.

### ♻️ Changed

- **Enhanced `batched` and `parallel` run modes for fault tolerance:**
  - Switched the internal execution mechanism for `batched` and `parallel` run modes from `Promise.all()` to `Promise.allSettled()`.
  - This ensures that a failure in one worker within a batch or parallel group will **not** stop the execution of other workers in that same group. The process will continue, and individual worker failures will be reported.
- **Centralized Worker Execution Logic:**
  - Refactored the core worker execution, retry, and timeout logic into a new shared utility function `executeWorkerWithRetry`.
  - This ensures consistent behavior for workers whether they are triggered manually via `manager.runWorkerById` or automatically by the engine's `loop`.
- **Dynamic Retry Configuration:**
  - The `executeWorkerWithRetry` utility now re-reads `maxRetries` and `timeoutMs` from the worker's configuration on each retry attempt. This allows `manager.updateUnitConfig` to dynamically alter retry behavior even mid-execution.
- **Flexible `retryDelayMs`:**
  - The `retryDelayMs` property on `SynchronikWorker` now supports both a fixed number (milliseconds) and a function that calculates a dynamic delay (e.g., for exponential backoff) based on the current attempt number.

### 🐛 Fixed

- Resolved an issue where `runMode` was not correctly referenced in milestone payloads after refactoring, ensuring consistent event data.

---

## [v1.0.0] - 2025-11-07

### ✨ Added (Initial Release)

#### Core Engine (`SynchronikManager`)

- **Process & Worker Orchestration:** Introduced the core `createSynchronikManager` for defining and running structured workflows.
- **Process (`SynchronikProcess`):** Ability to group multiple workers into a single, manageable unit.
- **Flexible Run Modes:** Processes can execute their workers with different strategies:
  - `sequential`: One after another.
  - `parallel`: All at the same time.
  - `isolated`: Sequentially with a small delay.
  - `batched`: Concurrently in small, configurable groups.
- **Event-Driven Architecture:** A robust event bus (`SynchronikEventBus`) that emits lifecycle events (`start`, `complete`, `error`) and custom milestones.
- **Status Tracking:** Centralized `StatusTracker` to reliably manage the state of all units (`idle`, `running`, `paused`, `completed`, `error`).
- **Automatic Execution Loop:** A background loop to automatically run `idle` units at a configurable interval.
- **Unit Watcher:** A resilience mechanism to monitor and handle stale or stuck units.

#### Worker Pool (`WorkerManager`)

- **Integrated Worker Pool:** Added a `useWorkerPool()` method to the `SynchronikManager` to create and manage a pool of reusable workers for dynamic task queuing.
- **Task Management API:**
  - `addTask`: Add a new task with its `execute` function to a prioritized queue.
  - `pauseTask`: Pause a pending task, which also blocks all subsequent tasks.
  - `resumeTask`: Resume a paused task, allowing the queue to proceed.
  - `cancelTask`: Remove a task from the pending queue entirely.
- **Pre-Run Simulation:** Added a `simulateRun()` method to preview the execution order of pending tasks without running them.

#### Tooling & Documentation

- **Comprehensive Test Suite:** Implemented a full suite of unit tests using `vitest` to ensure the stability and correctness of all core components and the worker pool.
- **Showcase Test:** Created a "Projectile Motion Lecture" showcase to demonstrate a real-world, multi-step orchestration.
- **JSDoc Documentation:** Added extensive JSDoc comments across the entire codebase.
- **TypeDoc Configuration:** Set up `typedoc.json` to generate HTML documentation.
- **Publishing Workflow:** Created a `jsr.json` file and a GitHub Actions workflow (`publish.yml`) for automated publishing to JSR.
- **Professional `README.md`:** Wrote comprehensive documentation explaining the core concepts, basic usage, and advanced worker pool functionality.

### 🚀 Initial Release

- This marks the first stable, feature-complete release of the Synchronik engine, ready for production use.
