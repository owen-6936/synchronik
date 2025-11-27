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
        expect(startListener).toHaveBeenCalledWith({
            type: "start",
            unitId: "w1",
        });
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

    it("calls subscribeAll listener for all event types and logs payloads", () => {
        const allListener = vi.fn((event) => {
            // Log the event to the console to show its structure
            if (event.type === "error") {
                // Error objects don't serialize well, so we log the message
                console.log("Event Emitted:", {
                    ...event,
                    error: event.error.message,
                });
            } else {
                console.log("Event Emitted:", event);
            }
        });

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

describe("Handling worker and process specific events", () => {
    let bus: SynchronikEventBus;
    const workerListener = vi.fn();
    const processListener = vi.fn();

    beforeEach(() => {
        bus = new SynchronikEventBus();
        workerListener.mockClear();
        processListener.mockClear();

        // A generic listener that delegates to specific handlers
        bus.subscribeAll((event) => {
            if ("unitId" in event && event.unitId) {
                if (event.unitId.startsWith("worker-")) {
                    workerListener(event);
                } else if (event.unitId.startsWith("process-")) {
                    processListener(event);
                }
            }
        });
    });

    it("should route worker events to the worker listener", () => {
        const workerStartEvent = { type: "start" as const, unitId: "worker-A" };
        const workerCompleteEvent = {
            type: "complete" as const,
            unitId: "worker-A",
            result: "done",
        };

        bus.emit(workerStartEvent);
        bus.emit(workerCompleteEvent);

        expect(workerListener).toHaveBeenCalledTimes(2);
        expect(workerListener).toHaveBeenCalledWith(workerStartEvent);
        expect(workerListener).toHaveBeenCalledWith(workerCompleteEvent);
        expect(processListener).not.toHaveBeenCalled();
    });

    it("should route process events to the process listener", () => {
        const processStartEvent = {
            type: "start" as const,
            unitId: "process-X",
        };
        const processCompleteEvent = {
            type: "complete" as const,
            unitId: "process-X",
        };

        bus.emit(processStartEvent);
        bus.emit(processCompleteEvent);

        expect(processListener).toHaveBeenCalledTimes(2);
        expect(processListener).toHaveBeenCalledWith(processStartEvent);
        expect(processListener).toHaveBeenCalledWith(processCompleteEvent);
        expect(workerListener).not.toHaveBeenCalled();
    });
});
