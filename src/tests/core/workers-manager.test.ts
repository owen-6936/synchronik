import { describe, it, expect, vi, beforeEach } from "vitest";
import { SynchronikWorkerManager } from "../../core/workers-manager.js";

describe("SynchronikWorkerManager", () => {
  let workerManager: SynchronikWorkerManager;

  beforeEach(() => {
    // Use a pool of 2 workers for most tests
    workerManager = new SynchronikWorkerManager(2);
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
        name: "Step 2",
        execute: async () => {},
        arrangementId: 1.5,
        status: "idle" as const,
      };
      workerManager["pendingTasks"].push(step2);
      workerManager["pendingTasks"].sort(
        (a, b) => a.arrangementId - b.arrangementId
      );

      expect(workerManager.simulateRun()).toBe(
        "Execution sequence: 1. Step 1, 2. Step 2, 3. Step 3"
      );
    });
  });

  it("should process tasks from the queue with idle workers", async () => {
    const results: number[] = [];
    const taskCount = 5;
    const poolSize = 2;
    workerManager = new SynchronikWorkerManager(poolSize);

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

    // Start the manager's loop
    workerManager.start();

    // Wait for all tasks to be completed
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (results.length === taskCount) {
          clearInterval(interval);
          workerManager.stop();
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
