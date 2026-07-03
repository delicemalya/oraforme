import type { AuthTrace } from './types'

interface TraceOpts {
  userId?:    string | null
  tenantId?:  string | null
  sessionId?: string | null
}

export function buildTrace(
  request: { headers: { get(name: string): string | null } },
  opts:    TraceOpts = {},
): AuthTrace {
  const ua = request.headers.get('user-agent') ?? ''

  return {
    requestId: crypto.randomUUID(),
    sessionId: opts.sessionId ?? null,
    userId:    opts.userId    ?? null,
    tenantId:  opts.tenantId  ?? null,
    ip:        extractIp(request.headers),
    device:    detectDevice(ua),
    browser:   detectBrowser(ua),
  }
}

/** Build a minimal trace when no request context is available (e.g. server actions) */
export function buildServerTrace(opts: TraceOpts = {}): AuthTrace {
  return {
    requestId: crypto.randomUUID(),
    sessionId: opts.sessionId ?? null,
    userId:    opts.userId    ?? null,
    tenantId:  opts.tenantId  ?? null,
    ip:        null,
    device:    null,
    browser:   null,
  }
}

function extractIp(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  return headers.get('x-real-ip') ?? null
}

function detectDevice(ua: string): AuthTrace['device'] {
  if (!ua) return null
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile'
  if (/iPad|Tablet/i.test(ua))                return 'tablet'
  return 'desktop'
}

function detectBrowser(ua: string): AuthTrace['browser'] {
  if (!ua) return null
  if (/Edg\//i.test(ua))     return 'edge'
  if (/OPR\/|Opera/i.test(ua)) return 'opera'
  if (/Firefox\//i.test(ua)) return 'firefox'
  if (/Chrome\//i.test(ua))  return 'chrome'
  if (/Safari\//i.test(ua))  return 'safari'
  return 'other'
}
