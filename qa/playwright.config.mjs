import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.QA_UI_URL || "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./artifacts/playwright",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["junit", { outputFile: "artifacts/playwright-junit.xml" }],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
    ["./reporters/fail-on-flaky.mjs"],
  ],
  use: {
    baseURL,
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
