import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import magicalSvg from "vite-plugin-magical-svg";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    // Important: tsconfigPaths should come before react plugin
    tsconfigPaths(),
    react(),
    // Handle SVG files to prevent InvalidCharacterError
    magicalSvg({
      target: "react",
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Include pattern following 2025 best practices
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      ".next",
      "coverage",
      "examples/**",
      "e2e/**",
      "playwright-tests/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "vitest.config.mts",
        "**/*.d.ts",
        "**/*.config.{js,ts,mjs,mts}",
        "**/*.spec.{js,ts,jsx,tsx}",
        "**/*.test.{js,ts,jsx,tsx}",
        "examples/**",
        "e2e/**",
      ],
      // Add thresholds for better quality control
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    // Performance optimization
    pool: "threads",
    poolOptions: {
      threads: {
        // Use worker threads for better performance
        singleThread: true,
      },
    },
    // Better error reporting
    reporters: ["default"],
    // Timeout for tests (default is 5000ms)
    testTimeout: 10000,
    // Hook timeout
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      "~": resolve(__dirname, "./"),
    },
  },
});
