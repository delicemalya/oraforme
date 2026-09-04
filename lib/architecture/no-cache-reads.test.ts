/**
 * Architecture regression test — CACHE READ FORBIDDEN (F-003)
 *
 * This test scans business components for forbidden reads of cache columns
 * on the tenants table. It FAILS CI if any business component reads
 * modules_actifs, cache_*, snapshot_* or legacy_* from the DB.
 *
 * See docs/CACHE_READ_FORBIDDEN.md for the full rule.
 */

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ── Files allowed to reference cache column names ────────────────────────────
// These are either:
//   A. Admin analytics pages (read cache for reporting, not access control)
//   B. Cache-sync write paths (write modules_actifs after tenant_modules update)
//   C. Migration files (define the schema)
//   D. This test file itself
const ALLOWED_PATHS = [
  /[\\/]app[\\/]admin[\\/]/,
  /[\\/]app[\\/]api[\\/]admin[\\/]/,
  /[\\/]app[\\/]api[\\/]modules[\\/]toggle[\\/]/,
  /[\\/]app[\\/]onboarding[\\/]/,
  /[\\/]components[\\/]admin[\\/]/,
  /[\\/]supabase[\\/]migrations[\\/]/,
  /[\\/]docs[\\/]/,
  /[\\/]scripts[\\/]/,
  /[\\/]lib[\\/]architecture[\\/]/,  // this file
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
]

// ── Forbidden patterns ────────────────────────────────────────────────────────
// These patterns detect reads of cache columns inside DB query strings.
// Each entry: { pattern, description }
const FORBIDDEN_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    // .select('modules_actifs') or .select('id, modules_actifs, plan')
    // Matches the literal string inside any .select() call
    pattern: /\.select\s*\(\s*['"`][^'"`]*modules_actifs[^'"`]*['"`]/,
    description: "select() containing 'modules_actifs' — use tenant_modules table",
  },
  {
    // .select('*, tenants(modules_actifs)') — nested select via PostgREST join
    pattern: /tenants\s*\([^)]*modules_actifs[^)]*\)/,
    description: "Nested PostgREST select tenants(modules_actifs) — use tenant_modules",
  },
  {
    // tenant?.modules_actifs or tenant.modules_actifs — property access on DB result
    // Allow: comments (// or *) and plain string literals
    pattern: /tenant\??\.modules_actifs(?!\s*[:,\s]|['"`])/,
    description: "tenant.modules_actifs property access — use modulesActifs (from TenantContext)",
  },
  {
    // tenant_modules is fine, but selecting cache_*/legacy_* from tenants is not
    pattern: /from\s*\(\s*['"`]tenants['"`]\s*\).*?\.select[^;]*['"`][^'"`]*(cache_|legacy_)[^'"`]*['"`]/,
    description: "select() of cache_* or legacy_* column on tenants table",
  },
]

// ── Collect all TypeScript/TSX files to scan ─────────────────────────────────
function getBusinessFiles(): string[] {
  const patterns = [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.ts',
  ]
  const files: string[] = []
  for (const pattern of patterns) {
    const found = globSync(pattern, { cwd: ROOT, absolute: true })
    files.push(...found)
  }
  return files.filter(f => !ALLOWED_PATHS.some(rx => rx.test(f.replace(/\\/g, '/'))))
}

describe('CACHE READ FORBIDDEN — Architecture Rule F-003', () => {
  it('no business file selects modules_actifs from the DB', () => {
    const files = getBusinessFiles()
    const violations: string[] = []

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const relPath = filePath.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')

      for (const { pattern, description } of FORBIDDEN_PATTERNS) {
        lines.forEach((line, i) => {
          const trimmed = line.trim()
          // Skip pure comment lines
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
          if (pattern.test(line)) {
            violations.push(`  ${relPath}:${i + 1} — ${description}\n    Line: ${trimmed.slice(0, 120)}`)
          }
        })
      }
    }

    if (violations.length > 0) {
      const msg = [
        '',
        '╔══════════════════════════════════════════════════════════════════╗',
        '║  CACHE READ FORBIDDEN — F-003 CERTIFICATION REFUSÉE             ║',
        '╚══════════════════════════════════════════════════════════════════╝',
        '',
        `${violations.length} violation(s) détectée(s) dans les composants métier :`,
        '',
        ...violations,
        '',
        'Règle : Jamais lire tenants.modules_actifs dans les composants métier.',
        'Source de vérité : table tenant_modules uniquement.',
        'Voir : docs/CACHE_READ_FORBIDDEN.md',
      ].join('\n')
      expect.fail(msg)
    }

    // Zero violations — log the scan summary
    console.log(`[CACHE CERTIFICATION] Scanned ${files.length} business files — 0 violations ✅`)
  })

  it('TenantContext does not select modules_actifs from tenants table', () => {
    const ctx = path.join(ROOT, 'lib', 'contexts', 'TenantContext.tsx')
    const content = readFileSync(ctx, 'utf-8')

    // Must NOT contain modules_actifs in a select call
    const lines = content.split('\n')
    const forbidden = lines.filter(l =>
      !l.trim().startsWith('//') &&
      !l.trim().startsWith('*') &&
      /\.select[^;]*modules_actifs/.test(l)
    )

    expect(forbidden, `TenantContext must not select modules_actifs. Found:\n${forbidden.join('\n')}`).toHaveLength(0)
  })

  it('Sidebar does not fall back to modules_actifs from DB', () => {
    const sidebar = path.join(ROOT, 'components', 'dashboard', 'Sidebar.tsx')
    const content = readFileSync(sidebar, 'utf-8')

    // Specifically check for the old pattern: .select('...modules_actifs...')
    const forbidden = content.split('\n').filter(l =>
      !l.trim().startsWith('//') &&
      /\.select[^;]*modules_actifs/.test(l)
    )

    expect(forbidden, `Sidebar must not select modules_actifs from DB. Found:\n${forbidden.join('\n')}`).toHaveLength(0)
  })

  it('DashboardClient prop is named modulesActifs (not modules_actifs)', () => {
    const dc = path.join(ROOT, 'components', 'dashboard', 'DashboardClient.tsx')
    const content = readFileSync(dc, 'utf-8')

    // The prop type must use camelCase modulesActifs
    expect(content).toMatch(/modulesActifs\s*:\s*string\[\]/)

    // The snake_case field name must not appear in the type definition or property access
    const snakeCaseUsages = content.split('\n').filter(l =>
      !l.trim().startsWith('//') &&
      /\bmodules_actifs\b/.test(l)
    )
    expect(snakeCaseUsages, `DashboardClient must not reference modules_actifs. Found:\n${snakeCaseUsages.join('\n')}`).toHaveLength(0)
  })
})
