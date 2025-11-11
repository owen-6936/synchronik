import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSynchronikManager } from "../../core/manager.js";
import type { WorkerManager } from "../../types/synchronik.js";
import { SynchronikWorkerManager } from "../../core/workers-manager.js"; // Import the concrete class

describe("SynchronikWorkerManager", () => {
    let manager: ReturnType<typeof createSynchronikManager>;
    let workerManager: WorkerManager;

    beforeEach(() => {
        // Create the core manager first
        manager = createSynchronikManager();
        // Then, create the worker pool manager from it
        workerManager = manager.useWorkerPool(2);
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    it("should add a new task and assign an arrangementId", () => {
        const task = workerManager.addTask({
            name: "First Task",
            execute: async () => {},
        });
        expect(task).toEqual({
            name: "First Task",
            execute: expect.any(Function),
            arrangementId: 1,
            status: "idle",
        });
    });

    it("should increment arrangementId for subsequent tasks", () => {
        workerManager.addTask({ name: "Task 1", execute: async () => {} });
        const task2 = workerManager.addTask({
            name: "Task 2",
            execute: async () => {},
        });
        expect(task2?.arrangementId).toBe(2);
    });

    it("should not allow tasks with duplicate names", () => {
        workerManager.addTask({
            name: "Duplicate Task",
            execute: async () => {},
        });
        const result = workerManager.addTask({
            name: "Duplicate Task",
            execute: async () => {},
        });
        expect(result).toBeNull();
        expect(console.warn).toHaveBeenCalledWith(
            'Task with name "Duplicate Task" already exists.'
        );
    });

    describe("Task Lifecycle: Pause, Resume, Cancel", () => {
        it("should pause a pending task", () => {
            const task = workerManager.addTask({
                name: "Task 1",
                execute: async () => {},
            });
            workerManager.pauseTask("Task 1");
            expect(task?.status).toBe("paused");
        });

        it("should resume a paused task", () => {
            const task = workerManager.addTask({
                name: "Task 1",
                execute: async () => {},
            });
            workerManager.pauseTask("Task 1");
            expect(task?.status).toBe("paused");
            workerManager.resumeTask("Task 1");
            expect(task?.status).toBe("idle");
        });

        it("should cancel and remove a pending task", () => {
            workerManager.addTask({ name: "Task 1", execute: async () => {} });
            workerManager.addTask({ name: "Task 2", execute: async () => {} });
            workerManager.cancelTask("Task 1");
            expect(workerManager.simulateRun()).toBe(
                "Execution sequence: 1. Task 2"
            );
        });

        it("should enforce cascading pause", async () => {
            const results: string[] = [];
            workerManager.addTask({
                name: "Task 1",
                execute: async () => results.push("Task 1 done"),
            });
            workerManager.addTask({
                name: "Task 2",
                execute: async () => results.push("Task 2 done"),
            });

            // Pause the first task, which should block the second
            workerManager.pauseTask("Task 1");
            workerManager.start();

            // Wait a moment to ensure Task 2 doesn't run
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(results).toEqual([]);

            // Resume the first task, allowing the queue to proceed
            workerManager.resumeTask("Task 1");

            // Wait for all tasks to complete
            await new Promise<void>((resolve) => {
                const interval = setInterval(() => {
                    if (results.length === 2) {
                        clearInterval(interval);
                        workerManager.stop();
                        resolve();
                    }
                }, 50);
            });

            expect(results).toEqual(["Task 1 done", "Task 2 done"]);
        });
    });

    describe("resize", () => {
        it("should scale up the number of workers in the pool", () => {
            // Initial pool size is 2 from beforeEach
            expect(workerManager.getPoolWorkers()).toHaveLength(2);
            // The main manager should also see these 2 workers
            expect(
                manager
                    .listUnits()
                    .filter((u) => u.id.startsWith("pool-worker-"))
            ).toHaveLength(2);

            // Scale up to 5
            workerManager.resize(5);

            // Verify new size in both the worker pool and the main registry
            expect(workerManager.getPoolWorkers()).toHaveLength(5);
            const allUnits = manager.listUnits();
            const poolWorkers = allUnits.filter((u) =>
                u.id.startsWith("pool-worker-")
            );
            expect(poolWorkers).toHaveLength(5);
            expect(poolWorkers.map((w) => w.id)).toEqual(
                expect.arrayContaining([
                    "pool-worker-1",
                    "pool-worker-2",
                    "pool-worker-3",
                    "pool-worker-4",
                    "pool-worker-5",
                ])
            );
        });

        it("should scale down the number of idle workers in the pool", () => {
            // For this test, start with a larger pool
            workerManager = manager.useWorkerPool(5);
            expect(workerManager.getPoolWorkers()).toHaveLength(5);

            // Scale down to 2
            workerManager.resize(2);

            // Verify new size
            expect(workerManager.getPoolWorkers()).toHaveLength(2);
            const poolWorkers = manager
                .listUnits()
                .filter((u) => u.id.startsWith("pool-worker-"));
            expect(poolWorkers).toHaveLength(2);
        });

        it("should not scale down if no idle workers are available", async () => {
            workerManager = manager.useWorkerPool(2);
            // Add long-running tasks to occupy all workers
            const longTask = () => new Promise((r) => setTimeout(r, 200));
            workerManager.addTask({ name: "task1", execute: longTask });
            workerManager.addTask({ name: "task2", execute: longTask });
            manager.start();

            // Wait a moment for workers to become active
            // This wait needs to be short enough that the tasks are still running.
            await new Promise((r) => setTimeout(r, 50));

            // Attempt to scale down while workers are busy
            workerManager.resize(1);

            // Verify that the pool size has not changed because no workers were idle
            expect(workerManager.getPoolWorkers()).toHaveLength(2);
            expect(console.warn).toHaveBeenCalledWith(
                "[Worker Pool] Scale-down requested, but no idle workers are available to remove."
            );
        });
    });

    describe("simulateRun", () => {
        it("should return a message when no tasks are pending", () => {
            expect(workerManager.simulateRun()).toBe(
                "No tasks pending for execution."
            );
        });

        it("should return the correct execution sequence string", () => {
            workerManager.addTask({
                name: "Fetch from API",
                execute: async () => {},
            });
            workerManager.addTask({
                name: "Update local file",
                execute: async () => {},
            });
            expect(workerManager.simulateRun()).toBe(
                "Execution sequence: 1. Fetch from API, 2. Update local file"
            );
        });

        it("should respect task order when tasks are added dynamically", () => {
            workerManager.addTask({ name: "Step 1", execute: async () => {} }); // arrangementId: 1
            workerManager.addTask({ name: "Step 3", execute: async () => {} }); // arrangementId: 2

            // Manually add a task and re-sort to simulate an update
            const step2 = {
                // This task will get arrangementId 3 if added normally
                name: "Step 2 (Inserted)",
                execute: async () => {},
                arrangementId: 1.5,
                status: "idle" as const,
            };
            // Cast workerManager to its concrete type to access private members for testing
            (workerManager as SynchronikWorkerManager)["pendingTasks"].push(
                step2
            );
            (workerManager as SynchronikWorkerManager)["pendingTasks"].sort(
                (a, b) => a.arrangementId - b.arrangementId
            );

            // The expected output needs to reflect the inserted task's name
            expect(workerManager.simulateRun()).toBe(
                "Execution sequence: 1. Step 1, 2. Step 2 (Inserted), 3. Step 3"
            );
        });
    });

    it("should process tasks from the queue with idle workers", async () => {
        const results: number[] = [];
        const taskCount = 5;
        // Re-initialize for this specific test's pool size
        workerManager = manager.useWorkerPool(2);

        // Add 5 tasks
        for (let i = 1; i <= taskCount; i++) {
            workerManager.addTask({
                name: `Task ${i}`,
                execute: async () => {
                    // Simulate async work
                    await new Promise((resolve) =>
                        setTimeout(resolve, 20 + Math.random() * 10)
                    );
                    results.push(i);
                },
            });
        }

        // Start the main manager, which now also starts the worker manager's loop
        manager.start();

        // Wait for all tasks to be completed
        await new Promise<void>((resolve) => {
            const interval = setInterval(() => {
                if (results.length === taskCount) {
                    clearInterval(interval);
                    manager.stop();
                    resolve();
                }
            }, 50);
        });

        // All tasks should have been completed
        expect(results.length).toBe(taskCount);
        // The results should be in order due to the arrangementId sorting
        expect(results).toEqual([1, 2, 3, 4, 5]);
    });
});
