"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createSynchronikDashboard: () => createSynchronikDashboard,
  createSynchronikManager: () => createSynchronikManager
});
module.exports = __toCommonJS(index_exports);

// src/core/event.ts
var import_stream = require("stream");
var SynchronikEventBus = class {
  emitter = new import_stream.EventEmitter();
  /**
   * Emits an event to all listeners subscribed to the event's type.
   * @param event The event object to emit.
   */
  emit(event) {
    this.emitter.emit(event.type, event);
  }
  /**
   * Subscribes a listener to a specific event type.
   * @param type The type of event to listen for.
   * @param listener A callback function that will be invoked when the event is emitted.
   * @returns An unsubscribe function to remove the listener.
   */
  subscribe(type, listener) {
    const wrapped = (event) => {
      if (event.type === type) {
        listener(event);
      }
    };
    this.emitter.on(type, wrapped);
    return () => this.emitter.off(type, wrapped);
  }
  /**
   * Subscribes a listener to all event types.
   * @param listener A callback function that will be invoked for any event.
   * @returns An unsubscribe function to remove the listener.
   */
  subscribeAll(listener) {
    const types = [
      "start",
      "complete",
      "error",
      "milestone"
    ];
    types.forEach((type) => this.emitter.on(type, listener));
    return () => types.forEach((type) => this.emitter.off(type, listener));
  }
};
function createMilestoneEmitter(eventBus) {
  return {
    /**
     * Emits a generic milestone event.
     * @param milestoneId A unique identifier for the milestone.
     * @param payload Optional data to include with the event.
     */
    emit(milestoneId, payload = {}) {
      eventBus.emit({ type: "milestone", milestoneId, payload });
    },
    /**
     * Emits a milestone event specifically for a unit's lifecycle stage (e.g., 'completed', 'released').
     * @param unitId The ID of the unit.
     * @param stage The lifecycle stage (e.g., 'completed', 'released').
     * @param payload Optional data to include with the event.
     */
    emitForUnit(unitId, stage, payload = {}) {
      const milestoneId = `unit:${unitId}:${stage}`;
      eventBus.emit({ type: "milestone", milestoneId, payload });
    }
  };
}

// src/core/lifecycle.ts
function createSynchronikLifecycle(registry, eventBus, milestoneEmitter) {
  return {
    /**
     * Registers a new unit with the engine.
     * @param unit The unit to register.
     */
    register(unit) {
      registry.registerUnit(unit);
      eventBus.emit({ type: "start", unitId: unit.id });
    },
    /**
     * Updates the state of an existing unit.
     * @param id The ID of the unit to update.
     * @param updates A partial object of properties to update.
     */
    update(id, updates) {
      registry.updateUnitState(id, updates);
      if (updates.status === "error") {
        eventBus.emit({
          type: "error",
          unitId: id,
          error: new Error(`Unit ${id} entered error state`)
        });
      } else if (updates.status === "completed") {
        eventBus.emit({
          type: "complete",
          unitId: id
        });
      }
    },
    /**
     * Releases a unit from the engine, removing it from the registry.
     * @param id The ID of the unit to release.
     */
    release(id) {
      registry.releaseUnit(id);
      milestoneEmitter.emit(`unit:${id}:released`);
    },
    /**
     * Emits a custom milestone event.
     * @param milestoneId A unique identifier for the milestone.
     * @param payload Optional data to include with the milestone.
     */
    emitMilestone(milestoneId, payload) {
      milestoneEmitter.emit(milestoneId, payload);
    }
  };
}

