# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v2.3.0] - 2025-11-29

### ✨ Added (v2.3.0)

- **State Persistence & Hydration**:
  - Introduced a major new feature to make workflows resilient to server restarts and crashes.
  - Added a `StorageAdapter` interface for saving and loading engine state.
  - Shipped a default `FileStorageAdapter` to persist state to a local JSON file.
  - Added a new `manager.useStorage(adapter)` method to initialize persistence. The engine now automatically saves state changes and hydrates itself on startup.

### ♻️ Changed (v2.3.0)

- **Asynchronous State-Changing Operations**:
  - To support persistence, several methods on the `SynchronikManager` are now `async` and must be awaited. This is a crucial change for ensuring state is saved before proceeding.
  - Affected methods include: `updateStatus`, `updateWorkerConfig`, `updateProcessConfig`, `enableWorker`, `disableWorker`, `enableProcess`, and `disableProcess`.

### 🐛 Fixed (v2.3.0)

- **Correct `runCount` in Manual Runs**: Fixed a critical bug where `runWorkerById` would not increment the worker's `runCount` metadata after a successful run, causing state hydration to appear incorrect. The `runCount` is now reliably updated for all execution types.

---

## [v2.2.0] - 2025-11-27

### ✨ Added (v2.2.0)

- **Enhanced Manager API**:
  - **Direct Accessors**: Added `getUnitById`, `getWorkerById`, and `getProcessById` for direct and convenient access to registered units.
  - **Manual Triggers**: Added `runLoopOnce()` and `runWatcherScan()` to manually trigger core background processes, improving testability and control.
  - **Convenient Event Subscriptions**: Added `onStart`, `onComplete`, and `onError` methods for cleaner, type-safe event handling.

### ♻️ Changed (v2.2.0)

- **Predictable Event Payloads**:
  - All system-generated milestone events (e.g., for status changes, registration, release) now include a rich, consistent payload containing the full unit object and a `reason` field. This eliminates the need to parse `milestoneId` strings.
- **True Snapshot with `getRegistrySnapshot`**:
  - The `manager.getRegistrySnapshot()` method now performs a deep clone of the registry state, providing a true, isolated snapshot that is safe to mutate without affecting the live engine. Function properties are correctly omitted to prevent cloning errors.

### 🐛 Fixed (v2.2.0)

- Resolved a `DataCloneError` in `getRegistrySnapshot` by ensuring non-serializable function properties are omitted before cloning.
- Corrected an API inconsistency where `listWorkers` and `listProcesses` were incorrectly marked as optional in the `SynchronikManager` type definition.

---

## [v2.1.0] - 2025-11-27

### ✨ Added (v2.1.0)

- **Worker Performance Metrics**:
  - The engine now automatically calculates and stores performance metrics on each worker's `meta` object upon successful completion.
  - `meta.executionTimesMs`: An array containing the duration of each run in milliseconds.
  - `meta.averageExecutionTimeMs`: The average execution time calculated from all runs.
- **Engine Resource Monitoring (`getEngineStats`)**:
  - Introduced a new `manager.getEngineStats()` method to provide a snapshot of the engine's resource consumption.
  - Returns memory usage (`rss`, `heapTotal`, `heapUsed`) and CPU usage as a percentage calculated since the last call.
- **Automatic Stats Emission**:
  - Added a new `statsEmissionIntervalMs` option to `createSynchronikManager`.
  - When set, the manager will automatically emit the engine's resource stats on a regular interval via a new `engine:stats` milestone.

### ♻️ Changed (v2.1.0)

- **Enriched `completed` Event Payload**: The milestone event for a worker's `completed` status now includes a `durationMs` property in its payload, providing immediate access to the last run's execution time.

---

## [v2.0.0] - 2025-11-21

### ✨ Added (v2.0.0)

- **Dependency-Based Workflows (`dependsOn`)**:
  - Introduced a powerful `dependsOn` property on `SynchronikWorker` to create complex execution graphs.
  - Supports both basic dependencies (`dependsOn: ['worker-A']`) and **conditional dependencies** (`dependsOn: [{ id: 'worker-A', condition: (result) => ... }]`) for dynamic, branching workflows.
  - The engine automatically detects and executes workflows as a dependency graph (DAG) if any worker uses this feature.
  - Includes robust circular dependency detection to prevent invalid workflows.
- **Enhanced Logging for Dependency Graphs**: Added console logging to explicitly show when a worker is skipped due to an unmet condition, dramatically improving the debuggability of complex workflows.
- **API Clarity and Consistency**:
  - Added new, more specific API methods for managing units: `disableWorker`, `enableWorker`, `disableProcess`, and `enableProcess`.

