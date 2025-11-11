# API Reference: `SynchronikManager`

The `SynchronikManager` is your main entry point for interacting with the engine. It exposes a clean and powerful API for orchestrating complex workflows.

## Creating a Manager

You can create a manager instance using the `createSynchronikManager` factory function.

```typescript
import { createSynchronikManager } from 'synchronik';

const manager = createSynchronikManager();
```

## Core Lifecycle Methods

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
    These methods provide bulk control over all registered units, setting their `enabled` flag to `true` or `false` respectively.

    ```typescript
    // Disable all operations
    manager.stopAll();

    // Re-enable all operations
    manager.startAll();
    ```

## Unit Registration and Management

These methods allow you to add, remove, and inspect units in the engine.

* **`manager.registerUnit(unit)`**
    Adds a new worker or process to the engine's registry.

    ```typescript
    const myWorker = {
      id: 'my-first-worker',
      enabled: true,
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

* **`manager.getUnitStatus(unitId)`**
    Retrieves the current status of a unit (e.g., 'idle', 'running').

    ```typescript
    const status = manager.getUnitStatus('failing-worker');
    ```

* **`manager.listUnits()`**
    Returns an array of all currently registered units.

    ```typescript
    const allUnits = manager.listUnits();
    console.log(`There are ${allUnits.length} units registered.`);
    ```

## Manual Execution

While the engine can run units automatically via its loop, you can also trigger them manually.

* **`manager.runWorkerById(id)`**
    Immediately executes a single worker by its ID.

    ```typescript
    await manager.runWorkerById('my-first-worker');
    ```

* **`manager.runProcessById(id)`**
    Executes a process and all of its associated workers according to its `runMode`.

    ```typescript
    // Assuming 'my-process' is a registered process with workers
    await manager.runProcessById('my-process');
    ```

## Event Subscription and Milestones

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

* **`manager.emitMilestone(id, payload)`**
    Allows you to emit your own custom milestones from anywhere in your application.

    ```typescript
    manager.emitMilestone('user-logged-in', { userId: 123 });
    ```