// src/core/loop.ts
function createSynchronikLoop(registry, tracker) {
  async function runWorker(worker, processId) {
    if (worker.status === "paused" || worker.status === "completed") return;
    tracker.setStatus(worker.id, "running");
    const retries = worker.maxRetries ?? 0;
    const timeoutMs = worker.timeoutMs ?? 1e4;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await Promise.race([
          worker.run(),
          new Promise(
            (_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)
          )
        ]);
        tracker.setStatus(worker.id, "completed", {
          emitMilestone: true,
          payload: { processId, attempt }
        });
        return;
      } catch (err) {
        if (attempt === retries) {
          try {
            tracker.setStatus(worker.id, "error", {
              emitMilestone: true,
              payload: {
                processId,
                error: String(err.message),
                attempt
              }
            });
          } catch (trackerError) {
            console.error("Tracker failed to set error status:", trackerError);
          }
        }
      }
    }
  }
  return {
    async run() {
      const processes = registry.listProcesses();
      for (const process of processes) {
        if (process.status === "paused") continue;
        tracker.setStatus(process.id, "running");
        const workers = process.workers.filter(
          (w) => w.enabled && w.status !== "completed" && w.status !== "paused"
        );
        const runMode = process.runMode ?? "sequential";
        tracker.setStatus(process.id, "running", {
          emitMilestone: true,
          payload: { runMode }
        });
        if (runMode === "parallel") {
          await Promise.all(workers.map((w) => runWorker(w, process.id)));
        } else if (runMode === "isolated") {
          for (const worker of workers) {
            await runWorker(worker, process.id);
            await new Promise((r) => setTimeout(r, 100));
          }
        } else {
          for (const worker of workers) {
            await runWorker(worker, process.id);
          }
        }
        tracker.setStatus(process.id, "completed", {
          emitMilestone: true,
          payload: { runMode }
        });
      }
    }
  };
}

// src/core/registry.ts
function createSynchronikRegistry() {
  const units = /* @__PURE__ */ new Map();
  const workers = /* @__PURE__ */ new Map();
  const processes = /* @__PURE__ */ new Map();
  return {
    registerUnit(unit) {
      units.set(unit.id, unit);
      if ("run" in unit) {
        workers.set(unit.id, unit);
      }
      if ("workers" in unit) {
        processes.set(unit.id, unit);
        for (const worker of unit.workers) {
          units.set(worker.id, worker);
          workers.set(worker.id, worker);
        }
      }
    },
    getUnitById(id) {
      return units.get(id);
    },
    getWorkerById(id) {
      return workers.get(id);
    },
    getProcessById(id) {
      return processes.get(id);
    },
    listUnits() {
      return Array.from(units.values());
    },
    listWorkers() {
      return Array.from(workers.values());
    },
    listProcesses() {
      return Array.from(processes.values());
    },
    updateUnitState(id, updates) {
      const unit = units.get(id);
      if (!unit) return;
      Object.assign(unit, updates);
      if ("run" in unit) workers.set(id, unit);
      if ("workers" in unit) processes.set(id, unit);
    },
    releaseUnit(id) {
      const unit = units.get(id);
      if (!unit) return;
      units.delete(id);
      workers.delete(id);
      processes.delete(id);
      if ("workers" in unit) {
        for (const worker of unit.workers) {
          units.delete(worker.id);
          workers.delete(worker.id);
        }
      }
    },
    getWorkersForProcess(processId) {
      const process = processes.get(processId);
      return process?.workers ?? [];
    },
    getProcessesForWorker(workerId) {
      return Array.from(processes.values()).filter(
        (p) => p.workers.some((w) => w.id === workerId)
      );
    },
    findUnitsByStatus(status) {
      return Array.from(units.values()).filter((u) => u.status === status);
    }
  };
}

// src/core/status-tracker.ts
function createStatusTracker(lifecycle, visualizer) {
  const statusMap = /* @__PURE__ */ new Map();
  return {
    setStatus(unitId, status, options = {}) {
      if (status === void 0) return;
      statusMap.set(unitId, status);
      lifecycle.update(unitId, {
        status,
        lastRun: /* @__PURE__ */ new Date()
      });
      visualizer?.renderUnitStatus(unitId, status);
      if (options.emitMilestone) {
        const milestoneId = `unit:${unitId}:${status}`;
        lifecycle.emitMilestone(milestoneId, options.payload);
      }
    },
    getStatus(unitId) {
      return statusMap.get(unitId);
    }
  };
}

