import type {
  SynchronikDashboard,
  SynchronikManager,
  SynchronikUnit,
} from "../types/synchronik.js";

export function createSynchronikDashboard(): SynchronikDashboard {
  let manager: SynchronikManager | null = null;

  function renderUnit(unit: SynchronikUnit) {
    console.log(`[${unit.status}] ${unit.id}`);
  }

  function renderMilestone(
    milestoneId: string,
    payload?: Record<string, unknown>
  ) {
    console.log(`🎯 Milestone: ${milestoneId}`, payload);
  }

  return {
    attachToManager(mgr) {
      manager = mgr;
      mgr.onMilestone(renderMilestone);
    },

    render() {
      if (!manager) return;
      const units = manager.getRegistrySnapshot();
      console.clear();
      console.log("🔄 Synchronik Dashboard");
      units.forEach(renderUnit);
    },

    showUnitStatus(unitId) {
      if (!manager) return;
      const status = manager.getUnitStatus(unitId);
      console.log(`📦 Unit ${unitId} status: ${status}`);
    },

    showMilestoneArc(unitId) {
      console.log(`🌀 Milestone arc for ${unitId}...`);
      // Could visualize recent milestones or progress stages
    },

    triggerBadgeGlow(unitId, badge) {
      console.log(`✨ Badge '${badge}' triggered for ${unitId}`);
    },
  };
}
