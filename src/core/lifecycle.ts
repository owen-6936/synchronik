import type { SynchronikRegistry } from "../types/registry.js";
import type {
    MilestoneEmitter,
    SynchronikLifecycle,
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
        /**
     * Registers a new unit with the engine.

     * @param unit The unit to register.
     */
        register(unit) {
            registry.registerUnit(unit);
            eventBus.emit({ type: "start", unitId: unit.id });
        },

        /**

     * Updates the state of an existing unit.
     * @param id The ID of the unit to update.
     * @param updates A partial object of properties to update.
     */
        update(id, updates) {
            registry.updateUnitState(id, updates);
            if (updates.status === "error") {
                eventBus.emit({
                    type: "error",
                    unitId: id,
                    error: new Error(`Unit ${id} entered error state`),
                });
            } else if (updates.status === "completed") {
                eventBus.emit({
                    type: "complete",
                    unitId: id,
                });
            }
        },

        /**
         * Releases a unit from the engine, removing it from the registry.
         * @param id The ID of the unit to release.
         */
        release(id) {
            registry.releaseUnit(id);
            milestoneEmitter.emit(`unit:${id}:released`);
        },

        /**
         * Emits a custom milestone event.
         * @param milestoneId A unique identifier for the milestone.
         * @param payload Optional data to include with the milestone.
         */
        emitMilestone(milestoneId, payload) {
            milestoneEmitter.emit(milestoneId, payload);
        },
    };
}
