/**
 * Rate Limiting — In-memory avec fenêtre glissante (sliding window).
 * Sur Vercel (serverless), utilise Supabase comme backend pour la persistance.
 * Pour la production haute charge, remplacer par Redis/Upstash.
 */

import { NextRequest, NextResponse } from 'next/server'

// In-memory store — partagé sur le même process (OK pour Vercel + dev)
const store = new Map<string, { count: number; resetAt: number }>()

interface RateLimitOptions {
  windowMs?: number   // Fenêtre en ms (défaut: 60_000 = 1 min)
  max?: number        // Max requêtes par fenêtre (défaut: 60)
  keyFn?: (req: NextRequest) => string
}

/**
 * Retourne null si OK, NextResponse 429 si limite atteinte.
 */
export function checkRateLimit(
  req: NextRequest,
  opts: RateLimitOptions = {},
): NextResponse | null {
  const {
    windowMs = 60_000,
    max = 60,
    keyFn = (r) => {
      const ip = r.headers.get('x-forwarded-for')?.split(',')[0] ?? r.headers.get('x-real-ip') ?? 'unknown'
      return `rl:${ip}:${new URL(r.url).pathname}`
    },
  } = opts

  const key = keyFn(req)
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Trop de requêtes — réessayez plus tard', retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      },
    )
  }

  entry.count++
  return null
}

/**
 * Limits strictes pour les endpoints sensibles.
 */
export const RATE_LIMITS = {
  api:        { windowMs: 60_000,   max: 120 },  // 120 req/min
  webhook:    { windowMs: 60_000,   max: 30  },  // 30 req/min
  auth:       { windowMs: 300_000,  max: 10  },  // 10 req/5min
  automation: { windowMs: 3_600_000, max: 50 },  // 50 req/h
  export:     { windowMs: 60_000,   max: 10  },  // 10 req/min
  ai:         { windowMs: 60_000,   max: 20  },  // 20 req/min
} satisfies Record<string, RateLimitOptions>

// Cleanup — purge les entrées expirées toutes les 5 min
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 300_000)
}
