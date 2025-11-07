import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStatusTracker } from "../../core/status-tracker";
import type {
  SynchronikVisualizer,
  SynchronikLifecycle,
} from "../../types/synchronik";

describe("SynchronikVisualizer", () => {
  let renderUnitStatus: SynchronikVisualizer["renderUnitStatus"];
  let renderMilestone: SynchronikVisualizer["renderMilestone"];
  let attachToEventBus: SynchronikVisualizer["attachToEventBus"];
  let visualizer: SynchronikVisualizer;
  let lifecycle: SynchronikLifecycle;
  let tracker: ReturnType<typeof createStatusTracker>;

  beforeEach(() => {
    renderUnitStatus = vi.fn();
    renderMilestone = vi.fn();
    attachToEventBus = vi.fn();

    visualizer = {
      renderUnitStatus,
      renderMilestone,
      attachToEventBus,
    };

    lifecycle = {
      update: vi.fn(),
      emitMilestone: vi.fn(),
      release: vi.fn(),
      register: vi.fn(),
    };

    tracker = createStatusTracker(lifecycle, visualizer);
  });

  it("calls renderUnitStatus on status update", () => {
    tracker.setStatus("w1", "running");
    expect(renderUnitStatus).toHaveBeenCalledWith("w1", "running");
  });

  it("calls renderMilestone when manually triggered", () => {
    visualizer.renderMilestone("unit:w2:completed", { badge: "gold" });
    expect(renderMilestone).toHaveBeenCalledWith("unit:w2:completed", {
      badge: "gold",
    });
  });

  it("calls attachToEventBus with correct bus", () => {
    const mockBus = { subscribeAll: vi.fn() };
    visualizer.attachToEventBus(mockBus as any);
    expect(attachToEventBus).toHaveBeenCalledWith(mockBus);
  });

  it("handles milestone emission with visualizer", () => {
    tracker.setStatus("w3", "completed", {
      emitMilestone: true,
      payload: { glow: true },
    });

    expect(lifecycle.emitMilestone).toHaveBeenCalledWith("unit:w3:completed", {
      glow: true,
    });
    expect(renderUnitStatus).toHaveBeenCalledWith("w3", "completed");
  });

  it("ignores undefined status updates", () => {
    tracker.setStatus("w4", undefined as any);
    expect(renderUnitStatus).not.toHaveBeenCalled();
    expect(lifecycle.update).not.toHaveBeenCalled();
  });
});
