/**
 * C-003.2 — École Dashboard Stability Certification
 *
 * ROOT CAUSE FIXED (app/dashboard/ecole/layout.tsx):
 *   .select('secteur')          →  .select('secteur_activite')
 *   tenant?.secteur === 'ecole' →  tenant?.secteur_activite === 'ecole'
 *
 * The broken column name caused PostgREST to return null for the tenant query,
 * making the guard always execute redirect('/dashboard') for école owners.
 * This triggered an infinite redirect loop:
 *   /dashboard → server redirects école users → /dashboard/ecole
 *   /dashboard/ecole layout → secteur query null → redirect('/dashboard')
 *   → repeat → URL oscillation + content flash
 *
 * École STAFF (ecole_role_name set) were NOT affected — they short-circuit
 * on the first if-branch and never reach the broken tenant query.
 *
 * VALIDATION:
 *   V01 — URL lands at /dashboard/ecole and never returns to /dashboard (10 s)
 *   V02 — Full URL chain: login→/dashboard→/dashboard/ecole→stable
 *   V03 — No spinner AFTER initial load stabilizes (observe 8 s post-settle)
 *   V04 — < 3 router.refresh() calls in 8 s after load settles
 *   V05 — Dashboard content visible (heading / KPI cards rendered)
 *   V06 — 5 navigations: URL always ends at /dashboard/ecole
 */

import { test, expect, type Page } from '@playwright/test'
import { createEcoleAccount, deleteTestAccount, type TestAccount } from './helpers/db'

// ── Config ────────────────────────────────────────────────────────────────────

const RUN_ID = process.env.GIT_COMMIT?.slice(0, 6) ?? Date.now().toString(36)
const BASE   = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

// Serial mode — tests share one account, run sequentially, each gets a fresh page
test.describe.configure({ mode: 'serial' })

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginEcole(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle', { timeout: 30_000 })
  await page.fill('input[type="email"]',    email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // Wait for the full redirect chain: /login → /dashboard → /dashboard/ecole
  await page.waitForURL(/\/dashboard\/ecole/, { timeout: 90_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 })
}

/** Wait for loading spinner to disappear (up to maxWaitMs) */
async function waitForSpinnerGone(page: Page, maxWaitMs: number): Promise<void> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const visible = await page.locator('.animate-spin').isVisible().catch(() => false)
    if (!visible) return
    await page.waitForTimeout(200)
  }
}

/** Count RSC/router.refresh() calls within durationMs */
async function countRefreshCalls(page: Page, durationMs: number): Promise<number> {
  let count = 0
  const handler = (req: { url: () => string }) => {
    const url = req.url()
    if (url.includes('_rsc') || (url.includes('/dashboard') && url.includes('?_rsc'))) {
      count++
    }
  }
  page.on('request', handler)
  await page.waitForTimeout(durationMs)
  page.off('request', handler)
  return count
}

/** Check if spinner appears within durationMs AFTER initial load settled */
async function detectSpinnerFlash(page: Page, durationMs: number): Promise<boolean> {
  let sawSpinner = false
  const interval = setInterval(async () => {
    try {
      const visible = await page.locator('.animate-spin').isVisible()
      if (visible) sawSpinner = true
    } catch { /* page navigating */ }
  }, 150)
  await page.waitForTimeout(durationMs)
  clearInterval(interval)
  return sawSpinner
}

// ── Test Account ──────────────────────────────────────────────────────────────

let account: TestAccount

test.beforeAll(async () => {
  account = await createEcoleAccount('C003-2-ECOLE', RUN_ID)
  console.log(`[C003-2] École account created: ${account.email} (tenant: ${account.tenantId})`)
})

test.afterAll(async () => {
  await deleteTestAccount(account)
  console.log('[C003-2] École account cleaned up')
})

// ── V01 — URL stays at /dashboard/ecole (no oscillation) ─────────────────────

test('V01 — URL reste sur /dashboard/ecole (pas d\'oscillation en 10 s)', async ({ page }) => {
  test.setTimeout(300_000)
  await loginEcole(page, account.email, account.password)

  const urlAfterLogin = page.url()
  console.log(`[V01] URL après login: ${urlAfterLogin}`)
  await page.screenshot({ path: `test-results/certifications/c003-2-v01-login.png` })

  expect(urlAfterLogin, 'URL doit être /dashboard/ecole après login')
    .toContain('/dashboard/ecole')

  // Monitor URL for 10 s — must never leave /dashboard/ecole
  const badUrls: string[] = []
  const navListener = () => {
    const u = page.url()
    if (!u.includes('/dashboard/ecole')) badUrls.push(u)
  }
  page.on('framenavigated', navListener)
  await page.waitForTimeout(10_000)
  page.off('framenavigated', navListener)

  await page.screenshot({ path: `test-results/certifications/c003-2-v01-stable.png` })
  console.log(`[V01] URLs hors-cible détectées: ${JSON.stringify(badUrls)}`)

  expect(
    badUrls.length,
    `URL a quitté /dashboard/ecole vers : ${JSON.stringify(badUrls)}`,
  ).toBe(0)
})

