import type {
    SynchronikDashboard,
    SynchronikManager,
    SynchronikUnit,
} from "../types/synchronik.js";

/**
 * Creates a simple console-based dashboard for visualizing the state of the Synchronik engine.
 * It can be attached to a manager instance to listen for events and render updates.
 *
 * @returns A `SynchronikDashboard` instance.
 */
export function createSynchronikDashboard(): SynchronikDashboard {
    let manager: SynchronikManager | null = null;

    /**
     * Renders the status of a single unit to the console.
     * @param unit The unit to render.
     */
    function renderUnit(unit: SynchronikUnit) {
        console.log(`[${unit.status}] ${unit.id}`);
    }

    /**
     * Renders a milestone event to the console.
     * @param milestoneId The ID of the milestone.
     * @param payload Optional data associated with the milestone.
     */
    function renderMilestone(
        milestoneId: string,
        payload?: Record<string, unknown>
    ) {
        console.log(`🎯 Milestone: ${milestoneId}`, payload);
    }

    return {
        /**
         * Attaches the dashboard to a Synchronik manager instance to receive events.
         * @param mgr The manager instance.
         */
        attachToManager(mgr) {
            manager = mgr;
            mgr.onMilestone(renderMilestone);
        },

        /**
         * Renders a snapshot of the current state of all registered units.
         * Clears the console before rendering.
         */
        render() {
            if (!manager) return;
            const units = manager.getRegistrySnapshot();
            console.clear();
            console.log("🔄 Synchronik Dashboard");
            units.forEach(renderUnit);
        },

        /**
         * Displays the current status of a specific unit.
         * @param unitId The ID of the unit to inspect.
         */
        showUnitStatus(unitId) {
            if (!manager) return;
            const status = manager.getUnitStatus(unitId);
            console.log(`📦 Unit ${unitId} status: ${status}`);
        },

        /**
         * Placeholder function to visualize a milestone arc for a unit.
         * @param unitId The ID of the unit.
         */
        showMilestoneArc(unitId) {
            console.log(`🌀 Milestone arc for ${unitId}...`);
            // Could visualize recent milestones or progress stages
        },

        /**
         * Placeholder function to trigger a visual effect, like a glowing badge.
         * @param unitId The ID of the unit.
         * @param badge The badge to trigger.
         */
        triggerBadgeGlow(unitId, badge) {
            console.log(`✨ Badge '${badge}' triggered for ${unitId}`);
        },
    };
}
