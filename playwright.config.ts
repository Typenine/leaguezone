import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load DATABASE_URL and other secrets the same way Next.js does, so e2e
// tests that touch the real DB (onboarding-journey, cross-league-isolation)
// aren't silently skipped just because they're run outside `npm run dev`.
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const PORT = process.env.PORT || '3000';
const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  // Reuse a dev server if one is already running (common in this workspace);
  // otherwise start one for the test run.
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
