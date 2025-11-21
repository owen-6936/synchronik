import { describe, it, expect, vi, Mock } from "vitest";
import { Dependency, SynchronikWorker } from "../types/synchronik";
import { executeWorkersByRunMode } from "../utils/run-mode";

const createMockWorker = (
    id: string,
    dependsOn: (string | Dependency)[] = [],
    runResult: any = undefined
): SynchronikWorker => ({
    id,
    name: `Worker ${id}`,
    status: "idle",
    enabled: true,
    run: vi.fn().mockResolvedValue(runResult),
    dependsOn,
});

describe("Dependency Graph Execution", () => {
    it("should execute a simple sequential dependency chain (A -> B -> C)", async () => {
        const executionOrder: string[] = [];
        const workerA = createMockWorker("A");
        const workerB = createMockWorker("B", ["A"]);
        const workerC = createMockWorker("C", ["B"]);

        const execute = async (worker: SynchronikWorker) => {
            executionOrder.push(worker.id);
            await worker.run();
        };

        const testWorkers = [workerA, workerB, workerC];
        await executeWorkersByRunMode({
            workers: testWorkers,
            process: { runMode: "sequential", workers: testWorkers },
            execute,
        });

        expect(executionOrder).toEqual(["A", "B", "C"]);
        expect(workerA.run).toHaveBeenCalled();
        expect(workerB.run).toHaveBeenCalled();
        expect(workerC.run).toHaveBeenCalled();
    });

    it("should execute a diamond dependency graph correctly (A -> [B, C] -> D)", async () => {
        const executionOrder: string[] = [];
        const workerA = createMockWorker("A");
        const workerB = createMockWorker("B", ["A"]);
        const workerC = createMockWorker("C", ["A"]);
        const workerD = createMockWorker("D", ["B", "C"]);

        const execute = async (worker: SynchronikWorker) => {
            // Simulate some work
            await new Promise((r) => setTimeout(r, 10));
            executionOrder.push(worker.id);
            await worker.run();
        };

        const testWorkers = [workerA, workerB, workerC, workerD];
        await executeWorkersByRunMode({
            workers: testWorkers,
            process: { runMode: "parallel", workers: testWorkers },
            execute,
        });

        // A must be first
        expect(executionOrder[0]).toBe("A");
        // B and C can run in any order after A
        expect(executionOrder.slice(1, 3)).toContain("B");
        expect(executionOrder.slice(1, 3)).toContain("C");
        // D must be last
        expect(executionOrder[3]).toBe("D");
    });

    it("should throw an error if a circular dependency is detected", async () => {
        const workerA = createMockWorker("A", ["C"]);
        const workerB = createMockWorker("B", ["A"]);
        const workerC = createMockWorker("C", ["B"]);

        const execute = vi.fn();

        const testWorkers = [workerA, workerB, workerC];
        const executionPromise = executeWorkersByRunMode({
            workers: testWorkers,
            process: { runMode: "sequential", workers: testWorkers },
            execute,
        });

        await expect(executionPromise).rejects.toThrow(
            "Circular dependency detected involving worker A"
        );
        expect(execute).not.toHaveBeenCalled();
    });

    it("should not execute dependent workers if a parent worker fails", async () => {
        const workerA = createMockWorker("A");
        const workerB = createMockWorker("B", ["A"]);
        const workerC = createMockWorker("C", ["B"]);

        // Make worker B fail
        (workerB.run as Mock).mockRejectedValue(new Error("Worker B failed"));

        const execute = async (worker: SynchronikWorker) => {
            // We wrap the execution in a try-catch to allow the test to continue
            try {
                await worker.run();
            } catch {
                // Re-throw to simulate a real failure handled by executeWorkerWithRetry
                throw new Error(`Execution failed for ${worker.id}`);
            }
        };

        // We expect the overall execution to fail because of worker B
        await expect(
            executeWorkersByRunMode({
                workers: [workerA, workerB, workerC],
                process: { runMode: "sequential", workers: [workerA, workerB] },
                execute,
            })
        ).rejects.toThrow("Execution failed for B");

        // A should have run
        expect(workerA.run).toHaveBeenCalled();
        // B should have been attempted
        expect(workerB.run).toHaveBeenCalled();
        // C should NEVER have been run because its dependency failed
        expect(workerC.run).not.toHaveBeenCalled();
    });

    it("should execute workers with no dependencies immediately and in parallel", async () => {
        const workerA = createMockWorker("A");
        const workerB = createMockWorker("B");
        const workerC = createMockWorker("C", ["A", "B"]);

        const executionOrder: string[] = [];
        const execute = async (worker: SynchronikWorker) => {
            await new Promise((r) => setTimeout(r, 10));
            executionOrder.push(worker.id);
            await worker.run();
        };

        const testWorkers = [workerA, workerB, workerC];
        await executeWorkersByRunMode({
            workers: testWorkers,
            process: { runMode: "parallel", workers: testWorkers },
            execute,
        });

        // A and B should be the first two, in any order
        expect(executionOrder.slice(0, 2)).toContain("A");
        expect(executionOrder.slice(0, 2)).toContain("B");
        // C must be last
        expect(executionOrder[2]).toBe("C");
    });

    it("should handle a mix of dependent and non-dependent workers correctly", async () => {
        // D depends on nothing, should run in the first wave
        const workerA = createMockWorker("A");
        const workerB = createMockWorker("B", ["A"]);
        const workerC = createMockWorker("C", ["B"]);
        const workerD = createMockWorker("D");

        const executionOrder: string[] = [];
        const execute = async (worker: SynchronikWorker) => {
            executionOrder.push(worker.id);
            await worker.run();
        };

        const testWorkers = [workerA, workerB, workerC, workerD];
        await executeWorkersByRunMode({
            workers: testWorkers,
            process: { runMode: "parallel", workers: testWorkers },
            execute,
        });

        // A and D should be first, in any order
        expect(executionOrder.slice(0, 2)).toContain("A");
        expect(executionOrder.slice(0, 2)).toContain("D");
        // Then B
        expect(executionOrder[2]).toBe("B");
        // Finally C
        expect(executionOrder[3]).toBe("C");
    });

    it("should execute a worker when its condition is met", async () => {
        const workerA = createMockWorker("A", [], { status: "success" });
        const workerB = createMockWorker("B", [
            { id: "A", condition: (result) => result.status === "success" },
        ]);

        const execute = async (worker: SynchronikWorker) => {
            return await worker.run();
        };

        const testWorkers = [workerA, workerB];
        await executeWorkersByRunMode({
            workers: testWorkers,
            process: { runMode: "sequential", workers: testWorkers },
            execute,
        });

        expect(workerA.run).toHaveBeenCalled();
        expect(workerB.run).toHaveBeenCalled(); // Should run because condition is met
    });

    it("should SKIP a worker when its condition is NOT met", async () => {
        const workerA = createMockWorker("A", [], { status: "failure" });
        const workerB = createMockWorker("B", [
            { id: "A", condition: (result) => result.status === "success" },
        ]);

        const execute = async (worker: SynchronikWorker) => {
            return await worker.run();
        };

        const testWorkers = [workerA, workerB];
        await executeWorkersByRunMode({
            workers: testWorkers,
            process: { runMode: "sequential", workers: testWorkers },
            execute,
        });

        expect(workerA.run).toHaveBeenCalled();
        expect(workerB.run).not.toHaveBeenCalled(); // Should be skipped
    });
});
