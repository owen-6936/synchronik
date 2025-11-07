import type {
  StatusTracker,
  SynchronikLifecycle,
  SynchronikVisualizer,
} from "../types/synchronik.js";

export function createStatusTracker(
  lifecycle: SynchronikLifecycle,
  visualizer?: SynchronikVisualizer
): StatusTracker {
  return {
    setStatus(unitId, status, options = {}) {
      if (status === undefined) return;
      lifecycle.update(unitId, {
        status,
        lastRun: new Date(),
      });

      visualizer?.renderUnitStatus(unitId, status);

      if (options.emitMilestone) {
        const milestoneId = `unit:${unitId}:${status}`;
        lifecycle.emitMilestone(milestoneId, options.payload);
      }
    },
  };
}
