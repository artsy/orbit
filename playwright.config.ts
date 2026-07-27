import { defineConfig, devices } from "@playwright/test"
import { BASE_URL, NEXTAUTH_SECRET } from "./e2e/constants"

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    storageState: "e2e/.auth/state.json",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Some environments ship a prebuilt Chromium; point at it when set.
        // In CI we omit this and `playwright install` provides the browser.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "yarn dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXTAUTH_SECRET,
      NEXTAUTH_URL: BASE_URL,
      GRAVITY_URL: "https://stagingapi.artsy.net",
      PUBLIC_GRAVITY_URL: "https://stagingapi.artsy.net",
      DATABASE_URL:
        "postgresql://orbit:orbit@localhost:5432/orbit_e2e?schema=public",
    },
  },
})
