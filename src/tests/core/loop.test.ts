import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSynchronikLoop } from "../../core/loop";
import { createSynchronikRegistry } from "../../core/registry";
import { createStatusTracker } from "../../core/status-tracker";
import { createMilestoneEmitter, SynchronikEventBus } from "../../core/event";
import { createSynchronikLifecycle } from "../../core/lifecycle";
import { SynchronikUnit } from "../../types/synchronik";

describe("SynchronikLoop", () => {
    let registry: ReturnType<typeof createSynchronikRegistry>;
    let tracker: ReturnType<typeof createStatusTracker>;
    let loop: ReturnType<typeof createSynchronikLoop>;

    const mockWorker = (
        id: string,
        status: "idle" | "paused" | "completed" = "idle"
    ) => ({
        id,
        status,
        run: vi.fn().mockResolvedValue(undefined),
        name: "Mock Worker",
        enabled: true,
    });

    const mockProcess = (
        id: string,
        workerIds: string[],
        status: "idle" | "paused" = "idle"
    ) => ({
        id,
        status,
        workers: workerIds.map((wid) => mockWorker(wid)),
        name: "Mock Process",
        enabled: true,
        runMode: "sequential" as SynchronikUnit["runMode"],
    });

    beforeEach(() => {
        registry = createSynchronikRegistry();
        const eventBus = new SynchronikEventBus();
        const milestoneEmitter = createMilestoneEmitter(eventBus);
        const lifecycle = createSynchronikLifecycle(
            registry,
            eventBus,
            milestoneEmitter
        );
        tracker = createStatusTracker(lifecycle);
        loop = createSynchronikLoop(registry, tracker);

        // Prevent unhandled error exceptions by adding a dummy listener for the 'error' event.
        eventBus.subscribe("error", () => {});
    });

    it("runs idle workers and updates status", async () => {
        const p = mockProcess("p1", ["w1", "w2"]);
        registry.registerUnit(p);
        p.workers.forEach((w) => registry.registerUnit(w));

        await loop.run();

        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalled();
            expect(tracker.getStatus(w.id)).toBe("completed");
        }
    });

    it("skips paused workers", async () => {
        const p = mockProcess("p2", ["w3", "w4"]);
        p.workers[0].status = "paused";
        registry.registerUnit(p);
        p.workers.forEach((w) => registry.registerUnit(w));

        await loop.run();

        expect(p.workers[0].run).not.toHaveBeenCalled();
        expect(p.workers[1].run).toHaveBeenCalled();
    });

    it("skips paused processes entirely", async () => {
        const p = mockProcess("p3", ["w5", "w6"], "paused");
        registry.registerUnit(p);
        p.workers.forEach((w) => registry.registerUnit(w));

        await loop.run();

        for (const w of p.workers) {
            expect(w.run).not.toHaveBeenCalled();
        }
    });

    it("handles worker errors and updates status", async () => {
        const failingWorker = {
            id: "w7",
            status: "idle" as const,
            run: vi.fn().mockRejectedValue(new Error("fail")),
            name: "Failing Worker",
            enabled: true,
        };
        const p = {
            id: "p4",
            status: "idle" as const,
            workers: [failingWorker],
            name: "Mock Process",
            enabled: true,
        };

        registry.registerUnit(p);
        registry.registerUnit(failingWorker);

        await loop.run();

        expect(tracker.getStatus("w7")).toBe("error");
    });

    it("does not run workers already marked completed", async () => {
        const w = mockWorker("w8");
        w.status = "completed";
        const p = {
            id: "p5",
            status: "idle" as const,
            workers: [w],
            name: "Mock Process",
            enabled: true,
        };

        registry.registerUnit(p);
        registry.registerUnit(w);

        await loop.run();

        expect(w.run).not.toHaveBeenCalled();
    });

    it("runs workers in parallel when runMode is 'parallel'", async () => {
        const p = mockProcess("p6", ["w9", "w10"]);
        p.runMode = "parallel";
        registry.registerUnit(p);
        p.workers.forEach((w) => registry.registerUnit(w));

        const start = Date.now();
        await loop.run();
        const duration = Date.now() - start;

        // Parallel should be fast (no sequential delay)
        expect(duration).toBeLessThan(50);

        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalled();
            expect(tracker.getStatus(w.id)).toBe("completed");
        }
    });

    it("runs workers sequentially with delay when runMode is 'isolated'", async () => {
        const p = mockProcess("p7", ["w11", "w12"]);
        p.runMode = "isolated";
        registry.registerUnit(p);
        p.workers.forEach((w) => registry.registerUnit(w));

        const start = Date.now();
        await loop.run();
        const duration = Date.now() - start;

        // Isolated should take longer due to delay
        expect(duration).toBeGreaterThanOrEqual(100);

        for (const w of p.workers) {
            expect(w.run).toHaveBeenCalled();
            expect(tracker.getStatus(w.id)).toBe("completed");
        }
    });

    it("emits milestone with runMode in payload", async () => {
        const eventBus = new SynchronikEventBus();
        const milestoneEmitter = createMilestoneEmitter(eventBus);
        const lifecycle = createSynchronikLifecycle(
            registry,
            eventBus,
            milestoneEmitter
        );
        tracker = createStatusTracker(lifecycle);
        loop = createSynchronikLoop(registry, tracker);

        const milestoneSpy = vi.fn();
        eventBus.subscribe("milestone", milestoneSpy);

        const p = mockProcess("p8", ["w13"]);
        p.runMode = "parallel";
        registry.registerUnit(p);
        p.workers.forEach((w) => registry.registerUnit(w));

        await loop.run();

        const milestonePayloads = milestoneSpy.mock.calls.map(
            ([e]) => e.payload
        );
        const hasRunMode = milestonePayloads.some(
            (payload) => payload?.runMode === "parallel"
        );

        expect(hasRunMode).toBe(true);
    });
});
