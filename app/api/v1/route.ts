import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

// GET /api/v1 — API info + auth check
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireApiKey(req)
  if (!ctx.ok) return ctx.error

  return NextResponse.json({
    api: 'Oraforme Public REST API',
    version: '1.0.0',
    tenant_id: ctx.tid,
    docs: 'https://docs.oraforme.com/api/v1',
    endpoints: [
      'GET /api/v1/factures',
      'GET /api/v1/factures/:id',
      'GET /api/v1/employees',
      'GET /api/v1/employees/:id',
      'GET /api/v1/students',
      'GET /api/v1/reservations',
      'GET /api/v1/orders',
      'POST /api/v1/webhooks/trigger',
    ],
  })
}
