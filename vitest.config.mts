import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    // Many suites reset modules and cold-import large module graphs per test;
    // the 5s default is too tight when ~170 files run in parallel.
    testTimeout: 20_000,
  },
});
