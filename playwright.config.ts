import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const localChrome = existsSync(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
);
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    actionTimeout: 10000,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(localChrome ? { channel: "chrome" } : {}),
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/health",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
