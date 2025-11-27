import { describe, it, expect, vi } from "vitest";
import { createSynchronikRegistry } from "../../core/registry";
import type {
    SynchronikWorker,
    SynchronikProcess,
} from "../../types/synchronik";

describe("SynchronikRegistry", () => {
    const mockWorker = (id: string): SynchronikWorker => ({
        id,
        status: "idle",
        run: vi.fn(),
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

    it("registers and retrieves workers and processes", () => {
        const registry = createSynchronikRegistry();
        const w1 = mockWorker("w1");
        const p1 = mockProcess("p1", ["w2", "w3"]);

        registry.registerUnit(w1);
        registry.registerUnit(p1);

        expect(registry.getUnitById("w1")).toEqual(w1);
        expect(registry.getUnitById("p1")).toEqual(p1);
        expect(registry.listWorkers().length).toBe(3); // w1, w2, w3
        expect(registry.listProcesses()).toContain(p1);
    });

    it("releases units and removes them from registry", () => {
        const registry = createSynchronikRegistry();
        const w1 = mockWorker("w1");
        registry.registerUnit(w1);
        registry.releaseUnit("w1");

        expect(registry.getUnitById("w1")).toBeUndefined();
        expect(registry.listWorkers()).not.toContain(w1);
    });

    it("handles duplicate registration safely", () => {
        const registry = createSynchronikRegistry();
        const w1 = mockWorker("w1");
        registry.registerUnit(w1);
        registry.registerUnit(w1); // duplicate

        expect(registry.listWorkers().length).toBe(1);
    });

    it("returns empty lists when nothing is registered", () => {
        const registry = createSynchronikRegistry();
        expect(registry.listUnits()).toEqual([]);
        expect(registry.listWorkers()).toEqual([]);
        expect(registry.listProcesses()).toEqual([]);
    });

    it("handles release of unknown unit gracefully", () => {
        const registry = createSynchronikRegistry();
        expect(() => registry.releaseUnit("ghost")).not.toThrow();
        expect(registry.getUnitById("ghost")).toBeUndefined();
    });

    it("supports mixed registration and lookup", () => {
        const registry = createSynchronikRegistry();
        const w1 = mockWorker("w1");
        const p1 = mockProcess("p1", ["w2"]);

        registry.registerUnit(w1);
        registry.registerUnit(p1);

        expect(registry.listUnits().map((u) => u.id)).toEqual(
            expect.arrayContaining(["w1", "p1", "w2"])
        );
        expect(registry.getProcessById("p1")).toEqual(p1);
        expect(registry.getWorkerById("w2")?.id).toBe("w2");
    });
});