// ── V02 — Full URL chain proof ────────────────────────────────────────────────

test('V02 — Chaîne URL complète prouvée : login→/dashboard→/dashboard/ecole stable', async ({ page }) => {
  test.setTimeout(300_000)
  const allUrls: string[] = []
  page.on('framenavigated', () => allUrls.push(page.url()))

  await loginEcole(page, account.email, account.password)
  await page.waitForTimeout(8_000)

  console.log(`[V02] Toutes les URLs visitées: ${JSON.stringify(allUrls)}`)
  await page.screenshot({ path: `test-results/certifications/c003-2-v02-chain.png` })

  const passedThroughDashboard = allUrls.some(u => u.includes('/dashboard'))
  const landedOnEcole          = allUrls.some(u => u.includes('/dashboard/ecole'))

  expect(passedThroughDashboard, 'Doit être passé par /dashboard').toBe(true)
  expect(landedOnEcole,          'Doit avoir atterri sur /dashboard/ecole').toBe(true)

  // After reaching /dashboard/ecole, must NEVER loop back to bare /dashboard
  const ecoleIdx   = allUrls.findIndex(u => u.includes('/dashboard/ecole'))
  const afterEcole = allUrls.slice(ecoleIdx + 1)
  const loopedBack = afterEcole.some(u => {
    const path = new URL(u).pathname
    return path === '/dashboard' || path === '/dashboard/'
  })

  expect(loopedBack, `Boucle détectée après /dashboard/ecole : ${JSON.stringify(afterEcole)}`).toBe(false)
})

// ── V03 — No spinner after load settles ──────────────────────────────────────

test('V03 — Aucun flash spinner après stabilisation (8 s)', async ({ page }) => {
  test.setTimeout(300_000)
  await loginEcole(page, account.email, account.password)

  // Wait for initial data-load spinner to finish
  await waitForSpinnerGone(page, 30_000)
  await page.screenshot({ path: `test-results/certifications/c003-2-v03-before.png` })

  // Observe 8 s — no spinner re-appearance means no loop
  const sawSpinner = await detectSpinnerFlash(page, 8_000)

  await page.screenshot({ path: `test-results/certifications/c003-2-v03-after.png` })

  expect(sawSpinner, 'Spinner re-apparu après stabilisation — boucle possible').toBe(false)
})

// ── V04 — < 3 router.refresh() calls after load settles ──────────────────────

test('V04 — < 3 router.refresh() au repos après chargement (8 s)', async ({ page }) => {
  test.setTimeout(300_000)
  await loginEcole(page, account.email, account.password)

  await waitForSpinnerGone(page, 30_000)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  await page.screenshot({ path: `test-results/certifications/c003-2-v04-before.png` })
  const calls = await countRefreshCalls(page, 8_000)
  await page.screenshot({ path: `test-results/certifications/c003-2-v04-after.png` })

  console.log(`[V04] router.refresh() calls in 8 s au repos: ${calls}`)
  expect(calls, `${calls} calls RSC détectés — boucle possible`).toBeLessThan(3)
})

// ── V05 — Dashboard content visible ──────────────────────────────────────────

test('V05 — Contenu du dashboard école visible (pas vide)', async ({ page }) => {
  test.setTimeout(300_000)
  await loginEcole(page, account.email, account.password)
  await page.waitForTimeout(5_000)

  await page.screenshot({ path: `test-results/certifications/c003-2-v05-content.png` })

  const heading        = page.locator('h1, h2, [class*="page-title"], [class*="kpi"]').first()
  const headingVisible = await heading.isVisible().catch(() => false)
  const currentUrl     = page.url()

  console.log(`[V05] URL: ${currentUrl}, heading visible: ${headingVisible}`)

  expect(currentUrl, 'Page doit être /dashboard/ecole').toContain('/dashboard/ecole')
  expect(headingVisible, 'Aucun titre ou KPI visible — page vide').toBe(true)
})

// ── V06 — 5 navigations always return to /dashboard/ecole ────────────────────

test('V06 — 5 navigations rapides : URL toujours /dashboard/ecole', async ({ page }) => {
  test.setTimeout(300_000)
  await loginEcole(page, account.email, account.password)

  let wrongUrl = false
  let badPath  = ''

  for (let i = 0; i < 5; i++) {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForURL(/\/dashboard\/ecole/, { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(500)

    const url = page.url()
    console.log(`[V06] Navigation ${i + 1}/5 → ${url}`)
    if (!url.includes('/dashboard/ecole')) {
      wrongUrl = true
      badPath  = url
      break
    }
  }

  await page.screenshot({ path: `test-results/certifications/c003-2-v06-after-navs.png` })

  expect(
    wrongUrl,
    `Navigation échouée : URL incorrecte ${badPath} — boucle de redirection possible`,
  ).toBe(false)
})
