import type { SynchronikVisualizer } from "../types/synchronik.js";
import { mapEventTypeToStatus } from "../utils/core.js";

export function createSynchronikVisualizer(
  renderFn?: (
    type: "status" | "milestone",
    message: string,
    meta?: Record<string, unknown>
  ) => void
): SynchronikVisualizer {
  const visualizer: SynchronikVisualizer = {
    renderUnitStatus(unitId, status, message) {
      const msg = message ?? `[Visualizer] Unit ${unitId} is now ${status}`;
      renderFn?.("status", msg, { unitId, status });
    },

    renderMilestone(milestoneId, payload, message) {
      const msg = message ?? `[Visualizer] Milestone reached: ${milestoneId}`;
      renderFn?.("milestone", msg, { milestoneId, payload });
    },

    attachToEventBus(eventBus) {
      eventBus.subscribeAll((event) => {
        if (
          event.type === "start" ||
          event.type === "complete" ||
          event.type === "error"
        ) {
          const status = mapEventTypeToStatus(event.type);
          if (status && "unitId" in event) {
            visualizer.renderUnitStatus(event.unitId, status);
          }
        }

        if (event.type === "milestone") {
          visualizer.renderMilestone(event.milestoneId, event.payload);
        }
      });
    },
  };

  return visualizer;
}
