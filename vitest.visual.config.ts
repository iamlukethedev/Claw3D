import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@claw3d/visual-contract/fixtures": path.resolve(
        __dirname,
        "packages/visual-contract/src/fixtures.ts",
      ),
      "@claw3d/visual-contract": path.resolve(__dirname, "packages/visual-contract/src/index.ts"),
      "@claw3d/visual-core": path.resolve(__dirname, "packages/visual-core/src/index.ts"),
      "@claw3d/adapter-mock": path.resolve(__dirname, "packages/adapter-mock/src/index.ts"),
      "@claw3d/adapter-null": path.resolve(__dirname, "packages/adapter-null/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/visual/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
