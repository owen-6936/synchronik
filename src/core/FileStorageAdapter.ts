import { promises as fs } from "fs";
import path from "path";
import type { StorageAdapter, SynchronikUnit } from "../types/synchronik.js";

/**
 * A storage adapter that persists the engine's state to a local JSON file.
 */
export class FileStorageAdapter implements StorageAdapter {
    private filePath: string;

    /**
     * Creates an instance of FileStorageAdapter.
     * @param filePath The path to the state file. Defaults to 'synchronik-state.json' in the current working directory.
     */
    constructor(filePath = "synchronik-state.json") {
        this.filePath = path.resolve(process.cwd(), filePath);
    }

    async saveState(units: SynchronikUnit[]): Promise<void> {
        // We need to remove the 'run' function before serialization
        const serializableUnits = units.map((unit) => {
            const { run, ...rest } = unit as any;
            return rest;
        });
        const data = JSON.stringify(serializableUnits, null, 2);
        await fs.writeFile(this.filePath, data, "utf-8");
    }

    async loadState(): Promise<SynchronikUnit[] | null> {
        try {
            const data = await fs.readFile(this.filePath, "utf-8");
            // Functions are not stored, so they will be undefined upon load.
            // The original unit definitions must be re-registered to restore them.
            return JSON.parse(data) as SynchronikUnit[];
        } catch (error: any) {
            // If the file doesn't exist or is corrupt, it's safe to start fresh.
            if (error.code === "ENOENT") {
                return null; // File doesn't exist, which is fine on first run
            } else if (error instanceof SyntaxError) {
                console.error(
                    "[Synchronik] Failed to load state due to corrupted file. Starting fresh.",
                    error.message
                );
                return null; // Corrupted JSON, treat as if no state exists.
            }
            throw error; // Re-throw other errors
        }
    }
}
