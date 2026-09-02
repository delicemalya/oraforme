import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — Identity Core Observability E2E Tests
 *
 * To install: npx playwright install chromium
 * To run:     npx playwright test
 *
 * Requires .env.local with:
 *   PLAYWRIGHT_BASE_URL (default: http://localhost:3000)
 *   TEST_USER_EMAIL / TEST_USER_PASSWORD (valid Supabase user)
 */
export default defineConfig({
  testDir:     './tests/e2e',
  timeout:     30_000,
  retries:     1,
  workers:     2,
  reporter:    [['html', { open: 'never' }], ['list']],

  use: {
    baseURL:          process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace:            'on-first-retry',
    screenshot:       'only-on-failure',
    video:            'retain-on-failure',
    locale:           'fr-FR',
    timezoneId:       'Africa/Brazzaville',
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
    {
      name:  'mobile-safari',
      use:   { ...devices['iPhone 14'] },
    },
  ],
})
