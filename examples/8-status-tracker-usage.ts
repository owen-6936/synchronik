import {
    SynchronikProcess,
    SynchronikWorker,
} from "../src/types/synchronik.js";
import { ReactiveRegistry } from "../src/core/ReactiveRegistry.js";

const compileWorker: SynchronikWorker = {
    id: "worker-compile",
    name: "Compile Code",
    enabled: true,
    processId: "proc-build",
    status: "idle",
    run: async () => console.log("Compiling..."),
};

const testWorker: SynchronikWorker = {
    id: "worker-test",
    name: "Run Tests",
    enabled: true,
    processId: "proc-build",
    status: "idle",
    run: async () => console.log("Testing..."),
};

const buildProcess: SynchronikProcess = {
    id: "proc-build",
    name: "Build Process",
    enabled: true,
    status: "idle",
    workers: [compileWorker, testWorker],
};

/**
 * Main simulation function
 */
function runScenario() {
    // Mock MilestoneEmitter and EventBus for demonstration purposes
    const mockMilestoneEmitter = {
        emit: (milestoneId: string, payload?: Record<string, unknown>) => {
            console.log(
                `[Milestone Emitted] ID: ${milestoneId}, Payload: ${JSON.stringify(
                    payload
                )}`
            );
        },
        emitForUnit: (
            unitId: string,
            stage: string,
            payload?: Record<string, unknown>
        ) => {
            console.log(
                `[Milestone For Unit] Unit: ${unitId}, Stage: ${stage}, Payload: ${JSON.stringify(
                    payload
                )}`
            );
        },
    };

    const mockEventBus = {
        emit: (event: any) => {
            console.log(
                `[Event Emitted] Type: ${event.type}, Unit: ${event.unitId}, Error: ${event.error?.message}`
            );
        },
        subscribe: () => () => {}, // No-op unsubscribe
        subscribeAll: () => () => {}, // No-op unsubscribe
    };

    // 1. Set up the reactive registry
    const registry = new ReactiveRegistry(mockMilestoneEmitter, mockEventBus);

    // 2. Register the process (which also registers its workers)
    registry.registerUnit(buildProcess);

    const logStatuses = () => {
        console.log("\n--- CURRENT STATUSES ---");
        console.log(`> Process "${buildProcess.name}": ${buildProcess.status}`);
        console.log(
            `  - Worker "${compileWorker.name}": ${compileWorker.status}`
        );
        console.log(`  - Worker "${testWorker.name}": ${testWorker.status}`);
        console.log("------------------------\n");
    };

    console.log(">>> SCENARIO START <<<");
    logStatuses();

    console.log(">>> ACTION: Starting 'Compile Code' worker...");
    registry.updateUnitState(compileWorker.id, { status: "running" });
    logStatuses();

    console.log(">>> ACTION: Starting 'Run Tests' worker...");
    registry.updateUnitState(testWorker.id, { status: "running" });
    logStatuses();

    console.log(">>> ACTION: 'Compile Code' worker has completed...");
    registry.updateUnitState(compileWorker.id, { status: "completed" });
    logStatuses();

    console.log(">>> ACTION: 'Run Tests' worker has completed...");
    registry.updateUnitState(testWorker.id, { status: "completed" });
    logStatuses();

    console.log(">>> SCENARIO END <<<");
}

// Run the simulation
runScenario();
