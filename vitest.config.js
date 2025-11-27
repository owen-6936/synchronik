import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        include: ["src/**/*.{test,spec}.{ts,mts,cts,tsx}"],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/cypress/**",
            "**/.idea/**",
            "**/.git/**",
            "**/.cache/**",
            "**/.output/**",
            "**/.temp/**",
            "**/*.config.{js,ts,mjs,cjs}",
        ],
    },
});
