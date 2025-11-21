import { createSynchronikManager } from "../src/core/manager.js";
import type {
    SynchronikWorker,
    SynchronikProcess,
    Dependency,
} from "../src/types/synchronik.js";

// --- 1. Define the Workers ---

// We'll add a delay to each worker to simulate real work and make the execution order obvious.
const createDelayedWorker = (
    id: string,
    dependsOn: (string | Dependency)[] = [],
    delayMs = 50,
    // Allow a custom run function to return a result
    customRun?: () => Promise<any>
): SynchronikWorker => ({
    id,
    name: `Worker ${id}`,
    status: "idle",
    enabled: true,
    run:
        customRun ||
        (async () => {
            console.log(`[START]  🚀 ${id}`);
            await new Promise((r) => setTimeout(r, delayMs));
            console.log(`[FINISH] ✅ ${id}`);
        }),
    dependsOn,
});

// A -> B -> C (A simple chain representing a file processing pipeline)
const workerA_download = createDelayedWorker("A-Download-File");
const workerB_unzip = createDelayedWorker("B-Unzip-File", ["A-Download-File"]);
const workerC_process = createDelayedWorker(
    "C-Process-Content (FFmpeg)",
    ["B-Unzip-File"],
    100,
    async () => {
        console.log("[START]  🚀 C-Process-Content (FFmpeg)");
        await new Promise((r) => setTimeout(r, 100));
        // Simulate a result, e.g., the duration of the processed video
        const duration = 125; // seconds
        console.log(
            `[FINISH] ✅ C-Process-Content (FFmpeg) - Result: { duration: ${duration} }`
        );
        return { duration };
    }
);

// D is an independent worker that can run in parallel with the start of the chain
const workerD_log_stats = createDelayedWorker("D-Log-Stats");

// --- Conditional Workers ---
// E will only run if the video is short
const workerE_fast_cleanup = createDelayedWorker("E-Fast-Cleanup", [
    {
        id: "C-Process-Content (FFmpeg)",
        condition: (result) => result.duration < 60,
    },
]);

// F will only run if the video is long
const workerF_thorough_cleanup = createDelayedWorker("F-Thorough-Cleanup", [
    {
        id: "C-Process-Content (FFmpeg)",
        condition: (result) => result.duration >= 60,
    },
]);

// --- 2. Define the Process ---

const fileProcessingWorkflow: SynchronikProcess = {
    id: "proc-ffmpeg-pipeline",
    name: "FFmpeg File Processing Pipeline",
    status: "idle",
    enabled: true,
    // The workers can be in any order here; the `dependsOn` property will determine the execution plan.
    workers: [
        workerC_process,
        workerA_download,
        workerB_unzip,
        workerD_log_stats,
        workerE_fast_cleanup,
        workerF_thorough_cleanup,
    ],
};

// --- 3. Run the Scenario ---

async function runDependencyExample() {
    console.log(
        ">>> Initializing Synchronik Manager and registering workflow..."
    );

    // Create the manager instance
    const manager = createSynchronikManager();

    // Register the entire process. The manager will handle registering the individual workers.
    manager.registerUnit(fileProcessingWorkflow);

    console.log(
        "\n>>> Starting the process. Observe the execution order based on dependencies."
    );
    console.log(
        "--------------------------------------------------------------------------"
    );

    // Run the process by its ID
    await manager.runProcessById(fileProcessingWorkflow.id);

    console.log(
        "--------------------------------------------------------------------------"
    );
    console.log(
        ">>> Workflow complete. Note that only 'F-Thorough-Cleanup' ran because the condition was met."
    );
}

// Execute the example
runDependencyExample();
