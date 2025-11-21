import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSynchronikVisualizer } from "../../core/visualizer";
import { SynchronikEventBus } from "../../core/event";
import type { SynchronikVisualizer } from "../../types/synchronik";

describe("SynchronikVisualizer", () => {
    let visualizer: SynchronikVisualizer;
    let eventBus: SynchronikEventBus;

    beforeEach(() => {
        // Create a real visualizer and spy on its methods
        visualizer = createSynchronikVisualizer();
        vi.spyOn(visualizer, "renderUnitStatus");
        vi.spyOn(visualizer, "renderMilestone");
        // Create a real event bus to test the connection
        eventBus = new SynchronikEventBus();
    });

    it("renders unit status updates on dedicated status events", () => {
        visualizer.attachToEventBus(eventBus);

        // The visualizer listens for specific 'start', 'complete', and 'error' events
        eventBus.emit({ type: "start", unitId: "w1" });
        eventBus.emit({ type: "complete", unitId: "w2" });
        eventBus.emit({
            type: "error",
            unitId: "w3",
            error: new Error("fail"),
        });

        expect(visualizer.renderUnitStatus).toHaveBeenCalledWith(
            "w1",
            "running"
        );
        expect(visualizer.renderUnitStatus).toHaveBeenCalledWith(
            "w2",
            "completed"
        );
        expect(visualizer.renderUnitStatus).toHaveBeenCalledWith("w3", "error");
    });

    it("renders milestone overlays", () => {
        visualizer.attachToEventBus(eventBus);

        eventBus.emit({
            type: "milestone",
            milestoneId: "process:p1:completed", // The full ID is passed
            payload: { badge: "gold" },
        });

        expect(visualizer.renderMilestone).toHaveBeenCalledWith(
            "process:p1:completed",
            {
                badge: "gold",
            }
        );
    });
    it("does not render a milestone for non-milestone events", () => {
        visualizer.attachToEventBus(eventBus);
        // Emitting a status event should not trigger a milestone render
        eventBus.emit({ type: "start", unitId: "w1" });
        expect(visualizer.renderMilestone).not.toHaveBeenCalled();
    });
});
