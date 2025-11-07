import { beforeEach, describe, expect, it, vi } from "vitest";
import { SynchronikEventBus } from "../../core/event";
import { SynchronikVisualizer } from "../../types/synchronik";

describe("SynchronikDashboardVisualizer", () => {
  let visualizer: SynchronikVisualizer;
  let renderUnitStatus: SynchronikVisualizer["renderUnitStatus"];
  let renderMilestone: SynchronikVisualizer["renderMilestone"];
  let attachToEventBus: SynchronikVisualizer["attachToEventBus"];
  let eventBus: SynchronikEventBus;

  beforeEach(() => {
    renderUnitStatus = vi.fn();
    renderMilestone = vi.fn();
    attachToEventBus = vi.fn();

    visualizer = {
      renderUnitStatus,
      renderMilestone,
      attachToEventBus,
    };

    eventBus = new SynchronikEventBus();
  });

  it("renders unit status updates", () => {
    visualizer.renderUnitStatus("w1", "running");
    expect(renderUnitStatus).toHaveBeenCalledWith("w1", "running");
  });

  it("renders milestone overlays", () => {
    visualizer.renderMilestone("unit:w2:completed", { badge: "gold" });
    expect(renderMilestone).toHaveBeenCalledWith("unit:w2:completed", {
      badge: "gold",
    });
  });

  it("attaches to event bus and reacts to milestones", () => {
    visualizer.attachToEventBus(eventBus);
    eventBus.subscribeAll((event) => {
      if (event.type !== "milestone") return;
      visualizer.renderMilestone(event.milestoneId, event.payload);
    });

    eventBus.emit({
      milestoneId: "unit:w3:completed",
      payload: { badge: "silver" },
      type: "milestone",
    });

    expect(renderMilestone).toHaveBeenCalledWith("unit:w3:completed", {
      badge: "silver",
    });
  });

  it("ignores non-milestone events", () => {
    visualizer.attachToEventBus(eventBus);
    eventBus.subscribeAll((event) => {
      if (event.type !== "milestone") return;
      if (event.milestoneId?.startsWith("unit:")) {
        visualizer.renderMilestone(event.milestoneId, event.payload);
      }
    });

    eventBus.emit({
      milestoneId: "system:heartbeat",
      payload: { tick: true },
      type: "milestone",
    });

    expect(renderMilestone).not.toHaveBeenCalled();
  });
});
