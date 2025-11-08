# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.0.0] - 2025-11-07

### ✨ Added

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
