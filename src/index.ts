/**
 * @file Synchronik - Main entry point
 * @description This file exports the core functionalities and types of the Synchronik engine,
 * making them available for consumers of the library.
 */

export { createSynchronikManager } from "./core/manager.js";
export { runWorkerTasks } from "./utils/task-runner.js";
export { createSynchronikDashboard } from "./core/dashboard.js";
export { createSynchronikVisualizer } from "./core/visualizer.js";
export { createSynchronikLifecycle } from "./core/lifecycle.js";
export { createStatusTracker } from "./core/status-tracker.js";
export { createSynchronikLoop } from "./core/loop.js";
export { createUnitWatcher } from "./core/watcher.js";
export { SynchronikEventBus, createMilestoneEmitter } from "./core/event.js";
export { createSynchronikRegistry } from "./core/registry.js";
export { SynchronikWorkerManager } from "./core/workers-manager.js";

export type {
    Task,
    WorkerMeta,
    PreRunSequence,
    WorkerStatus,
    WorkerManager,
    MilestoneEmitter,
    RunMode,
    SynchronikLifecycle,
    StatusTracker,
    SynchronikLoop,
    UnitWatcher,
    ISynchronikEventBus,
    SynchronikDashboard,
    Status,
    SynchronikManager,
    SynchronikUnit,
    SynchronikWorker,
    SynchronikProcess,
    SynchronikEvent,
    SynchronikVisualizer,
    RegistryState,
    SynchronikRegistry,
    UpdateProcessConfig,
    UpdateWorkerConfig,
} from "./types/synchronik.js";
