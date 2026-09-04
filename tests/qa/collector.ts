/**
 * tests/qa/collector.ts — EvidenceCollector
 *
 * Wrapper autour de Playwright Page. Intercepte automatiquement :
 *   - console (logs, erreurs, warnings React)
 *   - réseau (toutes les requêtes, erreurs, timing)
 *   - mémoire JS heap
 *   - mutations DOM (proxy re-renders React)
 *   - WebSocket (proxy Realtime Supabase)
 *
 * Usage dans un test :
 *   const ec = new EvidenceCollector(page, outDir)
 *   await ec.start('S1', 'Créer compte Entrepreneur')
 *   await ec.before()
 *   // ... actions ...
 *   await ec.after()
 *   ec.addSqlProof({ label: 'Vérif tenant', query, result, rows: 1, durationMs: 12 })
 *   const evidence = await ec.end('PASS')
 */

import type { Page, ConsoleMessage, Request, Response } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  ScenarioEvidence, ConsoleLine, NetworkRequest,
  SqlProof, PerfMetrics, ScenarioStatus,
} from './types.js'

const SUPABASE_HOST_RE  = /supabase\.co/
const REALTIME_RE       = /realtime|websocket/i
const REACT_WARN_RE     = /^Warning:.*React|^Warning:.*unknown prop/i
const REACT_ERR_RE      = /Minified React error|react-dom/i

export class EvidenceCollector {
  private page:        Page
  private outDir:      string
  private scenarioId   = ''
  private scenarioName = ''
  private startTime    = 0

  private consoleLogs:   ConsoleLine[]     = []
  private requests:      NetworkRequest[]  = []
  private sqlProofs:     SqlProof[]        = []

  // Playwright listeners (stored to remove them in end())
  private onConsole!:     (msg: ConsoleMessage) => void
  private onRequest!:     (req: Request) => void
  private onResponse!:    (res: Response) => void
  private onReqFailed!:   (req: Request) => void
  private reqStartMap:    Map<string, number> = new Map()
  private wsCount         = 0

  constructor(page: Page, outDir: string) {
    this.page   = page
    this.outDir = outDir
    fs.mkdirSync(outDir, { recursive: true })
  }

  // ── Start scenario evidence ──────────────────────────────────────────────

  async start(id: string, name: string): Promise<void> {
    this.scenarioId   = id
    this.scenarioName = name
    this.startTime    = Date.now()
    this.consoleLogs  = []
    this.requests     = []
    this.sqlProofs    = []
    this.reqStartMap  = new Map()
    this.wsCount      = 0

    // Console interceptor
    this.onConsole = (msg: ConsoleMessage) => {
      const text    = msg.text()
      const isReact = REACT_WARN_RE.test(text) || REACT_ERR_RE.test(text)
      this.consoleLogs.push({
        type:    msg.type() as ConsoleLine['type'],
        text,
        ts:      Date.now() - this.startTime,
        isReact,
      })
    }

    // Request start (capture timestamp)
    this.onRequest = (req: Request) => {
      this.reqStartMap.set(req.url(), Date.now())
      if (REALTIME_RE.test(req.url()) || req.url().startsWith('ws://') || req.url().startsWith('wss://')) {
        this.wsCount++
      }
    }

    // Response (compute timing + log)
    this.onResponse = (res: Response) => {
      const url      = res.url()
      const reqStart = this.reqStartMap.get(url) ?? this.startTime
      const dur      = Date.now() - reqStart

      res.body().then(body => {
        this.requests.push({
          url,
          method:     res.request().method(),
          status:     res.status(),
          duration:   dur,
          size:       body?.length ?? 0,
          isSupabase: SUPABASE_HOST_RE.test(url),
          isRealtime: REALTIME_RE.test(url),
          ts:         Date.now() - this.startTime,
        })
      }).catch(() => {
        this.requests.push({
          url,
          method:     res.request().method(),
          status:     res.status(),
          duration:   dur,
          size:       0,
          isSupabase: SUPABASE_HOST_RE.test(url),
          isRealtime: REALTIME_RE.test(url),
          ts:         Date.now() - this.startTime,
        })
      })
    }

    // Failed requests
    this.onReqFailed = (req: Request) => {
      const url      = req.url()
      const reqStart = this.reqStartMap.get(url) ?? this.startTime
      this.requests.push({
        url,
        method:     req.method(),
        status:     null,
        duration:   Date.now() - reqStart,
        size:       0,
        isSupabase: SUPABASE_HOST_RE.test(url),
        isRealtime: REALTIME_RE.test(url),
        error:      req.failure()?.errorText,
        ts:         Date.now() - this.startTime,
      })
    }

    this.page.on('console',       this.onConsole)
    this.page.on('request',       this.onRequest)
    this.page.on('response',      this.onResponse)
    this.page.on('requestfailed', this.onReqFailed)

    // Inject DOM mutation counter
    await this.page.evaluate(() => {
      ; (window as unknown as Record<string, unknown>)._qa_mutations = 0
      const obs = new MutationObserver(muts => {
        ; (window as unknown as Record<string, unknown>)._qa_mutations =
          ((window as unknown as Record<string, unknown>)._qa_mutations as number) + muts.length
      })
      obs.observe(document.body, { childList: true, subtree: true, attributes: true })
      ; (window as unknown as Record<string, unknown>)._qa_observer = obs
    }).catch(() => { /* page not ready — ignore */ })
  }

