// ── Unified FCFA formatter for the entire BI system ──────────────────────────

export function fmtFCFA(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' FCFA'
}

export function fmtShort(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1) + 'Md'
  if (abs >= 1_000_000)     return sign + (abs / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000)         return sign + (abs / 1_000).toFixed(0) + 'k'
  return sign + String(Math.round(abs))
}

export function fmtShortFCFA(n: number): string {
  return fmtShort(n) + ' FCFA'
}

export function fmtPct(n: number, decimals = 0): string {
  return n.toFixed(decimals) + '%'
}

export function fmtCount(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export function growthPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}
