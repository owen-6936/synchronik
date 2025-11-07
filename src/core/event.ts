import { EventEmitter } from "stream";
import type { MilestoneEmitter, SynchronikEvent } from "../types/synchronik.js";

/**
 * A central event bus for the Synchronik engine, built on Node.js's EventEmitter.
 * It handles the emission and subscription of core lifecycle events.
 */
export class SynchronikEventBus {
  private emitter = new EventEmitter();

  emit(event: SynchronikEvent) {
    this.emitter.emit(event.type, event);
  }

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

export function createMilestoneEmitter(
  eventBus: SynchronikEventBus
): MilestoneEmitter {
  return {
    emit(milestoneId, payload = {}) {
      eventBus.emit({ type: "milestone", milestoneId, payload });
    },

    emitForUnit(unitId, stage, payload = {}) {
      const milestoneId = `unit:${unitId}:${stage}`;
      eventBus.emit({ type: "milestone", milestoneId, payload });
    },
  };
}
