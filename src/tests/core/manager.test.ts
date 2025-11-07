import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSynchronikManager } from "../../core/manager";
import type {
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

  const mockProcess = (id: string, workerIds: string[]): SynchronikProcess => ({
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
  });

  it("registers and snapshots units", () => {
    const w = mockWorker("w1");
    manager.registerUnit(w);

    const snapshot = manager.getRegistrySnapshot();
    expect(snapshot.map((u) => u.id)).toContain("w1");
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

    const p = {
      id: "p-stop",
      status: "idle" as const,
      workers: [w1, w2],
      name: "Mock Process",
      enabled: true,
    };
    manager.registerUnit(p);

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

    manager.updateStatus("w8", "error", {
      emitMilestone: true,
      payload: { reason: "fail" },
    });

    expect(events.some((e) => e.id.includes("w8"))).toBe(true);
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
    expect(events.some((e) => e.payload?.runMode === "parallel")).toBe(true);

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
    expect(events.some((e) => e.payload?.runMode === "isolated")).toBe(true);

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

    const hasRunMode = events.some((e) => e.payload?.runMode === "sequential");
    expect(hasRunMode).toBe(true);
  });
});