// src/core/workers-manager.ts
var SynchronikWorkerManager = class {
  pendingTasks = [];
  idleWorkers = [];
  activeWorkers = /* @__PURE__ */ new Map();
  arrangementCounter = 1;
  loopInterval = null;
  executor = async () => {
  };
  constructor(poolSize = 2) {
    for (let i = 0; i < poolSize; i++) {
      const workerId = `pool-worker-${i + 1}`;
      const worker = {
        id: workerId,
        name: `Pool Worker ${i + 1}`,
        enabled: true,
        status: "idle",
        run: async () => {
        }
        // Placeholder, will be replaced by task's execute
      };
      this.idleWorkers.push(worker);
      this.activeWorkers.set(workerId, worker);
    }
  }
  /**
   * Injects the execution function from the core manager.
   * @param executor - The function to run a worker by its ID.
   */
  setExecutor(executor) {
    this.executor = executor;
  }
  getPoolWorkers() {
    return Array.from(this.activeWorkers.values());
  }
  /**
   * Adds a new task to the manager, assigning it a unique arrangementId.
   * @param {Omit<Task, "arrangementId">} taskData - The task data without an arrangementId.
   * @returns {Task | null} The full Task object with its new arrangementId, or null if the name is a duplicate.
   */
  addTask(taskData) {
    if (this.pendingTasks.some((t) => t.name === taskData.name)) {
      console.warn(`Task with name "${taskData.name}" already exists.`);
      return null;
    }
    const newTask = {
      ...taskData,
      arrangementId: this.arrangementCounter++,
      status: "idle"
    };
    this.pendingTasks.push(newTask);
    this.pendingTasks.sort((a, b) => a.arrangementId - b.arrangementId);
    return newTask;
  }
  /**
   * Updates an existing task's properties.
   * @param {string} taskName - The name of the task to update.
   * @param {Partial<Omit<Task, "arrangementId" | "name">>} updates - The properties to update.
   */
  updateTask(taskName, updates) {
    const task = this.pendingTasks.find((t) => t.name === taskName);
    if (!task) {
      console.error(`Cannot update: Task "${taskName}" not found.`);
      return;
    }
    Object.assign(task, updates);
  }
  /**
   * Pauses a pending task. All tasks with a higher arrangementId will wait.
   * @param {string} taskName - The name of the task to pause.
   */
  pauseTask(taskName) {
    const task = this.pendingTasks.find((t) => t.name === taskName);
    if (task && task.status === "idle") {
      task.status = "paused";
    } else {
      console.warn(`Cannot pause: Task "${taskName}" is not pending or idle.`);
    }
  }
  /**
   * Resumes a paused task.
   * @param {string} taskName - The name of the task to resume.
   */
  resumeTask(taskName) {
    const task = this.pendingTasks.find((t) => t.name === taskName);
    if (task && task.status === "paused") {
      task.status = "idle";
    } else {
      console.warn(`Cannot resume: Task "${taskName}" is not paused.`);
    }
  }
  /**
   * Cancels and removes a pending task from the queue.
   * @param {string} taskName - The name of the task to cancel.
   */
  cancelTask(taskName) {
    const initialLength = this.pendingTasks.length;
    this.pendingTasks = this.pendingTasks.filter((t) => t.name !== taskName);
    if (this.pendingTasks.length === initialLength) {
      console.warn(
        `Cannot cancel: Task "${taskName}" not found in pending queue.`
      );
    }
  }
  /**
   * Starts the worker manager's loop to assign tasks to idle workers.
   */
  start() {
    if (this.loopInterval) return;
    this.loopInterval = setInterval(() => {
      if (this.pendingTasks.length > 0 && this.idleWorkers.length > 0) {
        if (this.pendingTasks[0] && this.pendingTasks[0].status === "paused") {
          return;
        }
        const task = this.pendingTasks.shift();
        const worker = this.idleWorkers.shift();
        if (task && worker) {
          this.executeTask(worker, task);
        }
      }
    }, 10);
  }
  /**
   * Stops the worker manager's loop.
   */
  stop() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }
  /**
   * Simulates the execution flow of pending tasks.
   * @returns {string} A string describing the ordered sequence of tasks.
   */
  simulateRun() {
    if (this.pendingTasks.length === 0) {
      return "No tasks pending for execution.";
    }
    const sequence = this.pendingTasks.map((task, index) => `${index + 1}. ${task.name}`).join(", ");
    return `Execution sequence: ${sequence}`;
  }
  async executeTask(worker, task) {
    worker.status = "running";
    worker.task = task.name;
    task.status = "running";
    worker.run = task.execute;
    await this.executor(worker.id);
    worker.status = "idle";
    worker.task = void 0;
    this.idleWorkers.push(worker);
  }
  getWorkerStatus(workerId) {
    const worker = this.activeWorkers.get(workerId);
    if (!worker) {
      return void 0;
    }
    return {
      currentTask: worker.task || void 0,
      lastMilestone: void 0,
      // This should be retrieved from the core event system
      isIdle: worker.status === "idle"
    };
  }
  // This method is no longer needed as workers are not generated on the fly.
  generateWorkers() {
    return Array.from(this.activeWorkers.values());
  }
};

