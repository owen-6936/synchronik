import type {
  StatusTracker,
  SynchronikLifecycle,
  SynchronikVisualizer,
} from "../types/synchronik.js";

export function createStatusTracker(
  lifecycle: SynchronikLifecycle,
  visualizer?: SynchronikVisualizer
): StatusTracker {
  const statusMap = new Map<string, string>();

  return {
    setStatus(unitId, status, options = {}) {
      if (status === undefined) return;

      statusMap.set(unitId, status); // ✅ track locally
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

    getStatus(unitId) {
      return statusMap.get(unitId);
    },
  } as StatusTracker;
}
