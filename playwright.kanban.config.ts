import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3100",
  },
  webServer: {
    command: "PORT=3100 npm run dev",
    port: 3100,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      OPENCLAW_STATE_DIR: path.resolve("./tests/fixtures/openclaw-empty-state"),
      NEXT_PUBLIC_GATEWAY_URL: "",
    },
  },
});
