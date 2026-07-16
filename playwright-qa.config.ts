/**
 * playwright-qa.config.ts — Configuration Playwright pour le protocole QA-001
 *
 * Certifications C-001 à C-016 — Evidence-Based Certification
 *
 * Usage :
 *   npx playwright test --config=playwright-qa.config.ts
 *   npx playwright test --config=playwright-qa.config.ts tests/certifications/c002-tenant-core.spec.ts
 *
 * Prérequis (chargés automatiquement depuis .env.local) :
 *   PLAYWRIGHT_BASE_URL=http://localhost:3001   (dev server running)
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role>    (requis — aucun fallback)
 *   GIT_COMMIT=<sha>                            (optionnel — pour le rapport)
 */

import { defineConfig, devices } from '@playwright/test'
import * as path from 'node:path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '.env.local') })

export default defineConfig({
  testDir: './tests/certifications',
  timeout: 120_000,         // 120s par scénario — captures + attentes réseau + 30 comptes
  retries: 0,               // QA-001 : 0 retry — un FAIL est un FAIL
  workers: 1,               // Sériel — les scénarios sont interdépendants

  // Démarre le serveur Next.js si PLAYWRIGHT_BASE_URL n'est pas défini
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command:              'node_modules\\.bin\\next.cmd dev --port 3001',
    url:                  'http://localhost:3001',
    reuseExistingServer:  true,
    timeout:              60_000,
    env: { NODE_OPTIONS: '--max-old-space-size=4096' },
  },

  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'test-results/certifications/html-report',
      open:         'never',
    }],
    ['json', {
      outputFile: 'test-results/certifications/results.json',
    }],
  ],

  use: {
    baseURL:    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
    trace:      'on',                // Toujours tracer — QA-001 exige des preuves
    screenshot: 'on',               // Capture à chaque action
    video:      'on',               // Enregistrement vidéo
    locale:     'fr-FR',
    timezoneId: 'Africa/Brazzaville',
    viewport:   { width: 1280, height: 800 },

    // Headers QA
    extraHTTPHeaders: {
      'X-QA-Protocol': 'QA-001',
      'X-QA-Run':      process.env.GIT_COMMIT ?? 'local',
    },
  },

  outputDir: path.join('test-results', 'certifications', 'artifacts'),

  projects: [
    {
      name: 'chromium',
      use:  {
        ...devices['Desktop Chrome'],
        // Chrome-specific: expose memory API
        launchOptions: {
          args: ['--enable-precise-memory-info'],
        },
      },
    },
  ],
})
