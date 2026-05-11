import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // expect timeout was 1s — too tight, especially on cold CI. 5s matches the framework default
  // and removes a class of false negatives where a slow DOM update racing a visible assertion
  // produced a flake.
  expect: { timeout: 5_000 },
  fullyParallel: false,
  // Trip CI builds when a stray test.only sneaks into a PR.
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Two workers is the smallest step toward parallel execution. Per-test API isolation (unique
  // project name + try/finally cascade-delete) supports this; bump higher if no shared-state
  // surprises surface.
  workers: 2,
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    launchOptions: {
      slowMo: Number(process.env.E2E_SLOWMO) || 0,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
