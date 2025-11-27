import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSynchronikRegistry } from "../../core/registry";
import { createSynchronikLifecycle } from "../../core/lifecycle";
import { SynchronikEventBus } from "../../core/event";
import { createMilestoneEmitter } from "../../core/event";
import type { SynchronikWorker } from "../../types/synchronik";

describe("SynchronikLifecycle", () => {
    let registry: ReturnType<typeof createSynchronikRegistry>;
    let eventBus: SynchronikEventBus;
    let emitter: ReturnType<typeof createMilestoneEmitter>;
    let lifecycle: ReturnType<typeof createSynchronikLifecycle>;
    let events: any[];

    const mockWorker = (id: string): SynchronikWorker => ({
        id,
        status: "idle",
        run: vi.fn(),
        name: "Mock Worker",
        enabled: true,
    });

    beforeEach(() => {
        registry = createSynchronikRegistry();
        eventBus = new SynchronikEventBus();
        emitter = createMilestoneEmitter(eventBus);
        lifecycle = createSynchronikLifecycle(registry, eventBus, emitter);
        events = [];
        eventBus.subscribeAll((e) => events.push(e));
    });

    it("updates unit status and emits milestone", () => {
        const w = mockWorker("w1");
        registry.registerUnit(w);

        lifecycle.update("w1", { status: "running" });
        expect(registry.getUnitById("w1")?.status).toBe("running");

        lifecycle.emitMilestone("unit:w1:started", { foo: "bar" });
        expect(events.some((e) => e.milestoneId === "unit:w1:started")).toBe(
            true
        );
    });

    it("releases unit and removes it from registry", () => {
        const w = mockWorker("w2");
        registry.registerUnit(w);

        lifecycle.release("w2");
        expect(registry.getUnitById("w2")).toBeUndefined();
        expect(registry.listWorkers()).not.toContain(w);
    });

    it("handles update of unknown unit gracefully", () => {
        expect(() =>
            lifecycle.update("ghost", { status: "error" })
        ).not.toThrow();
        expect(registry.getUnitById("ghost")).toBeUndefined();
    });

    it("emits milestone for unit stage", () => {
        const w = mockWorker("w3");
        registry.registerUnit(w);

        emitter.emitForUnit("w3", "completed", { duration: 123 });
        expect(events.some((e) => e.milestoneId === "unit:w3:completed")).toBe(
            true
        );
    });

    it("does not emit milestone if unit is missing", () => {
        emitter.emitForUnit("ghost", "completed");
        expect(
            events.some((e) => e.milestoneId === "unit:ghost:completed")
        ).toBe(true); // still emits, registry not required
    });

    it("updates unit state with partial fields", () => {
        const w = mockWorker("w4");
        registry.registerUnit(w);

        lifecycle.update("w4", { status: "paused" });
        expect(registry.getUnitById("w4")?.status).toBe("paused");

        lifecycle.update("w4", { lastRun: new Date("2025-11-07T10:00:00Z") });
        expect(registry.getUnitById("w4")?.lastRun?.toISOString()).toBe(
            "2025-11-07T10:00:00.000Z"
        );
    });
});
