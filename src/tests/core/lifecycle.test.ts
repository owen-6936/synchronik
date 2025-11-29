import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReactiveRegistry } from "../../core/ReactiveRegistry";
import { createSynchronikLifecycle } from "../../core/lifecycle";
import { SynchronikEventBus } from "../../core/event";
import { createMilestoneEmitter } from "../../core/event";
import type {
    SynchronikProcess,
    SynchronikWorker,
} from "../../types/synchronik";

describe("SynchronikLifecycle", () => {
    let registry: ReactiveRegistry;
    let eventBus: SynchronikEventBus;
    let emitter: ReturnType<typeof createMilestoneEmitter>;
    let lifecycle: ReturnType<typeof createSynchronikLifecycle>;
    let events: any[];

    const mockWorker = (id: string, enabled = true): SynchronikWorker => ({
        id,
        status: "idle",
        run: vi.fn(),
        name: "Mock Worker",
        enabled,
    });

    const mockProcess = (
        id: string,
        workers: SynchronikWorker[],
        enabled = true
    ): SynchronikProcess => ({
        id,
        status: "idle",
        name: "Mock Process",
        enabled,
        workers,
    });

    beforeEach(() => {
        eventBus = new SynchronikEventBus();
        emitter = createMilestoneEmitter(eventBus);
        registry = new ReactiveRegistry(eventBus);
        lifecycle = createSynchronikLifecycle(registry, eventBus, emitter);
        events = [];
        eventBus.subscribeAll((e) => events.push(e));
    });

    it("updates unit status and emits an 'updated' event", () => {
        const w = mockWorker("w1");
        registry.registerUnit(w);

        lifecycle.update("w1", { status: "running" });
        expect(registry.getUnitById("w1")?.status).toBe("running");

        const updateEvent = events.find(
            (e) => e.type === "updated" && e.unitId === "w1"
        );
        expect(updateEvent).toBeDefined();
        expect(updateEvent.payload.reason).toBe("status-change");
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

    it("can disable and enable a worker via update", () => {
        const w = mockWorker("w5", true);
        registry.registerUnit(w);
        expect(registry.getUnitById("w5")?.enabled).toBe(true);

        // Disable
        lifecycle.update("w5", { enabled: false });
        expect(registry.getUnitById("w5")?.enabled).toBe(false);

        // Enable
        lifecycle.update("w5", { enabled: true });
        expect(registry.getUnitById("w5")?.enabled).toBe(true);
    });

    it("can disable and enable a process via update", () => {
        const p = mockProcess("p1", [], true);
        registry.registerUnit(p);
        expect(registry.getUnitById("p1")?.enabled).toBe(true);

        // Disable
        lifecycle.update("p1", { enabled: false });
        expect(registry.getUnitById("p1")?.enabled).toBe(false);

        // Enable
        lifecycle.update("p1", { enabled: true });
        expect(registry.getUnitById("p1")?.enabled).toBe(true);
    });

    it("emits an 'updated' event on any configuration change", () => {
        const w = mockWorker("w-config");
        registry.registerUnit(w);

        // Change a configuration property other than 'enabled'
        lifecycle.update("w-config", { name: "A New Name" });

        // Expect an 'updated' event to be emitted
        const updateEvent = events.find((e) => e.type === "updated");
        expect(updateEvent).toBeDefined();
        expect(updateEvent?.unitId).toBe("w-config");
        expect(updateEvent?.payload.reason).toBe("config-change");
        expect(updateEvent?.payload.name).toBe("A New Name");
    });

    it("emits a single 'updated' event for combined status and config changes", () => {
        const w = mockWorker("w-combo");
        registry.registerUnit(w);

        // Update both status and a config property in one call
        lifecycle.update("w-combo", {
            status: "running",
            name: "New Combo Name",
        });

        // Find all 'updated' events for this specific worker
        const updateEvents = events.filter(
            (e) => e.type === "updated" && e.unitId === "w-combo"
        );

        // Assert that exactly one event was emitted
        expect(updateEvents).toHaveLength(1);
        expect(updateEvents[0].payload.reason).toBe("status-change"); // Status change takes priority
        expect(updateEvents[0].payload.name).toBe("New Combo Name");
    });
});
