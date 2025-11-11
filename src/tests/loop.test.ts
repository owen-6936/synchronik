import { describe, it, expect, vi, afterEach } from "vitest";
import { createSynchronikManager } from "../../src/core/manager.js";
import type {
    SynchronikProcess,
    SynchronikWorker,
} from "../../src/types/synchronik.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Core Loop with runOnInterval", () => {
    let manager: ReturnType<typeof createSynchronikManager>;

    afterEach(async () => {
        if (manager) {
            await manager.stop();
        }
    });

    it("should run a worker on an interval if `runOnInterval` is true", async () => {
        manager = createSynchronikManager({ loopInterval: 20 }); // Run loop frequently for test

        const runFn = vi.fn();
        const worker: SynchronikWorker = {
            id: "interval-worker",
            name: "Interval Worker",
            enabled: true,
            intervalMs: 50, // Run every 50ms
            runOnInterval: true, // Explicitly enable interval runs
            maxRuns: 3, // specify how many times to run
            run: runFn,
        };

        const process: SynchronikProcess = {
            id: "interval-process",
            name: "Interval Process",
            enabled: true,
            workers: [worker],
        };

        manager.registerUnit(process);
        manager.start();

        // Manually trigger the first run
        await manager.runProcessById("interval-process");

        // It should run once immediately
        expect(runFn).toHaveBeenCalledTimes(1);

        // Wait long enough for a few interval runs to occur
        await wait(120);

        // It should have run the initial time, plus at least two more times on its interval.
        expect(runFn.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("should stop running a worker after `maxRuns` is reached", async () => {
        manager = createSynchronikManager({ loopInterval: 10 });

        const runFn = vi.fn();
        const worker: SynchronikWorker = {
            id: "limited-run-worker",
            name: "Limited Run Worker",
            enabled: true,
            intervalMs: 20,
            runOnInterval: true,
            maxRuns: 2, // Should run once manually, then once more on interval, then stop.
            run: runFn,
        };

        const process: SynchronikProcess = {
            name: "Limited Run Process",
            id: "limited-run-process",
            workers: [worker],
            enabled: true,
        };

        manager.registerUnit(process);
        manager.start();

        // Manually trigger to start the cycle
        await manager.runProcessById("limited-run-process");

        // Wait for it to run a few times and stop
        await wait(150);

        // It should have run exactly 2 times and then stopped.
        expect(runFn).toHaveBeenCalledTimes(2);

        // Verify it is now disabled
        const workerInstance = manager
            .listUnits()
            .find((u) => u.id === "limited-run-worker");
        expect(workerInstance?.enabled).toBe(false);
    });

    it("should stop a worker when `stopWorkerById` is called", async () => {
        manager = createSynchronikManager({ loopInterval: 10 });

        const runFn = vi.fn();
        const worker: SynchronikWorker = {
            id: "stoppable-worker",
            name: "Stoppable Worker",
            enabled: true,
            intervalMs: 25,
            runOnInterval: true,
            run: runFn,
        };

        const process: SynchronikProcess = {
            name: "Stoppable Process",
            id: "stoppable-process",
            workers: [worker],
            enabled: true,
        };

        manager.registerUnit(process);
        manager.start();

        // Manually trigger to start the cycle
        await manager.runProcessById("stoppable-process");

        // Let it run a couple of times
        await wait(60);
        const runsBeforeStop = runFn.mock.calls.length;
        expect(runsBeforeStop).toBeGreaterThanOrEqual(2);

        // Stop the worker
        manager.stopWorkerById("stoppable-worker");

        // Verify it is now disabled
        const workerInstance = manager
            .listUnits()
            .find((u) => u.id === "stoppable-worker");
        expect(workerInstance?.enabled).toBe(false);

        // Wait again to ensure it doesn't run anymore
        await wait(100);
        const runsAfterStop = runFn.mock.calls.length;

        // The number of runs should not have increased
        expect(runsAfterStop).toBe(runsBeforeStop);
    });

    it("should NOT run a worker on an interval if `runOnInterval` is false or undefined", async () => {
        manager = createSynchronikManager({ loopInterval: 20 });

        const runFn = vi.fn();
        const worker: SynchronikWorker = {
            id: "manual-worker",
            name: "Manual Worker",
            enabled: true,
            intervalMs: 50, // Has an interval, but should be ignored
            // `runOnInterval` is omitted, so it defaults to false
            run: runFn,
        };

        const process: SynchronikProcess = {
            id: "manual-process",
            name: "Manual Process",
            enabled: true,
            workers: [worker],
        };

        manager.registerUnit(process);
        manager.start();

        // Manually trigger the first run
        await manager.runProcessById("manual-process");

        // It should run once immediately
        expect(runFn).toHaveBeenCalledTimes(1);

        // Wait long enough for interval runs to have occurred if they were going to
        await wait(120);

        // It should NOT have run again. The count should still be 1.
        expect(runFn).toHaveBeenCalledTimes(1);
    });

    it("should correctly increment runCount for both manual and interval runs", async () => {
        manager = createSynchronikManager({ loopInterval: 10 });
        manager.start();

        const runFn = vi.fn();
        const worker: SynchronikWorker = {
            id: "run-count-worker",
            name: "Run Count Worker",
            enabled: true,
            intervalMs: 25,
            runOnInterval: true,
            maxRuns: 3,
            run: runFn,
        };

        const process: SynchronikProcess = {
            name: "Run Count Process",
            id: "run-count-process",
            workers: [worker],
            enabled: true,
        };

        manager.registerUnit(process);

        // 1. Manual Run
        await manager.runProcessById("run-count-process");
        expect(runFn).toHaveBeenCalledTimes(1);
        let workerState = manager
            .listUnits()
            .find((u) => u.id === "run-count-worker");
        expect(workerState?.meta?.runCount).toBe(1);

        // 2. Interval Runs
        // Wait for at least 2 more interval runs
        await wait(60);

        workerState = manager
            .listUnits()
            .find((u) => u.id === "run-count-worker");
        expect(runFn.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(workerState?.meta?.runCount).toBeGreaterThanOrEqual(3);
    });
});
