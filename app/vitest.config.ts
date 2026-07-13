import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // e2e/** holds Playwright specs (@playwright/test), which use a
    // different test/expect API and would crash if picked up by Vitest.
    exclude: ["e2e/**", "node_modules/**"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
