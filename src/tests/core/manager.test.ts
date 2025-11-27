import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSynchronikManager } from "../../core/manager";
import type {
    RunMode,
    SynchronikWorker,
    SynchronikProcess,
} from "../../types/synchronik";

describe("SynchronikManager", () => {
    let manager: ReturnType<typeof createSynchronikManager>;
    let events: any[];

    const mockWorker = (id: string): SynchronikWorker => ({
        id,
        status: "idle",
        run: vi.fn().mockResolvedValue(undefined),
        name: "Mock Worker",
        enabled: true,
    });

    const mockProcess = (
        id: string,
        workerIds: string[]
    ): SynchronikProcess => ({
        id,
        status: "idle",
        workers: workerIds.map(mockWorker),
        name: "Mock Process",
        enabled: true,
    });

    beforeEach(() => {
        manager = createSynchronikManager();
        events = [];
        manager.onMilestone((id, payload) => events.push({ id, payload }));
        manager.subscribeToEvents((event) => {
            // Standardize the event shape to always have an `id` property.
            if (event.type === "error") {
                events.push({ id: event.unitId, payload: event });
            }
        });
    });

    it("registers and snapshots units", () => {
        // structuredClone cannot clone functions, so for this specific test,
        // we use a plain object without a mock function.
        const cloneableWorker: SynchronikWorker = {
            id: "w1",
            status: "idle",
            run: async () => {}, // Use a real (but empty) function
            name: "Cloneable Worker",
            enabled: true,
        };

        manager.registerUnit(cloneableWorker);

        const snapshot = manager.getRegistrySnapshot();
        expect(snapshot.map((u) => u.id)).toContain("w1");
        expect(snapshot[0]).not.toBe(cloneableWorker); // Verify it's a clone, not the same object reference
    });

    it("runs a unit and emits milestone", async () => {
        const w = mockWorker("w2");
        manager.registerUnit(w);

        await manager.runWorkerById("w2");
        expect(w.run).toHaveBeenCalled();
        expect(events.some((e) => e.id.includes("w2"))).toBe(true);
    });

    it("runs a process and all its workers", async () => {
        const p = mockProcess("p1", ["w3", "w4"]);
        manager.registerUnit(p);

        await manager.runProcessById("p1");

        for (const worker of p.workers) {
            expect(worker.run).toHaveBeenCalled();
        }

        expect(events.some((e) => e.id.includes("w3"))).toBe(true);
        expect(events.some((e) => e.id.includes("w4"))).toBe(true);
    });

    it("gracefully stops all units", async () => {
        const w1 = mockWorker("w5");
        const w2 = mockWorker("w6");
        manager.registerUnit(w1);
        manager.registerUnit(w2);

        manager.start();
        const p = {
            id: "p-stop",
            status: "idle" as const,
            workers: [w1, w2],
            name: "Mock Process",
            enabled: true,
        };
        manager.registerUnit(p);
        await manager.runProcessById("p-stop");

        await manager.stop();

        expect(w1.run).toHaveBeenCalled();
        expect(w2.run).toHaveBeenCalled();
        expect(events.some((e) => e.id.includes("w5"))).toBe(true);
        expect(events.some((e) => e.id.includes("w6"))).toBe(true);
        expect(manager.getUnitStatus("w5")).toBe("completed");
        expect(manager.getUnitStatus("w6")).toBe("completed");
    });

    it("handles paused units during stop", async () => {
        const w = mockWorker("w7");
        w.status = "paused";
        manager.registerUnit(w);

        await manager.stop();
        expect(w.run).not.toHaveBeenCalled();
    });

    it("updates status and triggers milestone", () => {
        const w = mockWorker("w8");
        manager.registerUnit(w);

        manager.updateStatus("w8", "error", { payload: { reason: "fail" } });

        expect(events.some((e) => e.id?.includes("w8"))).toBe(true);
    });

    it("startAll and stopAll update unit states", () => {
        const w1 = mockWorker("w9");
        const w2 = mockWorker("w10");
        manager.registerUnit(w1);
        manager.registerUnit(w2);

        manager.stopAll();
        expect(manager.getUnitStatus("w9")).toBe("paused");
        expect(manager.getUnitStatus("w10")).toBe("paused");

        manager.startAll();
        expect(manager.getUnitStatus("w9")).toBe("idle");
        expect(manager.getUnitStatus("w10")).toBe("idle");
    });
    it("runs process in parallel mode", async () => {
        const p = mockProcess("p-parallel", ["w11", "w12"]);
        p.runMode = "parallel";
        manager.registerUnit(p);
        p.workers.forEach((w) => manager.registerUnit(w));

        const start = Date.now();
        await manager.runProcessById("p-parallel");
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(50); // fast execution
        expect(events.some((e) => e.payload?.runMode === "parallel")).toBe(
            true
        );

        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalled();
            expect(manager.getUnitStatus(w.id)).toBe("completed");
        }
    });

    it("runs process in isolated mode with delay", async () => {
        const p = mockProcess("p-isolated", ["w13", "w14"]);
        p.runMode = "isolated";
        manager.registerUnit(p);
        p.workers.forEach((w) => manager.registerUnit(w));

        const start = Date.now();
        await manager.runProcessById("p-isolated");
        const duration = Date.now() - start;

        expect(duration).toBeGreaterThanOrEqual(100); // delay expected
        expect(events.some((e) => e.payload?.runMode === "isolated")).toBe(
            true
        );

        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalled();
            expect(manager.getUnitStatus(w.id)).toBe("completed");
        }
    });
    it("emits milestone with runMode in payload", async () => {
        const p = mockProcess("p-mode", ["w15"]);
        p.runMode = "sequential";
        manager.registerUnit(p);
        p.workers.forEach((w) => manager.registerUnit(w));

        await manager.runProcessById("p-mode");

        const hasRunMode = events.some(
            (e) => e.payload?.runMode === "sequential"
        );
        expect(hasRunMode).toBe(true);
    });

    it("retries a failing worker with exponential backoff", async () => {
        const retryableWorker: SynchronikWorker = {
            id: "retry-worker",
            name: "Retryable Worker",
            enabled: true,
            status: "idle",
            maxRetries: 2, // Will attempt a total of 3 times
            retryDelayMs: (attempt) => Math.pow(2, attempt - 1) * 50, // 50ms, 100ms
            run: vi
                .fn()
                .mockRejectedValueOnce(new Error("First failure"))
                .mockRejectedValueOnce(new Error("Second failure"))
                .mockResolvedValueOnce(undefined),
        };

        manager.registerUnit(retryableWorker);

        const start = Date.now();
        await manager.runWorkerById("retry-worker");
        const duration = Date.now() - start;

        // --- Assertions ---

        // 1. Verify the number of attempts
        expect(retryableWorker.run).toHaveBeenCalledTimes(3);

        // 2. Verify the timing
        // Expected delay = (50 * 2^0) + (50 * 2^1) = 50 + 100 = 150ms
        const expectedMinDuration = 50 + 100;
        expect(duration).toBeGreaterThanOrEqual(expectedMinDuration);
        expect(duration).toBeLessThan(expectedMinDuration + 50); // Allow for test runner overhead

        // 3. Verify the final status
        expect(manager.getUnitStatus("retry-worker")).toBe("completed");
        // 4. Verify error was not emitted for successful retry
        expect(events.some((e) => e.type === "error")).toBe(false);
    });

    it("runs a process with mixed workers, including one using the task containerizer", async () => {
        // 1. Define a simple worker that just succeeds
        const simpleWorker: SynchronikWorker = {
            id: "simple-worker",
            name: "Simple Worker",
            enabled: true,
            status: "idle",
            run: vi.fn(() => new Promise((r) => setTimeout(r, 100))) as any,
        };

        // 2. Define a worker that uses the task containerizer for its internal logic
        const containerizerWorker: SynchronikWorker = {
            id: "containerizer-worker",
            name: "Containerizer Worker",
            enabled: true,
            status: "idle",
            run: async () => {
                const { runWorkerTasks } = await import(
                    "../../utils/task-runner"
                );
                const results = await runWorkerTasks({
                    items: ["task-ok-1", "task-fail", "task-ok-2"],
                    execute: async (item) => {
                        if (item === "task-fail")
                            throw new Error("Sub-task failed");
                        return { item, status: "done" };
                    },
                    maxRetries: 1,
                });
                manager.emitMilestone(
                    "containerizer-finished",
                    results as Record<string, any>
                );
            },
        };

        // 3. Define the process to run them in parallel
        const mixedProcess: SynchronikProcess = {
            id: "mixed-process",
            name: "Mixed Process",
            enabled: true,
            runMode: "parallel", // Test workers running concurrently
            workers: [simpleWorker, containerizerWorker],
        };

        manager.registerUnit(mixedProcess);
        await manager.runProcessById("mixed-process");

        // Assertions
        expect(manager.getUnitStatus("simple-worker")).toBe("completed");
        expect(manager.getUnitStatus("containerizer-worker")).toBe("completed");
        expect(manager.getUnitStatus("mixed-process")).toBe("completed");

        const milestone = events.find((e) => e.id === "containerizer-finished");
        expect(milestone).toBeDefined();
        expect(milestone.payload.successPercentage).toBeCloseTo(66.67);
        expect(milestone.payload.failed).toHaveLength(1);
        expect(milestone.payload.failed[0].id).toBe("task-fail");
    });

    it("sets worker status to 'error' after all retries fail", async () => {
        const failingWorker: SynchronikWorker = {
            id: "failing-worker",
            name: "Permanently Failing Worker",
            enabled: true,
            status: "idle",
            maxRetries: 2, // Will attempt a total of 3 times
            run: vi.fn().mockRejectedValue(new Error("Permanent failure")),
        };

        manager.registerUnit(failingWorker);

        await manager.runWorkerById("failing-worker");

        // --- Assertions ---

        // 1. Verify it was attempted the correct number of times
        expect(failingWorker.run).toHaveBeenCalledTimes(3);

        // 2. Verify the final status is 'error'
        expect(manager.getUnitStatus("failing-worker")).toBe("error");

        // 3. Verify that an 'error' event was emitted for the unit
        expect(
            events.some(
                (e) => e.payload?.type === "error" && e.id === "failing-worker"
            )
        ).toBe(true);
    });

    it("calls the onError hook when a worker fails permanently", async () => {
        const errorMessage = "Simulated worker failure";
        const onErrorMock = vi.fn();

        const failingWorker: SynchronikWorker = {
            id: "error-hook-worker",
            name: "Worker with onError Hook",
            enabled: true,
            status: "idle",
            maxRetries: 1, // Will attempt twice
            run: vi.fn().mockRejectedValue(new Error(errorMessage)),
            onError: onErrorMock, // Attach the mock hook
        };

        manager.registerUnit(failingWorker);
        await manager.runWorkerById("error-hook-worker");

        // Assert that the onError hook was called once with the correct error
        expect(onErrorMock).toHaveBeenCalledTimes(1);
        expect(onErrorMock).toHaveBeenCalledWith(new Error(errorMessage));
        expect(manager.getUnitStatus("error-hook-worker")).toBe("error");
    });

    it("dynamically updates worker configuration and retries accordingly", async () => {
        const retryableWorker: SynchronikWorker = {
            id: "dynamic-retry-worker",
            name: "Dynamically Configured Worker",
            enabled: true,
            status: "idle",
            maxRetries: 0, // Start with no retries
            run: vi
                .fn()
                .mockRejectedValueOnce(new Error("Initial failure"))
                .mockResolvedValueOnce(undefined), // Succeed on the second attempt
        };

        manager.registerUnit(retryableWorker);

        // 1. Run the worker initially. It has 0 retries, so it should fail immediately.
        await manager.runWorkerById("dynamic-retry-worker");
        expect(retryableWorker.run).toHaveBeenCalledTimes(1);
        expect(manager.getUnitStatus("dynamic-retry-worker")).toBe("error");

        // 2. Dynamically update the worker's configuration to allow retries.
        manager.updateWorkerConfig("dynamic-retry-worker", { maxRetries: 1 });

        // 3. Reset the worker's status to 'idle' so it can be run again.
        manager.updateStatus("dynamic-retry-worker", "idle");

        // 4. Run the worker again. It should now use the new config, retry once, and succeed.
        await manager.runWorkerById("dynamic-retry-worker");

        // 5. Assert that it was attempted twice (initial + 1 retry) and eventually completed.
        expect(retryableWorker.run).toHaveBeenCalledTimes(2);
        expect(manager.getUnitStatus("dynamic-retry-worker")).toBe("completed");
    });
});

