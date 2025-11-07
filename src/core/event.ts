import { EventEmitter } from "stream";
import type { MilestoneEmitter, SynchronikEvent } from "../types/synchronik.js";

/**
 * A central event bus for the Synchronik engine, built on Node.js's EventEmitter.
 * It handles the emission and subscription of core lifecycle events.
 */
export class SynchronikEventBus {
  private emitter = new EventEmitter();

  /**
   * Emits an event to all listeners subscribed to the event's type.
   * @param event The event object to emit.
   */
  emit(event: SynchronikEvent) {
    this.emitter.emit(event.type, event);
  }

  /**
   * Subscribes a listener to a specific event type.
   * @param type The type of event to listen for.
   * @param listener A callback function that will be invoked when the event is emitted.
   * @returns An unsubscribe function to remove the listener.
   */
  subscribe<T extends SynchronikEvent["type"]>(
    type: T,
    listener: (event: Extract<SynchronikEvent, { type: T }>) => void
  ): () => void {
    const wrapped = (event: SynchronikEvent) => {
      if (event.type === type) {
        listener(event as Extract<SynchronikEvent, { type: T }>);
      }
    };

    this.emitter.on(type, wrapped);
    return () => this.emitter.off(type, wrapped);
  }

  /**
   * Subscribes a listener to all event types.
   * @param listener A callback function that will be invoked for any event.
   * @returns An unsubscribe function to remove the listener.
   */
  subscribeAll(listener: (event: SynchronikEvent) => void): () => void {
    const types: SynchronikEvent["type"][] = [
      "start",
      "complete",
      "error",
      "milestone",
    ];
    types.forEach((type) => this.emitter.on(type, listener));
    return () => types.forEach((type) => this.emitter.off(type, listener));
  }
}

/**
 * Creates a milestone emitter that is bound to a specific event bus.
 * This provides a convenient way to emit milestone events without directly accessing the bus.
 *
 * @param eventBus The `SynchronikEventBus` instance to emit events on.
 * @returns A `MilestoneEmitter` instance.
 */
export function createMilestoneEmitter(
  eventBus: SynchronikEventBus
): MilestoneEmitter {
  return {
    /**
     * Emits a generic milestone event.
     * @param milestoneId A unique identifier for the milestone.
     * @param payload Optional data to include with the event.
     */
    emit(milestoneId, payload = {}) {
      eventBus.emit({ type: "milestone", milestoneId, payload });
    },

    /**
     * Emits a milestone event specifically for a unit's lifecycle stage (e.g., 'completed', 'released').
     * @param unitId The ID of the unit.
     * @param stage The lifecycle stage (e.g., 'completed', 'released').
     * @param payload Optional data to include with the event.
     */
    emitForUnit(unitId, stage, payload = {}) {
      const milestoneId = `unit:${unitId}:${stage}`;
      eventBus.emit({ type: "milestone", milestoneId, payload });
    },
  };
}
