import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSynchronikManager } from "../core/manager";
import {
    RunMode,
    SynchronikProcess,
    SynchronikWorker,
} from "../types/synchronik";

describe("RunMode execution benchmarks", () => {
    let manager: ReturnType<typeof createSynchronikManager>;
    let events: any[];

    // Helper to create a mock worker that simulates work with a delay
    const createMockWorker = (
        id: string,
        delayMs: number = 0
    ): SynchronikWorker => ({
        id,
        status: "idle",
        run: vi.fn(
            () => new Promise((resolve) => setTimeout(resolve, delayMs)) as any
        ),
        name: `Mock Worker ${id}`,
        enabled: true,
    });

    // Helper to create a mock process with configurable run mode and worker delays
    const mockProcess = (
        id: string,
        workerIds: string[],
        runMode: RunMode, // Use the RunMode type
        options?: {
            workerDelayMs?: number;
            isolationDelayMs?: number;
            batchSize?: number;
        }
    ): SynchronikProcess => ({
        id,
        status: "idle",
        workers: workerIds.map((wId) =>
            createMockWorker(wId, options?.workerDelayMs)
        ),
        name: `Mock Process ${id}`, // Give a unique name for clarity
        enabled: true,
        runMode,
        isolationDelayMs: options?.isolationDelayMs,
        batchSize: options?.batchSize,
    });

    // Define a common worker delay for non-isolated tests to make timing assertions meaningful
    const defaultWorkerDelay = 50; // ms

    beforeEach(() => {
        manager = createSynchronikManager();
        events = [];
        manager.onMilestone((id, payload) => events.push({ id, payload }));
        // Add a dummy error listener to prevent unhandled promise rejections
        // from crashing the test when a worker is expected to fail.
        manager.subscribeToEvents((event) => {
            if (event.type === "error") {
                /* absorb */
            }
        });
    });

    it("runs process in parallel mode with correct timing", async () => {
        const workerCount = 3;
        // In parallel, total time should be roughly the duration of the longest worker
        const p = mockProcess("p-parallel", ["w1", "w2", "w3"], "parallel", {
            workerDelayMs: defaultWorkerDelay,
        });
        manager.registerUnit(p);
        p.workers.forEach((w) => manager.registerUnit(w));

        const start = Date.now();
        await manager.runProcessById("p-parallel");
        const duration = Date.now() - start;

        // Expected duration: defaultWorkerDelay + some overhead
        expect(duration).toBeGreaterThanOrEqual(defaultWorkerDelay);
        expect(duration).toBeLessThan(defaultWorkerDelay + 50);

        // All workers should have been called
        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalledTimes(1);
        }
        expect(events.some((e) => e.payload?.runMode === "parallel")).toBe(
            true
        );
    });

    it("runs process in sequential mode with correct timing", async () => {
        const workerCount = 3;
        const p = mockProcess(
            "p-sequential",
            ["w4", "w5", "w6"],
            "sequential",
            { workerDelayMs: defaultWorkerDelay }
        );
        manager.registerUnit(p);
        p.workers.forEach((w) => manager.registerUnit(w));

        const start = Date.now();
        await manager.runProcessById("p-sequential");
        const duration = Date.now() - start;

        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalled();
            expect(manager.getUnitStatus(w.id)).toBe("completed"); // Ensure status is updated
        }

        // In sequential mode, total duration should be sum of all worker delays
        const expectedMinDuration = workerCount * defaultWorkerDelay;
        expect(duration).toBeGreaterThanOrEqual(expectedMinDuration);
        expect(duration).toBeLessThan(expectedMinDuration + 50); // Allow for some overhead
        expect(events.some((e) => e.payload?.runMode === "sequential")).toBe(
            true
        );
    });

    it("runs process in isolated mode with correct timing", async () => {
        const workerCount = 3;
        const isolationDelay = 75; // ms
        // Workers themselves have 0 delay, the delay comes from isolationDelayMs between workers
        const p = mockProcess("p-isolated", ["w7", "w8", "w9"], "isolated", {
            workerDelayMs: 0,
            isolationDelayMs: isolationDelay,
        });
        manager.registerUnit(p);
        p.workers.forEach((w) => manager.registerUnit(w));

        const start = Date.now();
        await manager.runProcessById("p-isolated");
        const duration = Date.now() - start;

        // In isolated mode, total duration is (workerCount - 1) * isolationDelayMs + sum(workerDelayMs)
        // With workerDelayMs = 0, it's (3 - 1) * 100ms = 200ms
        const expectedMinDuration = (workerCount - 1) * isolationDelay;
        expect(duration).toBeGreaterThanOrEqual(expectedMinDuration);
        expect(duration).toBeLessThan(expectedMinDuration + 100);

        // All workers should have been called
        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalledTimes(1);
        }
        expect(events.some((e) => e.payload?.runMode === "isolated")).toBe(
            true
        );
    });

    it("runs process in batched mode", async () => {
        const p = mockProcess("p-batched", ["w10", "w11", "w12"], "batched");
        // @ts-ignore
        p.batchSize = 2;
        manager.registerUnit(p);
        p.workers.forEach((w) => manager.registerUnit(w));

        await manager.runProcessById("p-batched");

        // All workers should have been called
        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalled();
        }

        expect(events.some((e) => e.payload?.runMode === "batched")).toBe(true);
    });

    it("completes a batch even if one worker fails (fault tolerance)", async () => {
        // 1. Setup a batch with one failing worker and two successful ones.
        const failingWorker: SynchronikWorker = {
            id: "w-fail",
            name: "Failing Worker",
            enabled: true,
            status: "idle",
            maxRetries: 0, // Fail immediately for this test
            run: vi.fn().mockRejectedValue(new Error("I always fail")),
        };

        const successfulWorker1 = createMockWorker("w-ok-1", 50);
        const successfulWorker2 = createMockWorker("w-ok-2", 50);

        const p: SynchronikProcess = {
            id: "p-fault-tolerant",
            name: "Fault Tolerant Process",
            enabled: true,
            runMode: "batched",
            batchSize: 3,
            workers: [successfulWorker1, failingWorker, successfulWorker2],
        };

        manager.registerUnit(p);

        // 2. Run the process
        await manager.runProcessById("p-fault-tolerant");

        // 3. Assert that the successful workers completed and the failing one is in an error state.
        expect(manager.getUnitStatus("w-ok-1")).toBe("completed");
        expect(manager.getUnitStatus("w-fail")).toBe("error");
        expect(manager.getUnitStatus("w-ok-2")).toBe("completed");
        expect(manager.getUnitStatus("p-fault-tolerant")).toBe("completed");
    });
});
