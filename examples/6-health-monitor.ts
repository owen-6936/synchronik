import {
    createSynchronikManager,
    SynchronikProcess,
    SynchronikWorker,
} from "../src/index.js";

async function main() {
    const manager = createSynchronikManager();

    // Mock function to simulate checking the health of a service
    async function checkServiceHealth(serviceName: string): Promise<void> {
        // Simulate a service being down with a 20% probability
        if (Math.random() < 0.2) {
            throw new Error(`Service ${serviceName} is down!`);
        }
        console.log(`[HEALTH]  is healthy.`);
    }

    // Define health check workers
    const serviceNames = ["Database", "API", "Search", "Cache"];
    const healthCheckWorkers: SynchronikWorker[] = serviceNames.map(
        (serviceName) => ({
            id: `health-check-`,
            name: `Health Check: `,
            enabled: true,
            status: "idle",
            runOnInterval: true,
            intervalMs: 30000, // Check every 30 seconds
            run: async () => {
                await checkServiceHealth(serviceName);
            },
            onError: (error) => {
                console.error(`[ERROR] ${error.message}`);
            },
        })
    );

    // Define the master watcher worker
    const masterWatcherWorker: SynchronikWorker = {
        id: "master-watcher",
        name: "Master Watcher",
        enabled: true,
        status: "idle",
        runOnInterval: true,
        intervalMs: 10000, // Check every 10 seconds
        run: async () => {
            console.log("[MASTER] Checking service health...");
            const units = manager.listUnits();
            const failingServices = units.filter(
                (unit) =>
                    unit.id.startsWith("health-check-") &&
                    unit.status === "error"
            );

            if (failingServices.length > 0) {
                failingServices.forEach((service) => {
                    manager.emitMilestone("SERVICE_DOWN", {
                        serviceId: service.id,
                        serviceName: service.name,
                    });
                });
            } else {
                console.log("[MASTER] All services are healthy.");
            }
        },
    };

    // Define the process
    const healthMonitorProcess: SynchronikProcess = {
        enabled: true,
        id: "health-monitor-process",
        name: "Health Monitor",
        workers: [...healthCheckWorkers, masterWatcherWorker],
        status: "idle",
    };

    manager.registerUnit(healthMonitorProcess);
    manager.start();

    // Subscribe to events to log service down milestones
    manager.onMilestone((id, payload) => {
        if (id === "SERVICE_DOWN") {
            console.warn(
                `[ALERT] ${payload?.serviceName} (${payload?.serviceId}) is down!`
            );
        }
    });

    console.log("--- Starting Live System Health Monitor ---");
}

main();
