import {
    createSynchronikManager,
    type SynchronikProcess,
    type SynchronikWorker,
} from "../src/index.js";
import fs from "fs/promises";

const lectureNotesFile = "projectile_motion_lecture.txt";

async function main() {
    const manager = createSynchronikManager();

    // Initial Conditions
    const initialConditions = {
        v0: 50, // m/s
        angleDegrees: 30, // degrees
        g: 9.81, // m/s^2
    };

    let lectureNotes = `## 🔬 Projectile Motion Lecture\n\n`;
    let calculatedValues: Record<string, number> = {};

    // Helper to append to notes and log
    const addNote = async (note: string) => {
        console.log(note);
        lectureNotes += `- ${note}\n`;
        await fs.writeFile(lectureNotesFile, lectureNotes);
    };

    // --- Define Workers ---

    const setInitialConditions: SynchronikWorker = {
        name: "Set Initial Conditions",
        id: "set-initial-conditions",
        enabled: true,
        run: async () => {
            await addNote(
                `Initial conditions: Velocity=${initialConditions.v0} m/s, Angle=${initialConditions.angleDegrees}°`
            );
        },
    };

    const calculateVelocityComponents: SynchronikWorker = {
        name: "Calculate Velocity Components",
        enabled: true,
        id: "calculate-velocity-components",
        run: async () => {
            const angleRadians =
                (initialConditions.angleDegrees * Math.PI) / 180;
            calculatedValues.v0x =
                initialConditions.v0 * Math.cos(angleRadians);
            calculatedValues.v0y =
                initialConditions.v0 * Math.sin(angleRadians);
            await addNote(
                `Calculated velocity components: Vx=${calculatedValues.v0x.toFixed(
                    2
                )} m/s, Vy=${calculatedValues.v0y.toFixed(2)} m/s`
            );
        },
    };

    const calculateTimeToPeak: SynchronikWorker = {
        name: "Calculate Time to Peak",
        enabled: true,
        id: "calculate-time-to-peak",
        run: async () => {
            calculatedValues.timeToPeak =
                calculatedValues.v0y / initialConditions.g;
            await addNote(
                `Time to peak height: ${calculatedValues.timeToPeak.toFixed(2)} s`
            );
        },
    };

    const calculateMaxHeight: SynchronikWorker = {
        name: "Calculate Maximum Height",
        enabled: true,
        id: "calculate-max-height",
        run: async () => {
            calculatedValues.maxHeight =
                calculatedValues.v0y * calculatedValues.timeToPeak -
                0.5 *
                    initialConditions.g *
                    Math.pow(calculatedValues.timeToPeak, 2);
            await addNote(
                `Maximum height (H_max): ${calculatedValues.maxHeight.toFixed(2)} m`
            );
        },
    };

    const calculateTotalTimeOfFlight: SynchronikWorker = {
        name: "Calculate Total Time of Flight",
        enabled: true,
        id: "calculate-total-time-of-flight",
        run: async () => {
            calculatedValues.totalTime = 2 * calculatedValues.timeToPeak;
            await addNote(
                `Total time of flight: ${calculatedValues.totalTime.toFixed(2)} s`
            );
        },
    };

    const calculateRange: SynchronikWorker = {
        name: "Calculate Range",
        enabled: true,
        id: "calculate-range",
        run: async () => {
            calculatedValues.range =
                calculatedValues.v0x * calculatedValues.totalTime;
            await addNote(
                `Horizontal range (R): ${calculatedValues.range.toFixed(2)} m`
            );
        },
    };

    const generateFinalReport: SynchronikWorker = {
        name: "Generate Final Report",
        enabled: true,
        id: "generate-final-report",
        run: async () => {
            lectureNotes += `\n**Conclusion:** The projectile reached a maximum height of ${calculatedValues.maxHeight.toFixed(
                2
            )}m and landed ${calculatedValues.range.toFixed(2)}m away after ${calculatedValues.totalTime.toFixed(
                2
            )}s.`;
            await fs.writeFile(lectureNotesFile, lectureNotes);
            await addNote(
                "Lecture notes have been generated in projectile_motion_lecture.txt"
            );
        },
    };

    // --- Define Process ---

    const physicsLectureProcess: SynchronikProcess = {
        enabled: true,
        id: "physics-lecture-process",
        name: "Projectile Motion Lecture",
        runMode: "sequential", // Each step depends on the previous one
        workers: [
            setInitialConditions,
            calculateVelocityComponents,
            calculateTimeToPeak,
            calculateMaxHeight,
            calculateTotalTimeOfFlight,
            calculateRange,
            generateFinalReport,
        ],
        onComplete: () => {
            console.log(
                "\nLecture complete. Check the generated file for notes."
            );
        },
    };

    // --- Register and Run ---

    manager.registerUnit(physicsLectureProcess);

    manager.subscribeToEvents((event) => {
        if (event.type !== "milestone") {
            console.log(`EVENT: [${event.type}] for unit '${event.unitId}'`);
        }
    });

    console.log("--- Starting Physics Lecture Process ---");
    await manager.runProcessById("physics-lecture-process");
    console.log("--- Process Complete ---");
}

main().catch(console.error);
