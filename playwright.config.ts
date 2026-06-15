import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * The application stack (DB + Redis + MinIO + web + worker) is started
 * externally — by CI (see .github/workflows/ci.yml) or via the docker compose
 * dev script — so there is intentionally NO `webServer` here. Tests just hit
 * the already-running server at baseURL.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
