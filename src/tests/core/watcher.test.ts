import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUnitWatcher } from "../../core/watcher";
import { createSynchronikRegistry } from "../../core/registry";
import { createSynchronikLifecycle } from "../../core/lifecycle";
import { SynchronikEventBus } from "../../core/event";
import { createMilestoneEmitter } from "../../core/event";
import type {
    SynchronikWorker,
    SynchronikProcess,
} from "../../types/synchronik";

describe("UnitWatcher", () => {
    let registry: ReturnType<typeof createSynchronikRegistry>;
    let lifecycle: ReturnType<typeof createSynchronikLifecycle>;
    let watcher: ReturnType<typeof createUnitWatcher>;
    let events: any[];

    const now = Date.now();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000 - 1000); // 5 min + 1s

    const mockWorker = (
        id: string,
        status: "idle" | "paused" | "completed",
        lastRun?: Date
    ): SynchronikWorker => ({
        id,
        status,
        run: vi.fn(),
        lastRun,
        name: "Mock Worker",
        enabled: true,
    });

    beforeEach(() => {
        registry = createSynchronikRegistry();
        const eventBus = new SynchronikEventBus();
        const milestoneEmitter = createMilestoneEmitter(eventBus);
        lifecycle = createSynchronikLifecycle(
            registry,
            eventBus,
            milestoneEmitter
        );
        events = [];
        eventBus.subscribeAll((e) => events.push(e));
    });

    it("releases idle workers past threshold", () => {
        const w = mockWorker("w1", "idle", fiveMinutesAgo);
        registry.registerUnit(w);

        watcher = createUnitWatcher(registry, lifecycle);
        watcher.scan();

        expect(registry.getUnitById("w1")).toBeUndefined();
        expect(events.some((e) => e.milestoneId === "worker:w1:released")).toBe(
            true
        );
    });

    it("does not release idle workers within threshold", () => {
        const w = mockWorker("w2", "idle", new Date());
        registry.registerUnit(w);

        watcher = createUnitWatcher(registry, lifecycle);
        watcher.scan();

        expect(registry.getUnitById("w2")).toBeDefined();
        expect(events.some((e) => e.milestoneId === "worker:w2:released")).toBe(
            false
        );
    });

    it("auto-unpauses paused workers if enabled", () => {
        const w = mockWorker("w3", "paused");
        registry.registerUnit(w);

        watcher = createUnitWatcher(registry, lifecycle, { autoUnpause: true });
        watcher.scan();

        expect(registry.getUnitById("w3")?.status).toBe("idle");
        expect(events.some((e) => e.milestoneId === "worker:w3:unpaused")).toBe(
            true
        );
    });

    it("does not unpause if autoUnpause is disabled", () => {
        const w = mockWorker("w4", "paused");
        registry.registerUnit(w);

        watcher = createUnitWatcher(registry, lifecycle, {
            autoUnpause: false,
        });
        watcher.scan();

        expect(registry.getUnitById("w4")?.status).toBe("paused");
        expect(events.some((e) => e.milestoneId === "worker:w4:unpaused")).toBe(
            false
        );
    });

    it("handles mixed worker states safely", () => {
        const w1 = mockWorker("w5", "idle", fiveMinutesAgo);
        const w2 = mockWorker("w6", "paused");
        const w3 = mockWorker("w7", "idle", new Date());

        registry.registerUnit(w1);
        registry.registerUnit(w2);
        registry.registerUnit(w3);

        watcher = createUnitWatcher(registry, lifecycle, { autoUnpause: true });
        watcher.scan();

        expect(registry.getUnitById("w5")).toBeUndefined(); // released
        expect(registry.getUnitById("w6")?.status).toBe("idle"); // unpaused
        expect(registry.getUnitById("w7")).toBeDefined(); // untouched

        expect(events.some((e) => e.milestoneId === "worker:w5:released")).toBe(
            true
        );
        expect(events.some((e) => e.milestoneId === "worker:w6:unpaused")).toBe(
            true
        );
        expect(events.some((e) => e.milestoneId === "worker:w7:released")).toBe(
            false
        );
    });
});