// src/utils/core.ts
function mapEventTypeToStatus(type) {
  switch (type) {
    case "start":
      return "running";
    case "complete":
      return "completed";
    case "error":
      return "error";
    default:
      return void 0;
  }
}

// src/core/visualizer.ts
function createSynchronikVisualizer(renderFn) {
  const visualizer = {
    renderUnitStatus(unitId, status, message) {
      const msg = message ?? `[Visualizer] Unit ${unitId} is now ${status}`;
      renderFn?.("status", msg, { unitId, status });
    },
    renderMilestone(milestoneId, payload, message) {
      const msg = message ?? `[Visualizer] Milestone reached: ${milestoneId}`;
      renderFn?.("milestone", msg, { milestoneId, payload });
    },
    attachToEventBus(eventBus) {
      eventBus.subscribeAll((event) => {
        if (event.type === "start" || event.type === "complete" || event.type === "error") {
          const status = mapEventTypeToStatus(event.type);
          if (status && "unitId" in event) {
            visualizer.renderUnitStatus(event.unitId, status);
          }
        }
        if (event.type === "milestone") {
          visualizer.renderMilestone(event.milestoneId, event.payload);
        }
      });
    }
  };
  return visualizer;
}

// src/core/watcher.ts
function createUnitWatcher(registry, lifecycle, options) {
  const idleThreshold = options?.idleThresholdMs ?? 5 * 60 * 1e3;
  return {
    scan() {
      const now = Date.now();
      for (const worker of registry.listWorkers()) {
        const lastRun = worker.lastRun?.getTime() ?? 0;
        const idleTime = now - lastRun;
        if (worker.status === "idle" && idleTime > idleThreshold) {
          lifecycle.release(worker.id);
          lifecycle.emitMilestone(`worker:${worker.id}:released`, { idleTime });
        }
        if (options?.autoUnpause && worker.status === "paused") {
          lifecycle.update(worker.id, { status: "idle" });
          lifecycle.emitMilestone(`worker:${worker.id}:unpaused`);
        }
      }
    }
  };
}

