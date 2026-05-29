/**
 * lib/monitoring.ts — Logging centralisé pour Oraforme ERP
 * Erreurs frontend → console structuré + Supabase error_logs (si configuré)
 * Usage : import { logError, logInfo, logPerf } from '@/lib/monitoring'
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export interface LogEntry {
  level:      LogLevel
  message:    string
  module?:    string
  tenant_id?: string
  user_id?:   string
  data?:      unknown
  duration_ms?: number
  timestamp:  string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === 'development'
const IS_SERVER = typeof window === 'undefined'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(entry: LogEntry): string {
  const ts  = new Date(entry.timestamp).toISOString().slice(11, 23)
  const lvl = entry.level.toUpperCase().padEnd(8)
  const mod = entry.module ? `[${entry.module}] ` : ''
  const tid = entry.tenant_id ? `tenant:${entry.tenant_id.slice(0, 8)} ` : ''
  return `${ts} ${lvl} ${tid}${mod}${entry.message}`
}

// ─── Core logger ──────────────────────────────────────────────────────────────

function log(level: LogLevel, message: string, context?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  }

  if (IS_DEV || level === 'error' || level === 'critical') {
    const text = fmt(entry)
    switch (level) {
      case 'debug':    console.debug(text, context?.data ?? ''); break
      case 'info':     console.info(text,  context?.data ?? ''); break
      case 'warn':     console.warn(text,  context?.data ?? ''); break
      case 'error':
      case 'critical': console.error(text, context?.data ?? ''); break
    }
  }

  // En production, envoyer les erreurs critiques vers l'API de monitoring
  if (!IS_DEV && !IS_SERVER && (level === 'error' || level === 'critical')) {
    persistError(entry).catch(() => {})
  }
}

async function persistError(entry: LogEntry) {
  try {
    await fetch('/api/monitoring/log', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(entry),
      // Ne pas bloquer l'UI — fire and forget
      signal:  AbortSignal.timeout(3000),
    })
  } catch {
    // Silencieux — ne pas créer une boucle d'erreur
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

export function logDebug(message: string, context?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) {
  log('debug', message, context)
}

export function logInfo(message: string, context?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) {
  log('info', message, context)
}

export function logWarn(message: string, context?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) {
  log('warn', message, context)
}

export function logError(message: string, error?: unknown, context?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp' | 'data'>>) {
  log('error', message, {
    ...context,
    data: error instanceof Error
      ? { name: error.name, message: error.message, stack: IS_DEV ? error.stack : undefined }
      : error,
  })
}

export function logCritical(message: string, error?: unknown, context?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp' | 'data'>>) {
  log('critical', message, {
    ...context,
    data: error instanceof Error
      ? { name: error.name, message: error.message, stack: IS_DEV ? error.stack : undefined }
      : error,
  })
}

// ─── Performance helper ────────────────────────────────────────────────────────

export function logPerf(module: string, operation: string, startMs: number, context?: { tenant_id?: string }) {
  const duration_ms = Math.round(performance.now() - startMs)
  const level: LogLevel = duration_ms > 5000 ? 'warn' : duration_ms > 2000 ? 'info' : 'debug'
  log(level, `${operation} — ${duration_ms}ms`, { module, duration_ms, ...context })
}

/**
 * Wrapper pour mesurer automatiquement la durée d'une fonction async.
 * Usage: const result = await withPerf('factures', 'load', () => supabase.from(...).select(...))
 */
export async function withPerf<T>(
  module: string,
  operation: string,
  fn: () => Promise<T>,
  context?: { tenant_id?: string }
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    logPerf(module, operation, start, context)
    return result
  } catch (e) {
    logError(`${operation} failed`, e, { module, ...context })
    throw e
  }
}

// ─── Error boundary helper ────────────────────────────────────────────────────

export function captureSupabaseError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
  context?: { module?: string; tenant_id?: string }
) {
  if (!error) return
  log('error', `Supabase error in ${operation}: ${error.message ?? 'unknown'}`, {
    ...context,
    data: { code: error.code, details: error.details },
  })
}
