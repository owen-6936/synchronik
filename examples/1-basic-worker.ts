import { createSynchronikManager, SynchronikWorker } from "../src/index.js";
async function runBasicWorker() {
    const manager = createSynchronikManager({ loopInterval: 20 });

    const mySimpleWorker: SynchronikWorker = {
        id: "simple-logger-worker",
        name: "Simple Logger",
        description: "A basic worker that logs a message periodically.",
        enabled: true,
        status: "idle",
        intervalMs: 2000, // Run every 2 seconds
        runOnInterval: true, // Explicitly tell the loop to run this on schedule
        maxRuns: 10,
        run: async () => {
            console.log(
                `Worker 'simple-logger-worker' is running at ${new Date().toLocaleTimeString()}`
            );
        },
    };

    manager.registerUnit(mySimpleWorker);
    manager.start(); // Start the engine's main loop

    console.log(
        "Synchronik engine started. Manually triggering the process now..."
    );
}
runBasicWorker();