// src/core/manager.ts
function createSynchronikManager() {
  const registry = createSynchronikRegistry();
  const eventBus = new SynchronikEventBus();
  const milestoneEmitter = createMilestoneEmitter(eventBus);
  const lifecycle = createSynchronikLifecycle(
    registry,
    eventBus,
    milestoneEmitter
  );
  const visualizer = createSynchronikVisualizer();
  const tracker = createStatusTracker(lifecycle, visualizer);
  const loop = createSynchronikLoop(registry, tracker);
  const watcher = createUnitWatcher(registry, lifecycle, {
    idleThresholdMs: 10 * 60 * 1e3,
    autoUnpause: true
  });
  visualizer.attachToEventBus(eventBus);
  let loopInterval = null;
  let watcherInterval = null;
  const managerApi = {
    /**
     * Starts the Synchronik engine's background processes.
     * This includes the main execution loop and the unit watcher.
     */
    start() {
      loopInterval = setInterval(() => loop.run(), 60 * 1e3);
      watcherInterval = setInterval(() => watcher.scan(), 60 * 1e3);
    },
    /**
     * Gracefully stops the Synchronik engine.
     * It clears the background intervals and attempts to complete any in-progress work.
     */
    async stop() {
      if (loopInterval) clearInterval(loopInterval);
      if (watcherInterval) clearInterval(watcherInterval);
      const processes = registry.listProcesses();
      for (const process of processes) {
        if (process.status === "paused") continue;
        tracker.setStatus(process.id, "running");
        for (const worker of process.workers) {
          if (worker.status === "paused") continue;
          tracker.setStatus(worker.id, "running");
          try {
            await worker.run();
            tracker.setStatus(worker.id, "completed", { emitMilestone: true });
          } catch (err) {
            tracker.setStatus(worker.id, "error", {
              emitMilestone: true,
              payload: { error: String(err) }
            });
          }
        }
        tracker.setStatus(process.id, "completed", { emitMilestone: true });
      }
    },
    /**
     * Starts all registered units that are currently in a 'paused' state
     * by setting their status to 'idle'.
     */
    startAll() {
      for (const unit of registry.listUnits()) {
        if (unit.status === "paused") {
          lifecycle.update(unit.id, { status: "idle" });
        }
      }
    },
    /**
     * Stops all registered units by setting their status to 'paused'.
     * This prevents them from being executed by the main loop.
     */
    stopAll() {
      for (const unit of registry.listUnits()) {
        lifecycle.update(unit.id, { status: "paused" });
      }
    },
    /**
     * Manually triggers the execution of a single worker by its ID.
     * @param id The ID of the worker to run.
     */
    async runWorkerById(id) {
      const unit = registry.getUnitById(id);
      if (!unit || unit.status === "paused") return;
      if (!("run" in unit) || typeof unit.run !== "function") return;
      tracker.setStatus(id, "running");
      try {
        await unit.run();
        tracker.setStatus(id, "completed", { emitMilestone: true });
      } catch (err) {
        tracker.setStatus(id, "error", {
          emitMilestone: true,
          payload: { error: String(err) }
        });
      }
    },
    /**
     * Manually triggers the execution of a process and all its associated workers.
     * The execution order is determined by the process's `runMode` property,
     * which can be 'sequential', 'parallel', 'isolated', or 'batched'.
     * - sequential: Workers are executed one after another.
     * - parallel: All workers are executed concurrently.
     * - isolated: Workers are executed sequentially with a small delay between each.
     * The execution order is determined by the process's `runMode` property.
     * @param id The ID of the process to run.
     */
    async runProcessById(id) {
      const process = registry.getProcessById(id);
      if (!process || process.status === "paused") return;
      tracker.setStatus(id, "running", {
        emitMilestone: true,
        payload: { runMode: process.runMode ?? "sequential" }
      });
      const workers = process.workers.filter(
        (w) => w.enabled && w.status !== "paused" && w.status !== "completed"
      );
      const runMode = process.runMode ?? "sequential";
      if (runMode === "parallel") {
        await Promise.all(workers.map((w) => this.runWorkerById(w.id)));
      } else if (runMode === "isolated") {
        for (const worker of workers) {
          await this.runWorkerById(worker.id);
          await new Promise((r) => setTimeout(r, 100));
        }
      } else {
        for (const worker of workers) {
          await this.runWorkerById(worker.id);
        }
      }
      tracker.setStatus(id, "completed", {
        emitMilestone: true,
        payload: { runMode }
      });
    },
    /**
     * Retrieves the current status of a specific unit.
     * @param id The ID of the unit.
     * @returns The unit's status, or undefined if not found.
     */
    getUnitStatus(id) {
      const unit = registry.getUnitById(id);
      return unit?.status;
    },
    /**
     * Lists all currently registered units.
     * @returns An array of all Synchronik units.
     */
    listUnits() {
      return registry.listUnits();
    },
    /**
     * Emits a custom milestone event.
     * @param id A unique identifier for the milestone.
     * @param payload Optional data to include with the milestone.
     */
    emitMilestone(id, payload) {
      milestoneEmitter.emit(id, payload);
    },
    /**
     * Subscribes to all events emitted by the Synchronik engine.
     * @param listener A callback function to handle incoming events.
     * @returns An unsubscribe function.
     */
    subscribeToEvents(listener) {
      return eventBus.subscribeAll(listener);
    },
    // --- Direct Lifecycle, Registry, and Tracker Access ---
    registerUnit: lifecycle.register,
    releaseUnit: lifecycle.release,
    updateStatus: tracker.setStatus,
    /**
     * Retrieves a snapshot of all units currently in the registry.
     * @returns An array of all Synchronik units.
     */
    getRegistrySnapshot() {
      return registry.listUnits();
    },
    /**
     * Subscribes specifically to 'milestone' events.
     * @param handler A callback function to handle milestone events.
     * @returns An unsubscribe function.
     */
    onMilestone(handler) {
      return eventBus.subscribe("milestone", (event) => {
        handler(event.milestoneId, event.payload);
      });
    },
    /**
     * Creates and integrates a worker pool manager.
     * @param {number} [poolSize=5] - The number of concurrent workers in the pool.
     * @returns {WorkerManager} An API to manage the worker pool.
     */
    useWorkerPool(poolSize = 5) {
      const workerManager = new SynchronikWorkerManager(poolSize);
      workerManager.setExecutor(this.runWorkerById);
      const poolWorkers = workerManager.getPoolWorkers();
      poolWorkers.forEach((worker) => this.registerUnit(worker));
      const originalStart = this.start;
      this.start = () => {
        originalStart();
        workerManager.start();
      };
      return workerManager;
    }
  };
  return managerApi;
}

