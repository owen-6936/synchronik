import {
    beforeEach,
    describe,
    expect,
    it,
    Mock,
    vitest,
    afterEach,
} from "vitest";
import { ReactiveRegistry } from "../../core/ReactiveRegistry";
import {
    SynchronikUnit,
    SynchronikWorker,
    SynchronikProcess,
    Status,
} from "../../types/synchronik";

describe("ReactiveRegistry", () => {
    let registry: ReactiveRegistry;
    let mockMilestoneEmitter: { emit: Mock; emitForUnit: Mock };
    let mockEventBus: { emit: Mock; subscribe: Mock; subscribeAll: Mock };

    beforeEach(() => {
        mockMilestoneEmitter = {
            emit: vitest.fn(),
            emitForUnit: vitest.fn(),
        };
        mockEventBus = {
            emit: vitest.fn(),
            subscribe: vitest.fn(),
            subscribeAll: vitest.fn(),
        };
        registry = new ReactiveRegistry(mockMilestoneEmitter, mockEventBus);
    });

    it("should set the status of a unit", () => {
        const unitId = "worker1";
        const unit: SynchronikWorker = {
            id: unitId,
            name: "Worker 1",
            enabled: true,
            status: "idle",
            run: async () => {},
        };

        registry.registerUnit(unit);
        registry.updateUnitState(unitId, { status: "running" });

        expect(registry.getUnitById(unitId)?.status).toBe("running");
    });

    it("should not set the status if the unit does not exist", () => {
        const unitId = "nonExistentWorker";

        // This should not throw an error and simply do nothing.
        expect(() =>
            registry.updateUnitState(unitId, { status: "running" })
        ).not.toThrow();
    });

    it("should update the process status when a worker's status changes", () => {
        const workerId = "worker1";
        const processId = "process1";
        const newStatus: Status = "completed";

        const worker: SynchronikWorker = {
            id: workerId,
            name: "Worker 1",
            enabled: true,
            processId: processId,
            run: vitest.fn(),
            status: "idle",
        };
        const process: SynchronikProcess = {
            id: processId,
            name: "Process 1",
            enabled: true,
            status: "idle",
            workers: [worker],
            runAll: vitest.fn(),
        };

        registry.registerUnit(process); // Registering process also registers worker

        // Update worker status
        registry.updateUnitState(workerId, { status: newStatus });

        // Expect worker status to be updated
        expect(registry.getWorkerById(workerId)?.status).toBe(newStatus);
        // Expect process status to be updated due to reactive logic
        expect(registry.getProcessById(processId)?.status).toBe("completed");
    });

    it("should calculate process status correctly based on worker statuses", () => {
        const processId = "process1";
        const worker1: SynchronikWorker = {
            id: "worker1",
            name: "Worker 1",
            enabled: true,
            processId: processId,
            run: vitest.fn(),
            status: "completed",
        };
        const worker2: SynchronikWorker = {
            id: "worker2",
            name: "Worker 2",
            enabled: true,
            processId: processId,
            run: vitest.fn(),
            status: "running",
        };
        const worker3: SynchronikWorker = {
            id: "worker3",
            name: "Worker 3",
            enabled: true,
            processId: processId,
            run: vitest.fn(),
            status: "error",
        };

        const process: SynchronikProcess = {
            id: processId,
            name: "Process 1",
            enabled: true,
            workers: [worker1, worker2, worker3],
            runAll: vitest.fn(),
            status: "idle",
        };

        registry.registerUnit(process); // Registering process also registers workers
        // Manually set initial statuses for workers within the registry's internal state
        registry.updateUnitState(worker1.id, { status: "completed" });
        registry.updateUnitState(worker2.id, { status: "running" });
        registry.updateUnitState(worker3.id, { status: "error" });

        // Trigger a status update. Because worker3 is in 'error' state, the process should become 'error'.
        // We don't need to call setStatus for worker1 here, as the initial state already has an error worker.
        // The process status should already be 'error' after initial registration and worker status setup.
        expect(registry.getProcessById(processId)?.status).toBe("error");

        // Process status should be 'error' if any worker has an error
        // This assertion is now redundant as the previous one covers it.

        // Fix the error and set another worker to 'running'
        // The process should now become 'running'.
        registry.updateUnitState(worker3.id, { status: "completed" }); // Fix error
        registry.updateUnitState(worker2.id, { status: "running" }); // Keep running

        // Process status should be 'running' if any worker is running
        expect(registry.getProcessById(processId)?.status).toBe("running");

        // Complete the last running worker.
        // The process should now be 'completed'.
        registry.updateUnitState(worker2.id, { status: "completed" });

        // Process status should be 'completed' if all workers are completed
        expect(registry.getProcessById(processId)?.status).toBe("completed");

        // Reset some workers to idle.
        // The process should now be 'idle' as none are running/error and not all are complete.
        registry.updateUnitState(worker1.id, { status: "idle" });
        registry.updateUnitState(worker3.id, { status: "idle" });
        // Worker2 is still completed, so the process should not be idle yet.
        // Let's make worker2 idle as well to test the idle state.
        registry.updateUnitState(worker2.id, { status: "idle" });

        expect(registry.getProcessById(processId)?.status).toBe("idle");
    });
});

describe("ReactiveRegistry - Performance Metrics", () => {
    let registry: ReactiveRegistry;
    let mockMilestoneEmitter: { emit: Mock; emitForUnit: Mock };
    let mockEventBus: { emit: Mock; subscribe: Mock; subscribeAll: Mock };

    beforeEach(() => {
        mockMilestoneEmitter = {
            emit: vitest.fn(),
            emitForUnit: vitest.fn(),
        };
        mockEventBus = {
            emit: vitest.fn(),
            subscribe: vitest.fn(),
            subscribeAll: vitest.fn(),
        };
        registry = new ReactiveRegistry(mockMilestoneEmitter, mockEventBus);

        // Use fake timers to control time during tests
        vitest.useFakeTimers();
    });

    afterEach(() => {
        // Restore real timers after each test
        vitest.useRealTimers();
    });

    it("should calculate and log execution speed and average on worker completion", () => {
        const workerId = "perf-worker";
        const worker: SynchronikWorker = {
            id: workerId,
            status: "idle",
            name: "Performance Worker",
            enabled: true,
            run: async () => {},
        };

        registry.registerUnit(worker);

        // --- First Run (100ms) ---
        registry.updateUnitState(workerId, { status: "running" });
        vitest.advanceTimersByTime(100);
        registry.updateUnitState(workerId, { status: "completed" });

        let updatedWorker = registry.getWorkerById(workerId)!;
        console.log("After first run (100ms), meta:", updatedWorker.meta);

        expect(updatedWorker.meta?.executionTimesMs).toEqual([100]);
        expect(updatedWorker.meta?.averageExecutionTimeMs).toBe(100);

        // --- Second Run (200ms) ---
        registry.updateUnitState(workerId, { status: "running" });
        vitest.advanceTimersByTime(200);
        registry.updateUnitState(workerId, { status: "completed" });

        updatedWorker = registry.getWorkerById(workerId)!;
        console.log("After second run (200ms), meta:", updatedWorker.meta);

        expect(updatedWorker.meta?.executionTimesMs).toEqual([100, 200]);
        expect(updatedWorker.meta?.averageExecutionTimeMs).toBe(150); // (100 + 200) / 2

        expect(mockMilestoneEmitter.emitForUnit).toHaveBeenCalledWith(
            workerId,
            "completed",
            expect.objectContaining({
                previous: "running",
                current: "completed",
                durationMs: 200,
            })
        );
    });
});
