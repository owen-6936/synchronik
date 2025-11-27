import type {
    MilestoneEmitter,
    SynchronikLifecycle,
    SynchronikRegistry,
} from "../types/synchronik.js";
import type { SynchronikEventBus } from "./event.js";

/**
 * Creates a lifecycle manager for Synchronik units.
 * This module is responsible for registering, updating, and releasing units,
 * and for emitting corresponding lifecycle events.
 *
 * @param registry The central unit registry.
 * @param eventBus The central event bus for emitting events.
 * @param milestoneEmitter The emitter for milestone events.
 * @returns A `SynchronikLifecycle` instance.
 */
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
            const { status, error, ...rest } = updates;
            registry.updateUnitState(id, { status, error, ...rest });

            if (status === "error") {
                eventBus.emit({
                    type: "error",
                    unitId: id,
                    error: error || new Error(`Unit ${id} entered error state`),
                });
            } else if (status === "completed") {
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
