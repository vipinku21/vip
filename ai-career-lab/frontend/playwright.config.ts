import { defineConfig } from "@playwright/test";
import path from "node:path";
const root = path.resolve("..");
const python = path.join(
  root,
  "backend",
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:8031",
    channel: process.env.LAB_BROWSER || "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: '"' + python + '" -m backend.tests.browser_server',
    cwd: root,
    url: "http://127.0.0.1:8031/api/health",
    reuseExistingServer: false,
    timeout: 80000,
  },
});
