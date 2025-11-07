import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSynchronikManager } from "../core/manager";
import { SynchronikProcess, SynchronikWorker } from "../types/synchronik";

describe("RunMode execution benchmarks", () => {
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
    workerIds: string[],
    runMode: "parallel" | "sequential" | "isolated"
  ): SynchronikProcess => ({
    id,
    status: "idle",
    workers: workerIds.map(mockWorker),
    name: "Mock Process",
    enabled: true,
    runMode,
  });

  beforeEach(() => {
    manager = createSynchronikManager();
    events = [];
    manager.onMilestone((id, payload) => events.push({ id, payload }));
  });

  it("benchmarks parallel mode", async () => {
    const p = mockProcess("p-parallel", ["w1", "w2", "w3"], "parallel");
    manager.registerUnit(p);
    p.workers.forEach((w) => manager.registerUnit(w));

    const start = Date.now();
    await manager.runProcessById("p-parallel");
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50);
    expect(events.some((e) => e.payload?.runMode === "parallel")).toBe(true);
  });

  it("runs process in sequential mode", async () => {
    const p = mockProcess("p-sequential", ["w4", "w5", "w6"], "sequential");
    manager.registerUnit(p);
    p.workers.forEach((w) => manager.registerUnit(w));

    await manager.runProcessById("p-sequential");

    for (const w of p.workers) {
      expect(w.run).toHaveBeenCalled();
      expect(manager.getUnitStatus(w.id)).toBe("completed");
    }

    expect(events.some((e) => e.payload?.runMode === "sequential")).toBe(true);
  });

  it("benchmarks isolated mode", async () => {
    const p = mockProcess("p-isolated", ["w7", "w8", "w9"], "isolated");
    manager.registerUnit(p);
    p.workers.forEach((w) => manager.registerUnit(w));

    const start = Date.now();
    await manager.runProcessById("p-isolated");
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(200); // delay per unit
    expect(events.some((e) => e.payload?.runMode === "isolated")).toBe(true);
  });
});
