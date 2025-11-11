import {
    createSynchronikManager,
    type SynchronikProcess,
    type SynchronikWorker,
    runWorkerTasks,
    SynchronikEvent,
} from "../src/index.js";

async function main() {
    // 1. Create the manager
    const manager = createSynchronikManager();

    // 2. Define a worker that uses the task runner
    const dataIngestionWorker: SynchronikWorker = {
        id: "data-ingestion-worker",
        name: "Data Ingestion Worker",
        enabled: true,
        maxRetries: 1, // Retries for catastrophic worker failures

        // This hook is for critical, unrecoverable worker failures.
        onError: (error) => {
            console.error(
                `CRITICAL: Worker '${dataIngestionWorker.id}' failed permanently.`,
                error
            );
        },

        run: async () => {
            console.log(
                "Worker [data-ingestion-worker]: Starting batch of internal tasks..."
            );

            const movieIdsToFetch = [
                "tt1375666",
                "tt0133093",
                "tt0068646",
                "tt9999999",
            ]; // The last one will fail.

            // Use `runWorkerTasks` to process the list with fault tolerance.
            const results = await runWorkerTasks({
                items: movieIdsToFetch,
                execute: async (id) => {
                    await new Promise((r) =>
                        setTimeout(r, 500 + Math.random() * 500)
                    );
                    if (id === "tt9999999")
                        throw new Error(`Movie ID ${id} not found (404)`);
                    return { movieId: id, title: `Movie Title for ${id}` };
                },
                maxRetries: 2, // Retry each failed movie fetch up to 2 times
                retryDelayMs: (attempt) => Math.pow(2, attempt) * 50, // Exponential backoff
            });

            // The worker's job is done. It emits a detailed milestone with the results.
            manager.emitMilestone(
                "ingestion-complete",
                results as Record<string, any>
            );
            console.log(
                `Worker [data-ingestion-worker]: Finished with ${results.successPercentage.toFixed(2)}% success.`
            );
        },
    };

    // 3. Define a process to run the worker
    const dataIngestionProcess: SynchronikProcess = {
        id: "data-ingestion-process",
        name: "Nightly Data Ingestion",
        enabled: true,
        runMode: "parallel",
        workers: [dataIngestionWorker],
    };

    // 4. Register and run
    manager.registerUnit(dataIngestionProcess);

    manager.subscribeToEvents((event: SynchronikEvent) => {
        if (
            event.type === "milestone" &&
            event.milestoneId === "ingestion-complete"
        ) {
            console.log("--- Ingestion Worker Results ---");
            console.log(
                `Success Rate: ${event?.payload && event.payload?.successPercentage}%`
            );
            console.log(
                "Failed Tasks:",
                (event as Record<string, any>).payload.failed
            );
            return;
        }
        console.log(
            `EVENT: Unit '${event.type === "milestone" ? event.milestoneId : event.unitId}' changed status to -> ${event.type}`
        );
    });

    console.log("--- Starting Data Ingestion Process ---");
    await manager.runProcessById("data-ingestion-process");
    console.log("--- Process Complete ---");
}

main();
