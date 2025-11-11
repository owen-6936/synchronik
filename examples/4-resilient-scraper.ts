import {
    createSynchronikManager,
    SynchronikProcess,
    SynchronikWorker,
    runWorkerTasks,
} from "../src/index.js";

// A map to track the attempt count for each URL to ensure retries succeed.
const fetchAttempts = new Map<string, number>();

/**
 * A mock fetch function to simulate API calls.
 * It will randomly fail for certain "flaky" URLs and always fail for a "broken" one.
 */
async function mockFetch(
    url: string
): Promise<{ url: string; content: string }> {
    const attempt = (fetchAttempts.get(url) || 0) + 1;
    fetchAttempts.set(url, attempt);

    console.log(`  -> Fetching ${url}...`);
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

    if (url.includes("broken")) {
        throw new Error("404 Not Found");
    }

    // For "flaky" URLs, fail on the first attempt but succeed on subsequent ones.
    if (url.includes("flaky") && attempt === 1) {
        throw new Error("503 Service Unavailable");
    }

    return { url, content: `<html>Content for ${url}</html>` };
}

async function main() {
    const manager = createSynchronikManager();

    // A list of 20 URLs to scrape, including some problematic ones.
    const urlsToScrape = [
        ...Array.from(
            { length: 8 },
            (_, i) => `https://example.com/product/${i + 1}`
        ),
        "https://example.com/product/flaky-9",
        "https://example.com/product/10",
        "https://example.com/product/flaky-11",
        "https://example.com/product/12",
        "https://example.com/product/broken-13", // This one will always fail
        ...Array.from(
            { length: 7 },
            (_, i) => `https://example.com/product/${i + 14}`
        ),
    ];

    const scraperWorker: SynchronikWorker = {
        id: "resilient-scraper-worker",
        name: "Resilient API Scraper",
        enabled: true,
        run: async () => {
            console.log(
                `[Scraper Worker] Starting to scrape ${urlsToScrape.length} URLs.`
            );

            const results = await runWorkerTasks({
                items: urlsToScrape,
                execute: mockFetch,
                maxRetries: 2, // Retry flaky URLs up to 2 times
                retryDelayMs: (attempt) => Math.pow(2, attempt) * 100, // 200ms, 400ms
                onProgress: (progress) => {
                    // Emit a milestone every 25% to report progress
                    if (progress.percentage % 25 < 5) {
                        manager.emitMilestone("scraper-progress", {
                            progress: `${progress.percentage.toFixed(0)}%`,
                            completed: progress.completed,
                        });
                    }
                },
            });

            console.log(`[Scraper Worker] Scraping complete.`);
            manager.emitMilestone(
                "scraper-finished",
                results as Record<string, any>
            );
        },
    };

    const scrapingProcess: SynchronikProcess = {
        id: "scraping-process",
        name: "URL Scraping Process",
        enabled: true,
        workers: [scraperWorker],
    };

    manager.registerUnit(scrapingProcess);

    // Subscribe to milestones to see the progress and final report
    manager.onMilestone((id, payload: Record<string, any> | undefined) => {
        if (id === "scraper-progress") {
            console.log(
                `[MILESTONE] Progress: ${payload?.progress} (${payload?.completed} URLs done)`
            );
        }
        if (id === "scraper-finished") {
            console.log("\n--- Scraping Report ---");
            console.log(
                `✅ Success Rate: ${payload?.successPercentage.toFixed(2)}%`
            );
            console.log(`👍 Successful: ${payload?.successful.length}`);
            console.log(`👎 Failed: ${payload?.failed.length}`);
            if (payload?.failed.length > 0) {
                console.log(
                    "Failed URLs:",
                    payload?.failed.map((f: any) => f.id)
                );
            }
            console.log("-----------------------\n");
        }
    });

    console.log("--- Starting Resilient Scraping Process ---");
    await manager.runProcessById("scraping-process");
    console.log("--- Scraping Process Complete ---");
}

main();
