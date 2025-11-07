import type { SynchronikRegistry } from "../types/registry.js";
import type {
  MilestoneEmitter,
  SynchronikLifecycle,
} from "../types/synchronik.js";
import type { SynchronikEventBus } from "./event.js";

export function createSynchronikLifecycle(
  registry: SynchronikRegistry,
  eventBus: SynchronikEventBus,
  milestoneEmitter: MilestoneEmitter
): SynchronikLifecycle {
  return {
    register(unit) {
      registry.registerUnit(unit);
      eventBus.emit({ type: "start", unitId: unit.id });
    },

    update(id, updates) {
      registry.updateUnitState(id, updates);
      if (updates.status === "error") {
        eventBus.emit({
          type: "error",
          unitId: id,
          error: new Error(`Unit ${id} entered error state`), // or pass a real error if available
        });
      } else if (updates.status === "completed") {
        eventBus.emit({
          type: "complete",
          unitId: id,
        });
      }
    },

    release(id) {
      registry.releaseUnit(id);
      milestoneEmitter.emit(`unit:${id}:released`);
    },

    emitMilestone(milestoneId, payload) {
      milestoneEmitter.emit(milestoneId, payload);
    },
  };
}