### ♻️ Changed (v2.0.0)

- **Major Architectural Refactor (Reactive Registry)**:
  - The core state management has been completely overhauled. The separate `StatusTracker` and `registry` have been replaced by a single, intelligent `ReactiveRegistry`.
  - **Automatic Status Propagation**: The `ReactiveRegistry` now automatically calculates and updates a process's status based on its workers' states, simplifying logic and increasing robustness.
  - **Unified Event Emission**: Milestone and error events are now emitted directly from the registry in response to state changes.
- **API Deprecations**:
  - The generic `disableUnit` and `enableUnit` methods have been marked as `@deprecated` in favor of the new, more specific `disableWorker`/`disableProcess` methods.

### ⛔ Removed (v2.0.0)

- **`StatusTracker` Module**: As part of the architectural refactor, the standalone `status-tracker.ts` module has been removed. Its logic is now integrated directly into the `ReactiveRegistry`.

---

### ⚠️ BREAKING CHANGES (v2.0.0)

- **Internal Architecture**: While the public-facing `SynchronikManager` API remains largely backward-compatible, the removal of the `StatusTracker` and the introduction of the `ReactiveRegistry` represent a fundamental change in the engine's internal architecture. Any advanced integrations that directly interacted with the old registry or tracker will need to be updated.
- **Dependency Graph Execution**: When `dependsOn` is used within a process, the process's `runMode` (`parallel`, `sequential`, etc.) is now ignored in favor of the dependency graph execution strategy.

## [v1.2.1] - 2025-11-11

### ✨ Added (v1.2.1)

- **`runOnInterval` for `SynchronikWorker`**: Added a boolean property `runOnInterval` to `SynchronikWorker`. When `true`, the worker is automatically executed by the engine's main loop based on its `intervalMs`. This provides explicit control over which workers participate in automatic scheduling.
- **`maxRuns` for `SynchronikWorker`**: Introduced an optional `maxRuns` property to `SynchronikWorker` to specify the maximum number of times a worker should run before being automatically disabled. This count includes both manual and interval-based runs.
- **`stopWorkerById` Method**: Added `manager.stopWorkerById(workerId)` to explicitly disable a worker at runtime.
- **`disableUnit` and `enableUnit` Methods**: Added `manager.disableUnit(id)` and `manager.enableUnit(id)` for generic control over any unit's enabled state.
- **`updateWorkerConfig` and `updateProcessConfig` Methods**: Introduced dedicated, type-safe methods for runtime configuration updates of workers and processes.
- **Dynamic Worker Pool Resizing**: Added a `resize(newSize)` method to the `WorkerManager` to allow dynamic scaling of the worker pool at runtime.
- **`onProgress` Callback for `runWorkerTasks`**: Added an optional `onProgress` callback to `runWorkerTasks` to provide real-time progress updates during sub-task execution.
- **`meta` Property on `SynchronikUnit`**: Added a `meta` object to all units for storing arbitrary metadata, now used for `runCount`.

### ♻️ Changed (v1.2.1)

- **Improved Error Propagation**: Enhanced the error handling chain to ensure the original `Error` object from a failing worker is correctly propagated to the final `error` event, providing specific and actionable error messages.
- **Refined Interval Loop Logic**: Reworked the core loop to correctly handle worker states. It now has two distinct phases: one for process-based execution and a new, separate phase for interval-based worker execution.
- **Accurate `runCount` Incrementing**: Ensured the `runCount` metadata is consistently incremented for all worker executions, whether triggered manually or by the interval loop.
- **Clean Handoff from Manual to Interval Runs**: Modified the manual `runProcessById` execution to correctly prepare interval-based workers for immediate scheduling by the loop, preventing timing conflicts.
- **Consolidated Type Definitions**: Refactored `src/types/synchronik.ts` to remove duplicate interfaces and add comprehensive JSDoc for all public-facing types and methods.

### 🐛 Fixed (v1.2.1)

- Resolved a timing issue where interval-based workers would "miss" their first scheduled run after a manual trigger.
- Fixed a `TypeError` where `manager.stopWorkerById` was not correctly exposed on the `SynchronikManager` interface.
- Corrected the `onProgress` callback in `runWorkerTasks` to report progress accurately after all retries for a task are exhausted.
- Fixed an issue where `maxRuns` was not being correctly applied due to an off-by-one error in run counting.

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
