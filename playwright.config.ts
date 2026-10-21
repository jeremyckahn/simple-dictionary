import { defineConfig } from '@playwright/test'

// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to use a Chromium that is already
// installed instead of the one from `npx playwright install chromium`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
const port = 4173

export default defineConfig({
  testDir: 'e2e',
  // Downloading and unpacking the real dictionary takes several seconds.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  // The production build is what ships (service worker included), so test that.
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
