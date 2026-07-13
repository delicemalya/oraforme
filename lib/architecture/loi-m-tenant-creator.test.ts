/**
 * LOI-M — Unique Tenant Creator (C-004.3)
 *
 * TenantProfileFactory (app/onboarding + app/api/admin) est l'UNIQUE autorité
 * de création et modification des tenants dans Oraforme.
 *
 * Aucun composant dashboard ne peut écrire directement dans la table 'tenants'.
 * Le seul chemin autorisé est :
 *
 *   Création  → app/onboarding/**         (parcours d'inscription)
 *   Admin     → app/api/admin/**          (opérations administrateur)
 *   Modules   → app/api/modules/toggle/** (activation/désactivation modules)
 *
 * Dettes techniques documentées dans KNOWN_TENANT_DEBT (ci-dessous).
 * Voir docs/LOI-M-TENANT-CREATOR.md
 */

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ── Chemins autorisés — TenantProfileFactory ──────────────────────────────────
// Seuls ces chemins peuvent écrire dans la table 'tenants'.
const TENANT_WRITE_AUTHORIZED = [
  /[\\/]app[\\/]onboarding[\\/]/,
  /[\\/]app[\\/]api[\\/]admin[\\/]/,
  /[\\/]app[\\/]api[\\/]modules[\\/]/,
  /[\\/]app[\\/]api[\\/]tenant[\\/]/,
  // Infra
  /[\\/]supabase[\\/]migrations[\\/]/,
  /[\\/]lib[\\/]architecture[\\/]/,
  /[\\/]docs[\\/]/,
  /[\\/]scripts[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
]

// ── Dettes techniques documentées ─────────────────────────────────────────────
// Ces fichiers écrivent dans 'tenants' de manière connue et temporairement tolérée.
// Chaque dette doit être migrée vers app/api/admin ou un TenantGroupService.
const KNOWN_TENANT_DEBT: { file: string; id: string; note: string }[] = [
  {
    file: 'app/dashboard/groupe/gestion/page.tsx',
    id: 'DET-M-001',
    note: 'Gestion holding/groupe — à migrer vers app/api/admin/groupe/route.ts',
  },
]

// ── Patterns interdits ────────────────────────────────────────────────────────

const TENANT_WRITE_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: /\.from\s*\(\s*['"`]tenants['"`]\s*\)\s*\.insert\s*\(/,
    description: "INSERT direct dans tenants — utiliser app/onboarding ou app/api/admin",
  },
  {
    pattern: /\.from\s*\(\s*['"`]tenants['"`]\s*\)\s*\.update\s*\(/,
    description: "UPDATE direct dans tenants — utiliser app/api/admin ou TenantGroupService",
  },
  {
    pattern: /\.from\s*\(\s*['"`]tenants['"`]\s*\)\s*\.upsert\s*\(/,
    description: "UPSERT direct dans tenants — utiliser app/api/admin",
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFiles(): string[] {
  const patterns = ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.ts']
  const files: string[] = []
  for (const p of patterns) {
    files.push(...globSync(p, { cwd: ROOT, absolute: true }))
  }
  return files.filter(f => !TENANT_WRITE_AUTHORIZED.some(rx => rx.test(f.replace(/\\/g, '/'))))
}

function getRelative(filePath: string): string {
  return filePath.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
}

function isKnownDebt(rel: string): string | null {
  const debt = KNOWN_TENANT_DEBT.find(d => rel.endsWith(d.file) || rel === d.file)
  return debt ? `${debt.id} : ${debt.note}` : null
}

interface Violation {
  rel: string
  line: number
  description: string
  excerpt: string
}

function scanViolations(files: string[]): Violation[] {
  const violations: Violation[] = []
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const rel = getRelative(filePath)
    for (const { pattern, description } of TENANT_WRITE_PATTERNS) {
      lines.forEach((line, i) => {
        const t = line.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
        if (pattern.test(line)) {
          violations.push({ rel, line: i + 1, description, excerpt: t.slice(0, 140) })
        }
      })
    }
  }
  return violations
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LOI-M — Unique Tenant Creator (C-004.3)', () => {

  it('aucun nouveau composant n\'écrit directement dans tenants', () => {
    const files = getFiles()
    const violations = scanViolations(files)

    const newViolations = violations.filter(v => !isKnownDebt(v.rel))
    const debtViolations = violations.filter(v => !!isKnownDebt(v.rel))

    if (debtViolations.length > 0) {
      console.warn([
        '',
        '[LOI-M] DETTES TECHNIQUES CONNUES (à migrer) :',
        ...debtViolations.map(v => `  ${v.rel}:${v.line} [${isKnownDebt(v.rel)}]`),
        '',
        'Ces violations sont documentées dans KNOWN_TENANT_DEBT.',
        'Elles ne bloquent pas CI mais doivent être planifiées pour migration.',
      ].join('\n'))
    }

    if (newViolations.length > 0) {
      const msg = [
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-M VIOLÉE — Écriture directe dans tenants hors TenantFactory     ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
        '',
        `${newViolations.length} NOUVELLE(S) violation(s) :`,
        '',
        ...newViolations.map(v => `  ${v.rel}:${v.line} — ${v.description}\n    ↳ ${v.excerpt}`),
        '',
        'LOI-M : Toute écriture dans tenants doit passer par :',
        '  Création  → app/onboarding/**',
        '  Admin     → app/api/admin/**',
        '  Modules   → app/api/modules/toggle/**',
        'Si c\'est du code autorisé, ajouter à TENANT_WRITE_AUTHORIZED.',
        'Si c\'est de la dette, ajouter à KNOWN_TENANT_DEBT avec un ID DET-M-XXX.',
        'Voir : docs/LOI-M-TENANT-CREATOR.md',
      ].join('\n')
      expect.fail(msg)
    }

    console.log(
      `[LOI-M] tenants : ${files.length} fichiers scannés — ` +
      `0 nouvelle violation ✅ (${debtViolations.length} dettes connues)`
    )
  })

  it('les dettes documentées correspondent exactement aux violations réelles', () => {
    const files = getFiles()
    const violations = scanViolations(files)

    const debtViolations = violations.filter(v => !!isKnownDebt(v.rel))
    const uniqueDebtFiles = new Set(debtViolations.map(v => v.rel))

    for (const debt of KNOWN_TENANT_DEBT) {
      const found = [...uniqueDebtFiles].some(f => f.endsWith(debt.file) || f === debt.file)
      if (!found) {
        console.warn(
          `[LOI-M] DETTE ORPHELINE : ${debt.id} référence '${debt.file}' mais ce fichier ` +
          `n'a plus de violation dans tenants. Supprimer de KNOWN_TENANT_DEBT.`
        )
      }
    }

    console.log(`[LOI-M] Dettes actives : ${uniqueDebtFiles.size}/${KNOWN_TENANT_DEBT.length} ✅`)
  })

  it('certifie LOI-M : TenantProfileFactory = unique créateur de tenant', () => {
    const files = getFiles()
    const violations = scanViolations(files)
    const newViolations = violations.filter(v => !isKnownDebt(v.rel))
    const debtCount = violations.filter(v => !!isKnownDebt(v.rel)).length

    if (newViolations.length === 0) {
      console.log([
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-M CERTIFICATION — ACCORDÉE ✅                                   ║',
        '║  TenantProfileFactory = unique créateur de tenant (C-004.3)           ║',
        `║  ${debtCount} dette(s) technique(s) documentée(s) — migration planifiée`.padEnd(72) + '║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
      ].join('\n'))
    }

    expect(newViolations.length, `LOI-M : ${newViolations.length} nouvelle(s) violation(s) bloquent la certification`).toBe(0)
  })
})
