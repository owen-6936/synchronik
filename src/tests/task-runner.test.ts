import { describe, it, expect, vi } from "vitest";
import { runWorkerTasks } from "../../src/utils/task-runner";

describe("runWorkerTasks utility", () => {
    it("processes a list of items with retries and reports detailed results", async () => {
        // 1. Define a list of items to process
        const itemsToProcess = [
            "item-success",
            "item-retry-success",
            "item-fail-all",
            "item-another-success",
        ];

        // 2. Create a mock execute function to simulate different outcomes
        const executeFn = vi.fn(async (item: string) => {
            await new Promise((r) => setTimeout(r, 10)); // Simulate async work

            if (item === "item-retry-success") {
                // Fail on the first attempt, then succeed
                if (
                    executeFn.mock.calls.filter((c) => c[0] === item).length <=
                    1
                ) {
                    throw new Error("Temporary network error");
                }
            }

            if (item === "item-fail-all") {
                throw new Error("Invalid item ID");
            }

            return { id: item, status: "processed" };
        });

        // 3. Run the tasks using the containerizer
        const startTime = Date.now();
        const results = await runWorkerTasks({
            items: itemsToProcess,
            execute: executeFn,
            maxRetries: 2, // Retry each failed task up to 2 times
            retryDelayMs: (attempt) => Math.pow(2, attempt - 1) * 20, // 20ms, 40ms
        });
        const duration = Date.now() - startTime;

        // --- Assertions ---

        // 4. Verify the summary report
        expect(results.totalTasks).toBe(4);
        expect(results.successPercentage).toBe(75);

        // 5. Verify the successful tasks
        expect(results.successful).toHaveLength(3);
        expect(results.successful.map((s) => s.id)).toEqual([
            "item-success",
            "item-retry-success",
            "item-another-success",
        ]);
        expect(results.successful[1].result).toEqual({
            id: "item-retry-success",
            status: "processed",
        });

        // 6. Verify the failed tasks
        expect(results.failed).toHaveLength(1);
        expect(results.failed[0].id).toBe("item-fail-all");
        expect(results.failed[0].error).toBe("Invalid item ID");

        // 7. Verify the number of calls for each task
        const calls = executeFn.mock.calls.map((c) => c[0]);
        expect(calls.filter((c) => c === "item-success").length).toBe(1);
        expect(calls.filter((c) => c === "item-retry-success").length).toBe(2); // 1 fail + 1 success
        expect(calls.filter((c) => c === "item-fail-all").length).toBe(3); // 1 initial + 2 retries
        expect(calls.filter((c) => c === "item-another-success").length).toBe(
            1
        );

        // 8. Verify the timing to confirm backoff was applied
        // Delays:
        // - item-retry-success: 1 retry, delay = 20ms
        // - item-fail-all: 2 retries, delays = 20ms + 40ms = 60ms
        // Total expected delay = 80ms
        const expectedMinDuration = 20 + (20 + 40);
        expect(duration).toBeGreaterThanOrEqual(expectedMinDuration);
    });
});
