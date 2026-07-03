import { describe, it, expect } from 'vitest'
import { buildTrace, buildServerTrace } from '../auth-trace'

function makeHeaders(h: Record<string, string>) {
  return { get: (name: string) => h[name.toLowerCase()] ?? null }
}

describe('buildTrace()', () => {
  it('extracts IP from x-forwarded-for', () => {
    const req = { headers: makeHeaders({ 'x-forwarded-for': '196.0.0.1, 10.0.0.1', 'user-agent': '' }) }
    const trace = buildTrace(req)
    expect(trace.ip).toBe('196.0.0.1')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = { headers: makeHeaders({ 'x-real-ip': '10.20.30.40', 'user-agent': '' }) }
    const trace = buildTrace(req)
    expect(trace.ip).toBe('10.20.30.40')
  })

  it('returns null ip when no IP headers present', () => {
    const req = { headers: makeHeaders({ 'user-agent': '' }) }
    expect(buildTrace(req).ip).toBeNull()
  })

  it('detects Chrome browser correctly', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    const req = { headers: makeHeaders({ 'user-agent': ua }) }
    expect(buildTrace(req).browser).toBe('chrome')
  })

  it('detects Firefox correctly', () => {
    const ua = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0'
    const req = { headers: makeHeaders({ 'user-agent': ua }) }
    expect(buildTrace(req).browser).toBe('firefox')
  })

  it('detects Edge correctly', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
    const req = { headers: makeHeaders({ 'user-agent': ua }) }
    expect(buildTrace(req).browser).toBe('edge')
  })

  it('detects mobile device', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15'
    const req = { headers: makeHeaders({ 'user-agent': ua }) }
    expect(buildTrace(req).device).toBe('mobile')
  })

  it('detects desktop by default', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0'
    const req = { headers: makeHeaders({ 'user-agent': ua }) }
    expect(buildTrace(req).device).toBe('desktop')
  })

  it('applies userId and tenantId from opts', () => {
    const req = { headers: makeHeaders({ 'user-agent': '' }) }
    const trace = buildTrace(req, { userId: 'u1', tenantId: 't1', sessionId: 's1' })
    expect(trace.userId).toBe('u1')
    expect(trace.tenantId).toBe('t1')
    expect(trace.sessionId).toBe('s1')
  })

  it('generates a unique requestId each call', () => {
    const req = { headers: makeHeaders({ 'user-agent': '' }) }
    const t1 = buildTrace(req)
    const t2 = buildTrace(req)
    expect(t1.requestId).not.toBe(t2.requestId)
  })
})

describe('buildServerTrace()', () => {
  it('returns null ip, device, browser', () => {
    const trace = buildServerTrace({ userId: 'u1' })
    expect(trace.ip).toBeNull()
    expect(trace.device).toBeNull()
    expect(trace.browser).toBeNull()
  })

  it('assigns userId and generates requestId', () => {
    const trace = buildServerTrace({ userId: 'u1' })
    expect(trace.userId).toBe('u1')
    expect(typeof trace.requestId).toBe('string')
  })
})
