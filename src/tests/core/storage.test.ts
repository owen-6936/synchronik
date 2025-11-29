import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { FileStorageAdapter } from "../../core/FileStorageAdapter";
import { createSynchronikManager } from "../../core/manager";
import type { SynchronikWorker, SynchronikUnit } from "../../types/synchronik";

const TEST_STATE_FILE = "test-synchronik-state.json";

const mockWorker = (id: string): SynchronikWorker => ({
    id,
    status: "idle",
    run: vi.fn().mockResolvedValue(undefined),
    name: "Mock Worker",
    enabled: true,
});

describe("FileStorageAdapter", () => {
    const testFilePath = path.resolve(process.cwd(), TEST_STATE_FILE);

    beforeEach(async () => {
        // Ensure the test file doesn't exist before each test
        try {
            await fs.unlink(testFilePath);
        } catch (error: any) {
            if (error.code !== "ENOENT") throw error;
        }
    });

    afterEach(async () => {
        // Clean up the test file after each test
        try {
            await fs.unlink(testFilePath);
        } catch (error: any) {
            if (error.code !== "ENOENT") throw error;
        }
    });

    it("should save state to a file, omitting the run function", async () => {
        const adapter = new FileStorageAdapter(TEST_STATE_FILE);
        const worker = mockWorker("w1");
        worker.meta = { runCount: 5 };

        await adapter.saveState([worker]);

        const fileContent = await fs.readFile(testFilePath, "utf-8");
        const savedData = JSON.parse(fileContent);

        expect(savedData).toHaveLength(1);
        expect(savedData[0].id).toBe("w1");
        expect(savedData[0].meta.runCount).toBe(5);
        expect(savedData[0].run).toBeUndefined(); // Crucially, the function is not serialized
    });

    it("should load state from a file", async () => {
        const adapter = new FileStorageAdapter(TEST_STATE_FILE);
        const workerData = {
            id: "w2",
            status: "completed",
            name: "Loaded Worker",
            enabled: true,
        };

        await fs.writeFile(testFilePath, JSON.stringify([workerData], null, 2));

        const loadedState = await adapter.loadState();
        expect(loadedState).not.toBeNull();
        expect(loadedState).toHaveLength(1);
        expect(loadedState![0].id).toBe("w2");
        expect(loadedState![0].status).toBe("completed");
    });

    it("should return null when loading state and the file does not exist", async () => {
        const adapter = new FileStorageAdapter(TEST_STATE_FILE);
        const loadedState = await adapter.loadState();
        expect(loadedState).toBeNull();
    });
});

describe("Manager with FileStorageAdapter Integration", () => {
    const testFilePath = path.resolve(process.cwd(), TEST_STATE_FILE);

    afterEach(async () => {
        // Clean up the test file
        try {
            await fs.unlink(testFilePath);
        } catch (error: any) {
            if (error.code !== "ENOENT") throw error;
        }
    });

    it("should save state to disk when a unit is updated", async () => {
        const manager = createSynchronikManager();
        const adapter = new FileStorageAdapter(TEST_STATE_FILE);
        await manager.useStorage(adapter);

        const worker = mockWorker("w3");
        manager.registerUnit(worker);

        await manager.updateStatus("w3", "running");

        const fileContent = await fs.readFile(testFilePath, "utf-8");
        const savedData = JSON.parse(fileContent);

        expect(savedData[0].id).toBe("w3");
        expect(savedData[0].status).toBe("running");
    });

    it("should hydrate from an existing state file upon initialization", async () => {
        // 1. Prepare a pre-existing state file
        const persistedState: Partial<SynchronikUnit>[] = [
            {
                id: "hydrated-worker",
                status: "completed",
                meta: { runCount: 10 },
            },
        ];
        await fs.writeFile(testFilePath, JSON.stringify(persistedState));

        // 2. Create a new manager that will use this file
        const manager = createSynchronikManager();
        const adapter = new FileStorageAdapter(TEST_STATE_FILE);

        // 3. Register the worker definition (to provide the `run` function)
        const worker = mockWorker("hydrated-worker");
        manager.registerUnit(worker);

        // 4. Initialize storage, which should trigger hydration
        await manager.useStorage(adapter);

        // 5. Assert that the manager's state was updated from the file
        const hydratedWorker = manager.getUnitById("hydrated-worker");
        expect(hydratedWorker?.status).toBe("completed");
        expect(hydratedWorker?.meta?.runCount).toBe(10);
    });
});

describe("FileStorageAdapter - Edge Cases", () => {
    const testFilePath = path.resolve(process.cwd(), TEST_STATE_FILE);

    afterEach(async () => {
        // Clean up mocks and files
        vi.restoreAllMocks();
        try {
            await fs.unlink(testFilePath);
        } catch (error: any) {
            if (error.code !== "ENOENT") throw error;
        }
    });

    it("should not crash the manager if saving state fails", async () => {
        const manager = createSynchronikManager();
        const adapter = new FileStorageAdapter(TEST_STATE_FILE);
        await manager.useStorage(adapter);

        // Mock fs.writeFile to simulate a disk full or permissions error
        const writeFileSpy = vi
            .spyOn(fs, "writeFile")
            .mockRejectedValue(new Error("EACCES: permission denied"));

        const worker = mockWorker("w-fail-save");
        manager.registerUnit(worker);

        // This call would crash if not handled. We expect it to not throw.
        await expect(
            manager.updateStatus("w-fail-save", "running")
        ).resolves.toBeUndefined();

        // The in-memory state should still be updated
        expect(manager.getUnitStatus("w-fail-save")).toBe("running");
        expect(writeFileSpy).toHaveBeenCalled();
    });

    it("should start with a fresh state if the state file is corrupted", async () => {
        // 1. Create a corrupted state file with invalid JSON
        await fs.writeFile(testFilePath, "{ not: json }");

        const manager = createSynchronikManager();
        const adapter = new FileStorageAdapter(TEST_STATE_FILE);

        // We expect useStorage to handle the JSON.parse error and not throw,
        // allowing the application to start with a clean slate.
        await expect(manager.useStorage(adapter)).resolves.toBeUndefined();
        expect(manager.listUnits()).toHaveLength(0); // Verifies it started fresh
    });
});