// src/core/dashboard.ts
function createSynchronikDashboard() {
  let manager = null;
  function renderUnit(unit) {
    console.log(`[${unit.status}] ${unit.id}`);
  }
  function renderMilestone(milestoneId, payload) {
    console.log(`\u{1F3AF} Milestone: ${milestoneId}`, payload);
  }
  return {
    /**
     * Attaches the dashboard to a Synchronik manager instance to receive events.
     * @param mgr The manager instance.
     */
    attachToManager(mgr) {
      manager = mgr;
      mgr.onMilestone(renderMilestone);
    },
    /**
     * Renders a snapshot of the current state of all registered units.
     * Clears the console before rendering.
     */
    render() {
      if (!manager) return;
      const units = manager.getRegistrySnapshot();
      console.clear();
      console.log("\u{1F504} Synchronik Dashboard");
      units.forEach(renderUnit);
    },
    /**
     * Displays the current status of a specific unit.
     * @param unitId The ID of the unit to inspect.
     */
    showUnitStatus(unitId) {
      if (!manager) return;
      const status = manager.getUnitStatus(unitId);
      console.log(`\u{1F4E6} Unit ${unitId} status: ${status}`);
    },
    /**
     * Placeholder function to visualize a milestone arc for a unit.
     * @param unitId The ID of the unit.
     */
    showMilestoneArc(unitId) {
      console.log(`\u{1F300} Milestone arc for ${unitId}...`);
    },
    /**
     * Placeholder function to trigger a visual effect, like a glowing badge.
     * @param unitId The ID of the unit.
     * @param badge The badge to trigger.
     */
    triggerBadgeGlow(unitId, badge) {
      console.log(`\u2728 Badge '${badge}' triggered for ${unitId}`);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createSynchronikDashboard,
  createSynchronikManager
});
