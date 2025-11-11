import {
    createSynchronikManager,
    SynchronikProcess,
    SynchronikWorker,
} from "../src/index.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const manager = createSynchronikManager();

    const filesToProcess = [
        "data-01.csv",
        "data-02.csv",
        "config.json", // This one will fail validation
        "data-03.csv",
        "data-04.csv",
    ];

    // --- Stage 1: Validation (Parallel) ---
    // Fast, independent checks that can run all at once.
    const validationWorkers: SynchronikWorker[] = filesToProcess.map(
        (file) => ({
            id: `validate-${file}`,
            name: `Validate ${file}`,
            enabled: true,
            run: async () => {
                console.log(`[VALIDATE] Checking ${file}...`);
                await wait(50 + Math.random() * 50);
                if (!file.endsWith(".csv")) {
                    throw new Error(`Invalid file type: ${file}`);
                }
                console.log(`[VALIDATE] ✅ ${file} is valid.`);
            },
        })
    );

    const validationProcess: SynchronikProcess = {
        id: "validation-process",
        name: "File Validation Stage",
        runMode: "parallel",
        enabled: false,
        workers: validationWorkers,
        onComplete: () => {
            console.log(
                "\n--- Validation Complete. Starting Transformation Stage. ---\n"
            );
            // Trigger the next stage of the pipeline
            manager.runProcessById("transformation-process");
        },
    };

    // --- Stage 2: Transformation (Batched) ---
    // A CPU-intensive task. We run them in batches to avoid overwhelming the system.
    const transformationWorkers: SynchronikWorker[] = filesToProcess
        .filter((file) => file.endsWith(".csv")) // Only process valid files
        .map((file) => ({
            id: `transform-${file}`,
            name: `Transform ${file}`,
            enabled: true,
            run: async () => {
                console.log(`[TRANSFORM] Processing ${file}...`);
                await wait(300 + Math.random() * 200); // Simulate heavy work
                console.log(`[TRANSFORM] ✅ ${file} transformed.`);
            },
        }));

    const transformationProcess: SynchronikProcess = {
        id: "transformation-process",
        name: "File Transformation Stage",
        runMode: "batched",
        enabled: false,
        batchSize: 2, // Process 2 files at a time
        workers: transformationWorkers,
        onComplete: () => {
            console.log(
                "\n--- Transformation Complete. Starting Upload Stage. ---\n"
            );
            // Trigger the final stage
            manager.runProcessById("upload-process");
        },
    };

    // --- Stage 3: Upload (Sequential) ---
    // Uploads must happen in a specific order.
    const uploadWorkers: SynchronikWorker[] = filesToProcess
        .filter((file) => file.endsWith(".csv")) // Only upload transformed files
        .map((file) => ({
            id: `upload-${file}`,
            name: `Upload ${file}`,
            enabled: true,
            run: async () => {
                console.log(`[UPLOAD] Uploading ${file} to server...`);
                await wait(150);
                console.log(`[UPLOAD] ✅ ${file} uploaded.`);
            },
        }));

    const uploadProcess: SynchronikProcess = {
        id: "upload-process",
        name: "File Upload Stage",
        runMode: "sequential",
        enabled: false,
        workers: uploadWorkers,
        onComplete: () => {
            console.log("\n--- Pipeline Complete! ---");
        },
    };

    // --- Registration and Execution ---
    manager.registerUnit(validationProcess);
    manager.registerUnit(transformationProcess);
    manager.registerUnit(uploadProcess);

    manager.subscribeToEvents((event) => {
        if (event.type === "error") {
            console.error(
                `[ERROR] Unit '${event.unitId}' failed: ${event.error.message}`
            );
        }
    });

    console.log("--- Starting Multi-Stage File Processing Pipeline ---");
    // Manually start only the first stage. The rest are chained via `onComplete`.
    await manager.runProcessById("validation-process");
}

main();
