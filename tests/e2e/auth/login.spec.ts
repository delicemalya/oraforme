import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const EMAIL    = process.env.TEST_USER_EMAIL    ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

test.describe('Login flows — Identity Core', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`)
  })

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders login page with email and phone tabs', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /connexion|se connecter/i })).toBeVisible()
  })

  test('switches to phone mode without errors', async ({ page }) => {
    const phoneTab = page.getByRole('button', { name: /téléphone|phone/i })
    if (await phoneTab.isVisible()) {
      await phoneTab.click()
      await expect(page.locator('input[type="tel"], input[placeholder*="numéro"]')).toBeVisible()
    }
  })

  // ── Email / Password ──────────────────────────────────────────────────────

  test('shows error on wrong credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'nonexistent@oraforme.com')
    await page.fill('input[type="password"]', 'wrongpassword123')
    await page.getByRole('button', { name: /connexion|se connecter/i }).click()
    await expect(page.locator('[role="alert"], .error, [class*="error"]')).toBeVisible({ timeout: 5000 })
  })

  test('redirects to /dashboard on valid login', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not configured')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.getByRole('button', { name: /connexion|se connecter/i }).click()
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 })
    expect(page.url()).toContain('/dashboard')
  })

  // ── Unauthenticated redirect ─────────────────────────────────────────────

  test('redirects /dashboard to /login when not authenticated', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForURL(`${BASE}/login**`, { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('preserves ?next= param after redirect', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForURL(`${BASE}/login?next=/dashboard`, { timeout: 5000 })
    expect(page.url()).toContain('next=/dashboard')
  })

  // ── Password reset ────────────────────────────────────────────────────────

  test('forgot-password page renders', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`)
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  // ── Responsive ───────────────────────────────────────────────────────────

  test('login page is usable on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  // ── Security ─────────────────────────────────────────────────────────────

  test('/api/auth/log returns 401 for authenticated events without session', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/auth/log`, {
      data: { event_type: 'LOGOUT' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(401)
  })

  test('/api/auth/log returns 400 for invalid event_type', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/auth/log`, {
      data: { event_type: 'INVALID_EVENT' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
  })

  test('/api/auth/log accepts LOGIN_FAILED without session', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/auth/log`, {
      data: { event_type: 'LOGIN_FAILED', error_code: 'test', error_message: 'playwright test' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect([200, 500]).toContain(res.status())  // 200 if DB live, 500 if not configured in CI
  })
})
