import { describe, it, expect, vi, beforeEach } from "vitest";
import { SynchronikEventBus } from "../../core/event";

describe("SynchronikEventBus typed subscriptions", () => {
  let bus: SynchronikEventBus;

  beforeEach(() => {
    bus = new SynchronikEventBus();
    bus.subscribe("error", () => {
      // absorb error event to prevent crash
    });
  });

  it("calls start listener only on start events", () => {
    const startListener = vi.fn();
    bus.subscribe("start", startListener);

    bus.emit({ type: "start", unitId: "w1" });
    bus.emit({ type: "complete", unitId: "w1" });

    expect(startListener).toHaveBeenCalledTimes(1);
    expect(startListener).toHaveBeenCalledWith({ type: "start", unitId: "w1" });
  });

  it("calls complete listener only on complete events", () => {
    const completeListener = vi.fn();
    bus.subscribe("complete", completeListener);

    bus.emit({ type: "complete", unitId: "w2" });
    bus.emit({ type: "error" as const, unitId: "w2", error: new Error() });

    expect(completeListener).toHaveBeenCalledTimes(1);
    expect(completeListener).toHaveBeenCalledWith({
      type: "complete",
      unitId: "w2",
    });
  });

  it("calls error listener only on error events", () => {
    const errorListener = vi.fn();
    bus.subscribe("error", errorListener);

    bus.emit({ type: "error" as const, unitId: "w3", error: new Error() });
    bus.emit({ type: "start", unitId: "w3" });

    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledWith({
      type: "error",
      unitId: "w3",
      error: new Error(),
    });
  });

  it("calls milestone listener only on milestone events", () => {
    const milestoneListener = vi.fn();
    bus.subscribe("milestone", milestoneListener);

    bus.emit({
      type: "milestone",
      milestoneId: "unit:w4:completed",
      payload: { badge: "gold" },
    });
    bus.emit({ type: "start", unitId: "w4" });

    expect(milestoneListener).toHaveBeenCalledTimes(1);
    expect(milestoneListener).toHaveBeenCalledWith({
      type: "milestone",
      milestoneId: "unit:w4:completed",
      payload: { badge: "gold" },
    });
  });

  it("calls subscribeAll listener for all event types", () => {
    const allListener = vi.fn();
    bus.subscribeAll(allListener);

    bus.emit({ type: "start", unitId: "w5" });
    bus.emit({ type: "complete", unitId: "w5" });
    bus.emit({ type: "error", unitId: "w5", error: new Error() });
    bus.emit({
      type: "milestone",
      milestoneId: "unit:w5:completed",
      payload: {},
    });

    expect(allListener).toHaveBeenCalledTimes(4);
  });
});
