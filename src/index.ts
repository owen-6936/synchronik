/**
 * @file Synchronik - Main entry point
 * @description This file exports the core functionalities and types of the Synchronik engine,
 * making them available for consumers of the library.
 */

export { createSynchronikManager } from "./core/manager.js";
export { createSynchronikDashboard } from "./core/dashboard.js";

export type {
  Task,
  SynchronikManager,
  SynchronikUnit,
  SynchronikWorker,
  SynchronikProcess,
  SynchronikEvent,
  SynchronikVisualizer,
} from "./types/synchronik.js";
