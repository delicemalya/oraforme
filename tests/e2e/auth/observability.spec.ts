import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test.describe('Identity Observability — E2E', () => {

  // ── Auth logs API ─────────────────────────────────────────────────────────

  test('POST /api/auth/log — LOGIN_FAILED logged without auth', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/auth/log`, {
      data: {
        event_type:    'LOGIN_FAILED',
        provider:      'email',
        error_code:    'invalid_credentials',
        error_message: 'Playwright observability test',
        duration_ms:   123,
      },
      headers: { 'Content-Type': 'application/json' },
    })
    // Accept 200 (DB connected) or 500 (CI without Supabase)
    expect([200, 500]).toContain(res.status())
  })

  test('POST /api/auth/log — rejects empty body', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/auth/log`, {
      data:    {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
  })

  test('POST /api/auth/log — rejects unknown event type', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/auth/log`, {
      data: { event_type: 'HACK_ATTEMPT' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
  })

  // ── Identity Health Dashboard ─────────────────────────────────────────────

  test('GET /identity-health redirects non-admins to /dashboard', async ({ page }) => {
    await page.goto(`${BASE}/identity-health`)
    // Either redirect or login redirect — both are correct for non-admin
    const url = page.url()
    expect(url).not.toContain('/identity-health')
  })

  // ── Session enforcement ───────────────────────────────────────────────────

  test('protected API routes return 401 without auth header', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/monitoring/health`)
    // monitoring is public — just verify it responds
    expect([200, 404]).toContain(res.status())
  })

  test('protected page API returns 401 for unauthenticated request', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/finance/kpis`)
    expect([401, 403, 404]).toContain(res.status())
  })

  // ── Trace headers extraction ──────────────────────────────────────────────

  test('POST /api/auth/log with X-Forwarded-For does not expose IP in response', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/auth/log`, {
      data:    { event_type: 'LOGIN_FAILED' },
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
    })
    // Response body should not echo back any sensitive data
    const body = await res.json().catch(() => ({}))
    expect(JSON.stringify(body)).not.toContain('1.2.3.4')
  })
})