  // ── Screenshots ──────────────────────────────────────────────────────────

  async before(): Promise<string> {
    const p = this._screenshotPath('before')
    await this.page.screenshot({ path: p, fullPage: false })
    return p
  }

  async after(): Promise<string> {
    const p = this._screenshotPath('after')
    await this.page.screenshot({ path: p, fullPage: false })
    return p
  }

  // ── SQL Proofs ───────────────────────────────────────────────────────────

  addSqlProof(proof: SqlProof): void {
    this.sqlProofs.push(proof)
  }

  // ── End + collect ────────────────────────────────────────────────────────

  async end(status: ScenarioStatus, failReason?: string): Promise<ScenarioEvidence> {
    const endTime = Date.now()

    // Performance metrics from browser
    const perf = await this._collectPerf()

    // Screenshots (if not already taken — defensive)
    const beforePath = this._screenshotPath('before')
    const afterPath  = this._screenshotPath('after')
    if (!fs.existsSync(beforePath)) await this.page.screenshot({ path: beforePath }).catch(() => {})
    if (!fs.existsSync(afterPath))  await this.page.screenshot({ path: afterPath  }).catch(() => {})

    // Remove listeners
    this.page.off('console',       this.onConsole)
    this.page.off('request',       this.onRequest)
    this.page.off('response',      this.onResponse)
    this.page.off('requestfailed', this.onReqFailed)

    const networkErrors   = this.requests.filter(r => r.status === null || r.status >= 500)
    const supabaseReqs    = this.requests.filter(r => r.isSupabase)
    const consoleErrors   = this.consoleLogs.filter(l => l.type === 'error')
    const reactWarnings   = this.consoleLogs.filter(l => l.isReact && l.type === 'warn')

    return {
      id:               this.scenarioId,
      name:             this.scenarioName,
      status,
      failReason,
      startTime:        this.startTime,
      endTime,
      durationMs:       endTime - this.startTime,
      screenshotBefore: path.relative(this.outDir, beforePath),
      screenshotAfter:  path.relative(this.outDir, afterPath),
      consoleLogs:      this.consoleLogs,
      networkRequests:  this.requests,
      networkErrors,
      supabaseRequests: supabaseReqs,
      sqlProofs:        this.sqlProofs,
      perf: {
        ...perf,
        requestCount:  this.requests.length,
        consoleErrors: consoleErrors.length,
        consoleWarnings: this.consoleLogs.filter(l => l.type === 'warn').length,
        reactWarnings: reactWarnings.length,
        realtimeSubs:  this.wsCount,
        apiTimeMs:     this._avgDuration(this.requests.filter(r => !r.isRealtime)),
        sqlTimeMs:     this._avgDuration(supabaseReqs),
      },
    }
  }

  // ── Privates ─────────────────────────────────────────────────────────────

  private _screenshotPath(phase: 'before' | 'after'): string {
    const safe = this.scenarioId.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    return path.join(this.outDir, `${safe}_${phase}.png`)
  }

  private async _collectPerf(): Promise<Partial<PerfMetrics>> {
    try {
      return await this.page.evaluate(() => {
        const nav   = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        const mem   = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
        const muts  = (window as unknown as Record<string, unknown>)._qa_mutations as number ?? 0
        return {
          loadTimeMs:   nav ? Math.round(nav.loadEventEnd) : 0,
          memoryUsedMb: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024 * 10) / 10 : 0,
          domMutations: muts,
        }
      })
    } catch {
      return { loadTimeMs: 0, memoryUsedMb: 0, domMutations: 0 }
    }
  }

  private _avgDuration(reqs: NetworkRequest[]): number {
    if (!reqs.length) return 0
    return Math.round(reqs.reduce((s, r) => s + r.duration, 0) / reqs.length)
  }
}
