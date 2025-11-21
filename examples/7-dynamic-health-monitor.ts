import {
    createSynchronikManager,
    SynchronikProcess,
    SynchronikWorker,
} from "../src/index.js";

/**
 * A mock function to simulate checking the health of a service.
 * It will randomly fail to simulate a service being down.
 */
async function checkServiceHealth(serviceName: string): Promise<void> {
    console.log(`  -> [Pool Worker] Checking ${serviceName}...`);
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));

    // Simulate a service being down with a 20% probability
    if (Math.random() < 0.2) {
        throw new Error(`${serviceName} is down!`);
    }
}

async function main() {
    const manager = createSynchronikManager();

    // 1. Initialize the Worker Pool with 3 concurrent workers.
    const workerManager = manager.useWorkerPool(3);

    const servicesToMonitor = ["Database", "API", "Search", "Cache", "Auth"];

    // 2. Create a single "Scheduler" worker.
    // Its only job is to add tasks to the worker pool's queue every 15 seconds.
    const healthSchedulerWorker: SynchronikWorker = {
        id: "health-scheduler",
        name: "Health Check Scheduler",
        enabled: true,
        status: "idle",
        runOnInterval: true,
        intervalMs: 15000, // Run every 15 seconds
        run: async () => {
            console.log(
                `[SCHEDULER] Queuing health checks for ${servicesToMonitor.length} services...`
            );

            for (const serviceName of servicesToMonitor) {
                // 3. Add a new task for each service to the queue.
                // The name includes a timestamp to ensure it's unique for each run.
                workerManager.addTask({
                    name: `check-${serviceName}-${Date.now()}`,
                    execute: async () => {
                        try {
                            await checkServiceHealth(serviceName);
                            // If successful, we could emit a SERVICE_OK milestone.
                        } catch (error) {
                            // If the health check fails, emit a milestone.
                            manager.emitMilestone("SERVICE_DOWN", {
                                serviceName,
                                error: (error as Error).message,
                            });
                        }
                    },
                });
            }
        },
    };

    // 4. Register the scheduler worker within a process.
    const schedulerProcess: SynchronikProcess = {
        id: "scheduler-process",
        name: "Scheduler Process",
        workers: [healthSchedulerWorker],
        status: "idle",
        enabled: true,
    };

    manager.registerUnit(schedulerProcess);

    // 5. Listen for the milestone emitted by the tasks.
    manager.onMilestone((id, payload) => {
        if (id === "SERVICE_DOWN") {
            console.warn(
                `[ALERT] Service '${payload?.serviceName}' is down: ${payload?.error}`
            );
        }
    });

    // 6. Start the manager. This will also start the worker pool's internal loop.
    manager.start();
    console.log("--- Starting Dynamic Health Monitor with Worker Pool ---");
    console.log("Scheduler will queue tasks every 15 seconds.");
}

main();