describe("SynchronikManager - Engine Stats", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("should return engine stats and calculate CPU percentage over time", () => {
        const manager = createSynchronikManager();

        // Mock process.cpuUsage to control the values for the test
        const initialCpuUsage = { user: 100000, system: 50000 };
        const laterCpuUsage = { user: 200000, system: 75000 };

        const cpuUsageMock = vi
            .spyOn(process, "cpuUsage")
            .mockReturnValueOnce(initialCpuUsage) // First call
            .mockReturnValue(laterCpuUsage); // Subsequent calls

        // --- First call ---
        // This will set the baseline and should return 0% CPU
        const firstStats = manager.getEngineStats();
        console.log("Initial Stats:", firstStats);

        // Assertions for the first call
        expect(firstStats.cpu).toBe("0.00%");
        expect(firstStats.memory.rss).toMatch(/\d+\.\d{2} MB/);

        // --- Second call after some time ---
        // Simulate 1 second (1000ms) passing
        vi.advanceTimersByTime(1000);

        const secondStats = manager.getEngineStats();
        console.log("Stats after 1 second:", secondStats);

        // Assertions for the second call
        // elapsed time = 1000ms = 1,000,000 microseconds
        // total elapsed CPU = (200000 - 100000) + (75000 - 50000) = 125000
        // percentage = (125000 / 1000000) * 100 = 12.5%
        expect(secondStats.cpu).toBe("12.50%");
    });
});
