import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSynchronikManager,
  SynchronikWorker,
  SynchronikProcess,
} from "../index.js";
import { writeFileSync } from "fs";

/**
 * This test file serves as a "showcase" or "short lecture" demonstrating
 * the Synchronik engine's capabilities by simulating a multi-layered physics problem:
 * Projectile Motion.
 *
 * Each step of the calculation is represented by a SynchronikWorker,
 * and a SynchronikProcess orchestrates their sequential execution.
 * Milestones are used to track and report the results of each step.
 */
describe("Synchronik Showcase: Projectile Motion Lecture", () => {
  let manager: ReturnType<typeof createSynchronikManager>;
  let lectureOutput: string[] = [];
  let sharedPhysicsData: {
    initialVelocity?: number;
    launchAngleDegrees?: number;
    launchAngleRadians?: number;
    gravity?: number;
    initialVelocityX?: number;
    initialVelocityY?: number;
    timeToPeak?: number;
    maxHeight?: number;
    totalTimeOfFlight?: number;
    horizontalRange?: number;
  } = {};

  // Helper to capture console output for the lecture
  const logLecture = (message: string) => {
    lectureOutput.push(message);
    // console.log(message); // Uncomment to see live output during test run
  };

  beforeEach(() => {
    manager = createSynchronikManager();
    lectureOutput = [];
    sharedPhysicsData = {}; // Reset shared data for each test

    // Subscribe to milestones to capture lecture points
    manager.onMilestone((milestoneId, payload) => {
      if (milestoneId.startsWith("lecture:")) {
        logLecture(
          `🎯 ${milestoneId.replace("lecture:", "")}: ${JSON.stringify(
            payload
          )}`
        );
      }
    });
  });

  it("should simulate a projectile motion lecture with step-by-step calculations", async () => {
    logLecture("--- Synchronik Physics Lecture: Projectile Motion ---");
    logLecture("Scenario: A projectile is launched from the ground.");
    const startTime = Date.now();

    // Worker 1: Define initial conditions
    const initialConditionsWorker: SynchronikWorker = {
      id: "initial-conditions-setup",
      name: "Initial Conditions Setup",
      enabled: true,
      status: "idle",
      run: async () => {
        logLecture("Step 1: Setting Initial Conditions");
        sharedPhysicsData.initialVelocity = 50; // m/s
        sharedPhysicsData.launchAngleDegrees = 30; // degrees
        sharedPhysicsData.gravity = 9.81; // m/s^2
        sharedPhysicsData.launchAngleRadians =
          (sharedPhysicsData.launchAngleDegrees * Math.PI) / 180;

        manager.emitMilestone("lecture:Initial Conditions Set", {
          initialVelocity: sharedPhysicsData.initialVelocity,
          launchAngle: sharedPhysicsData.launchAngleDegrees + "°",
          gravity: sharedPhysicsData.gravity + " m/s²",
        });
      },
    };

    // Worker 2: Calculate initial velocity components
    const velocityComponentsWorker: SynchronikWorker = {
      id: "calculate-velocity-components",
      name: "Calculate Velocity Components",
      enabled: true,
      status: "idle",
      run: async () => {
        logLecture("Step 2: Calculating Initial Velocity Components");
        const { initialVelocity, launchAngleRadians } = sharedPhysicsData;
        if (initialVelocity === undefined || launchAngleRadians === undefined) {
          throw new Error("Missing initial velocity or angle");
        }
        sharedPhysicsData.initialVelocityX =
          initialVelocity * Math.cos(launchAngleRadians);
        sharedPhysicsData.initialVelocityY =
          initialVelocity * Math.sin(launchAngleRadians);

        manager.emitMilestone("lecture:Velocity Components", {
          Vx: sharedPhysicsData.initialVelocityX.toFixed(2) + " m/s",
          Vy: sharedPhysicsData.initialVelocityY.toFixed(2) + " m/s",
        });
      },
    };

    // Worker 3: Calculate time to peak height
    const timeToPeakWorker: SynchronikWorker = {
      id: "calculate-time-to-peak",
      name: "Calculate Time to Peak",
      enabled: true,
      status: "idle",
      run: async () => {
        logLecture("Step 3: Calculating Time to Peak Height");
        const { initialVelocityY, gravity } = sharedPhysicsData;
        if (initialVelocityY === undefined || gravity === undefined) {
          throw new Error("Missing initial vertical velocity or gravity");
        }
        sharedPhysicsData.timeToPeak = initialVelocityY / gravity;
        manager.emitMilestone("lecture:Time to Peak", {
          time: sharedPhysicsData.timeToPeak.toFixed(2) + " s",
        });
      },
    };

    // Worker 4: Calculate maximum height
    const maxHeightWorker: SynchronikWorker = {
      id: "calculate-max-height",
      name: "Calculate Maximum Height",
      enabled: true,
      status: "idle",
      run: async () => {
        logLecture("Step 4: Calculating Maximum Height");
        const { initialVelocityY, timeToPeak, gravity } = sharedPhysicsData;
        if (
          initialVelocityY === undefined ||
          timeToPeak === undefined ||
          gravity === undefined
        ) {
          throw new Error(
            "Missing initial vertical velocity, time to peak, or gravity"
          );
        }
        sharedPhysicsData.maxHeight =
          initialVelocityY * timeToPeak -
          0.5 * gravity * timeToPeak * timeToPeak;
        manager.emitMilestone("lecture:Maximum Height", {
          height: sharedPhysicsData.maxHeight.toFixed(2) + " m",
        });
      },
    };

    // Worker 5: Calculate total time of flight
    const totalTimeOfFlightWorker: SynchronikWorker = {
      id: "calculate-total-time-of-flight",
      name: "Calculate Total Time of Flight",
      enabled: true,
      status: "idle",
      run: async () => {
        logLecture("Step 5: Calculating Total Time of Flight");
        const { timeToPeak } = sharedPhysicsData;
        if (timeToPeak === undefined) {
          throw new Error("Missing time to peak");
        }
        sharedPhysicsData.totalTimeOfFlight = 2 * timeToPeak;
        manager.emitMilestone("lecture:Total Time of Flight", {
          time: sharedPhysicsData.totalTimeOfFlight.toFixed(2) + " s",
        });
      },
    };

    // Worker 6: Calculate horizontal range
    const horizontalRangeWorker: SynchronikWorker = {
      id: "calculate-horizontal-range",
      name: "Calculate Horizontal Range",
      enabled: true,
      status: "idle",
      run: async () => {
        logLecture("Step 6: Calculating Horizontal Range");
        const { initialVelocityX, totalTimeOfFlight } = sharedPhysicsData;
        if (initialVelocityX === undefined || totalTimeOfFlight === undefined) {
          throw new Error(
            "Missing initial horizontal velocity or total time of flight"
          );
        }
        sharedPhysicsData.horizontalRange =
          initialVelocityX * totalTimeOfFlight;
        manager.emitMilestone("lecture:Horizontal Range", {
          range: sharedPhysicsData.horizontalRange.toFixed(2) + " m",
        });
      },
    };

    // Worker 7: Generate the lecture notes file
    const generateLectureNotesWorker: SynchronikWorker = {
      id: "generate-lecture-notes",
      name: "Generate Lecture Notes File",
      enabled: true,
      status: "idle",
      run: async () => {
        logLecture("Step 7: Generating Lecture Notes File");
        const duration = Date.now() - startTime;
        const filename = "projectile_motion_lecture.txt";
        const stats = `\n--- Execution Stats ---\nRun Mode: sequential\nTotal Duration: ${duration}ms`;
        const content = lectureOutput.join("\n") + stats;

        writeFileSync(filename, content);
        logLecture(`Lecture notes written to ${filename}`);
        manager.emitMilestone("lecture:Notes File Generated", { filename });
      },
    };

    // Define the process to orchestrate the workers
    const projectileMotionProcess: SynchronikProcess = {
      id: "projectile-motion-analysis",
      name: "Projectile Motion Analysis",
      enabled: true,
      status: "idle",
      workers: [
        initialConditionsWorker,
        velocityComponentsWorker,
        timeToPeakWorker,
        maxHeightWorker,
        totalTimeOfFlightWorker,
        horizontalRangeWorker,
        generateLectureNotesWorker,
      ],
      runMode: "sequential", // Ensure calculations happen in order
    };

    // Register all units
    manager.registerUnit(projectileMotionProcess);
    projectileMotionProcess.workers.forEach((worker) =>
      manager.registerUnit(worker)
    );

    logLecture("\n--- Starting Projectile Motion Analysis ---");
    await manager.runProcessById(projectileMotionProcess.id);
    logLecture("--- Projectile Motion Analysis Complete ---");

    // Assertions to ensure calculations were performed and milestones emitted
    expect(sharedPhysicsData.initialVelocity).toBe(50);
    expect(sharedPhysicsData.launchAngleDegrees).toBe(30);
    expect(sharedPhysicsData.gravity).toBe(9.81);
    expect(sharedPhysicsData.initialVelocityX).toBeCloseTo(43.301);
    expect(sharedPhysicsData.initialVelocityY).toBeCloseTo(25.0);
    expect(sharedPhysicsData.timeToPeak).toBeCloseTo(2.55);
    expect(sharedPhysicsData.maxHeight).toBeCloseTo(31.855);
    expect(sharedPhysicsData.totalTimeOfFlight).toBeCloseTo(5.097);
    expect(sharedPhysicsData.horizontalRange).toBeCloseTo(220.7);

    // You can also assert on the lectureOutput array if you want to verify the exact text
    expect(lectureOutput.length).toBeGreaterThan(10); // Just a basic check
    expect(lectureOutput[0]).toContain(
      "--- Synchronik Physics Lecture: Projectile Motion ---"
    );
    expect(lectureOutput).toContainEqual(
      expect.stringContaining(
        '🎯 Initial Conditions Set: {"initialVelocity":50,"launchAngle":"30°","gravity":"9.81 m/s²"}'
      )
    );
    expect(lectureOutput).toContainEqual(
      expect.stringContaining('🎯 Horizontal Range: {"range":"220.70 m"}')
    );
  });
});
