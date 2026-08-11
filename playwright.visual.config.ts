import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const root = path.resolve(__dirname);
const executablePath = process.env.CLAW3D_PLAYWRIGHT_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e-visual",
  outputDir: path.join(root, ".claw3d/test-results"),
  reporter: [["line"]],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://127.0.0.1:3210",
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: {
    command: "npm run start --workspace @claw3d/app -- --port 3210",
    cwd: root,
    port: 3210,
    reuseExistingServer: false,
    env: {
      ...process.env,
      VISUAL_ADAPTER: "mock",
      JARVIS_CONNECTOR_ENABLED: "false",
      VISUAL_BROWSER_PERSISTENCE: "false",
      NEXT_TELEMETRY_DISABLED: "1",
      CLAW3D_HOME: path.join(root, ".claw3d/runtime"),
      TMPDIR: path.join(root, ".claw3d/tmp"),
    },
  },
});
