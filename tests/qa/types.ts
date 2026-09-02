/**
 * tests/qa/types.ts — Types pour le protocole QA-001 (Evidence-Based Certification)
 *
 * Règle : aucun scénario ne peut être PASS sans preuve.
 * S'applique à toutes les certifications C-001 à C-016.
 */

export type ScenarioStatus = 'PASS' | 'FAIL' | 'SKIP'

export interface ConsoleLine {
  type:    'log' | 'info' | 'warn' | 'error' | 'debug'
  text:    string
  ts:      number   // ms depuis startTime
  isReact: boolean  // "Warning: React..." ou "Error: Minified React error"
}

export interface NetworkRequest {
  url:        string
  method:     string
  status:     number | null
  duration:   number  // ms
  size:       number  // bytes (response body)
  isSupabase: boolean
  isRealtime: boolean
  error?:     string
  ts:         number  // ms depuis startTime
}

export interface SqlProof {
  label:   string
  query:   string
  result:  unknown
  rows:    number
  durationMs: number
}

export interface PerfMetrics {
  loadTimeMs:         number   // navigation.loadEventEnd
  requestCount:       number
  apiTimeMs:          number   // moyenne des temps de réponse API
  sqlTimeMs:          number   // moyenne Supabase REST
  memoryUsedMb:       number   // JS heap (Chrome seulement)
  domMutations:       number   // proxy pour React re-renders
  consoleErrors:      number
  consoleWarnings:    number
  reactWarnings:      number
  realtimeSubs:       number   // WS connections actives
}

export interface ScenarioEvidence {
  id:              string   // 'S1', 'S2', …
  name:            string
  status:          ScenarioStatus
  failReason?:     string
  startTime:       number   // Date.now()
  endTime:         number
  durationMs:      number
  screenshotBefore: string   // chemin relatif
  screenshotAfter:  string   // chemin relatif
  consoleLogs:     ConsoleLine[]
  networkRequests: NetworkRequest[]
  networkErrors:   NetworkRequest[]
  supabaseRequests: NetworkRequest[]
  sqlProofs:       SqlProof[]
  perf:            PerfMetrics
}

export interface CertificationReport {
  id:        string   // 'C-002.1'
  title:     string
  date:      string
  commit?:   string
  project?:  string
  env:       string
  scenarios: ScenarioEvidence[]
  verdict:   'CERTIFIED' | 'REJECTED' | 'PARTIAL'
  passCount: number
  failCount: number
  skipCount: number
}
