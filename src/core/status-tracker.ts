import type {
    StatusTracker,
    SynchronikLifecycle,
    SynchronikVisualizer,
} from "../types/synchronik.js";

/**
 * Creates a status tracker for the Synchronik engine.
 * This module is responsible for setting and tracking the status of units.
 * @returns A `StatusTracker` instance.
 */
export function createStatusTracker(
    lifecycle: SynchronikLifecycle,
    visualizer?: SynchronikVisualizer
): StatusTracker {
    const statusMap = new Map<string, string>();

    return {
        /**
         * Sets the status for a given unit and optionally emits a milestone.
         * @param unitId The ID of the unit to update.
         * @param status The new status to set.
         * @param options Configuration for milestone emission.
         */
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

        /**
         * Retrieves the last known status of a unit.
         * @param unitId The ID of the unit.
         * @returns The unit's status, or undefined if not found.
         */
        getStatus(unitId) {
            return statusMap.get(unitId);
        },
    } as StatusTracker;
}
