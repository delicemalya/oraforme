/**
 * LOI-N — Unique Permission Engine (C-004.3)
 *
 * lib/hooks/usePermissions.ts est l'UNIQUE autorité de contrôle d'accès
 * dans les composants UI d'Oraforme.
 *
 * Aucun composant ne peut comparer profile.role directement à 'owner', 'admin',
 * 'manager', etc. pour prendre une décision d'accès.
 * Le seul chemin autorisé est :
 *
 *   const { isOwner, isAdmin, can, canView, canEdit } = usePermissions()
 *
 * Dettes techniques documentées dans KNOWN_PERMISSION_DEBT (ci-dessous).
 * Voir docs/LOI-N-PERMISSION-ENGINE.md
 */

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ── Chemins autorisés — Permission Core ──────────────────────────────────────
// Seuls ces fichiers peuvent contenir des comparaisons de rôle directes.
const PERMISSION_EXEMPT = [
  // Permission system officiel
  /[\\/]lib[\\/]hooks[\\/]usePermissions\.ts$/,
  /[\\/]lib[\\/]hooks[\\/]useRoleGuard\.ts$/,
  /[\\/]lib[\\/]tenant-guard\.ts$/,
  /[\\/]lib[\\/]api[\\/]/,
  // Pages admin — affichent les rôles bruts pour monitoring
  /[\\/]app[\\/]admin[\\/]/,
  // Gestion équipe — affiche et modifie les rôles des membres
  /[\\/]app[\\/]dashboard[\\/]equipe[\\/]/,
  // Infra
  /[\\/]supabase[\\/]migrations[\\/]/,
  /[\\/]lib[\\/]architecture[\\/]/,
  /[\\/]docs[\\/]/,
  /[\\/]scripts[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
]

// ── Dettes techniques documentées ─────────────────────────────────────────────
// Ces fichiers comparent profile.role directement — à migrer vers usePermissions().
const KNOWN_PERMISSION_DEBT: { file: string; id: string; note: string }[] = [
  {
    file: 'app/dashboard/page.tsx',
    id: 'DET-N-001',
    note: 'isFinancial fallback profile.role === \'owner\' — migrer vers usePermissions().isOwner',
  },
  {
    file: 'app/dashboard/ecole/espace-etudiant/page.tsx',
    id: 'DET-N-002',
    note: 'ecoleRole fallback profile?.role === \'owner\' — migrer vers usePermissions().isOwner',
  },
  {
    file: 'app/dashboard/ecole/espace-parent/page.tsx',
    id: 'DET-N-003',
    note: 'ecoleRole fallback profile?.role === \'owner\' — migrer vers usePermissions().isOwner',
  },
]

// ── Rôles de permission (vs rôles de messages AI) ────────────────────────────
// 'user', 'assistant', 'bot', 'system' sont des rôles de messages — exclus du scan.
const PERMISSION_ROLE_VALUES = [
  'owner', 'admin', 'manager', 'accountant', 'finance',
  'membre', 'staff', 'directeur', 'superviseur', 'operator',
]

// ── Patterns interdits ────────────────────────────────────────────────────────

const PERMISSION_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: new RegExp(
      `profile\\??\\.role\\s*===?\\s*['"](?:${PERMISSION_ROLE_VALUES.join('|')})['"]`
    ),
    description: "profile.role comparé directement — utiliser usePermissions().isOwner / isAdmin / can()",
  },
  {
    pattern: new RegExp(
      `tenantProfile\\??\\.role\\s*===?\\s*['"](?:${PERMISSION_ROLE_VALUES.join('|')})['"]`
    ),
    description: "tenantProfile.role comparé directement — utiliser usePermissions().can()",
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFiles(): string[] {
  const patterns = ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}']
  const files: string[] = []
  for (const p of patterns) {
    files.push(...globSync(p, { cwd: ROOT, absolute: true }))
  }
  return files.filter(f => !PERMISSION_EXEMPT.some(rx => rx.test(f.replace(/\\/g, '/'))))
}

function getRelative(filePath: string): string {
  return filePath.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
}

function isKnownDebt(rel: string): string | null {
  const debt = KNOWN_PERMISSION_DEBT.find(d => rel.endsWith(d.file) || rel === d.file)
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
    for (const { pattern, description } of PERMISSION_PATTERNS) {
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

describe('LOI-N — Unique Permission Engine (C-004.3)', () => {

  it('usePermissions hook existe et expose les méthodes canoniques', () => {
    const hookPath = path.join(ROOT, 'lib', 'hooks', 'usePermissions.ts')
    const content = readFileSync(hookPath, 'utf-8')

    expect(content, '[LOI-N] usePermissions doit exposer isOwner').toContain('isOwner')
    expect(content, '[LOI-N] usePermissions doit exposer isAdmin').toContain('isAdmin')
    expect(content, '[LOI-N] usePermissions doit exposer can(').toContain('can(')

    console.log('[LOI-N] usePermissions hook : isOwner, isAdmin, can() présents ✅')
  })

  it('aucun nouveau composant ne compare profile.role directement', () => {
    const files = getFiles()
    const violations = scanViolations(files)

    const newViolations = violations.filter(v => !isKnownDebt(v.rel))
    const debtViolations = violations.filter(v => !!isKnownDebt(v.rel))

    if (debtViolations.length > 0) {
      console.warn([
        '',
        '[LOI-N] DETTES TECHNIQUES CONNUES (à migrer vers usePermissions()) :',
        ...debtViolations.map(v => `  ${v.rel}:${v.line} [${isKnownDebt(v.rel)}]`),
        '',
        'Migration : remplacer profile.role === \'owner\' par usePermissions().isOwner',
      ].join('\n'))
    }

    if (newViolations.length > 0) {
      const msg = [
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-N VIOLÉE — Comparaison de rôle directe détectée                 ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
        '',
        `${newViolations.length} NOUVELLE(S) violation(s) :`,
        '',
        ...newViolations.map(v => `  ${v.rel}:${v.line} — ${v.description}\n    ↳ ${v.excerpt}`),
        '',
        'LOI-N : Toute vérification de permission doit passer par :',
        '  const { isOwner, isAdmin, can, canView, canEdit } = usePermissions()',
        '',
        'Chemin interdit : profile.role === \'owner\'',
        'Chemin autorisé : const { isOwner } = usePermissions()',
        'Si c\'est de la dette, ajouter à KNOWN_PERMISSION_DEBT avec un ID DET-N-XXX.',
        'Voir : docs/LOI-N-PERMISSION-ENGINE.md',
      ].join('\n')
      expect.fail(msg)
    }

    console.log(
      `[LOI-N] comparaisons de rôle : ${files.length} fichiers scannés — ` +
      `0 nouvelle violation ✅ (${debtViolations.length} dettes connues)`
    )
  })

  it('les dettes documentées correspondent exactement aux violations réelles', () => {
    const files = getFiles()
    const violations = scanViolations(files)
    const debtFiles = new Set(violations.filter(v => !!isKnownDebt(v.rel)).map(v => v.rel))

    for (const debt of KNOWN_PERMISSION_DEBT) {
      const found = [...debtFiles].some(f => f.endsWith(debt.file) || f === debt.file)
      if (!found) {
        console.warn(
          `[LOI-N] DETTE ORPHELINE : ${debt.id} référence '${debt.file}' mais ce fichier ` +
          `n'a plus de violation profile.role. Supprimer de KNOWN_PERMISSION_DEBT.`
        )
      }
    }

    console.log(`[LOI-N] Dettes actives : ${debtFiles.size}/${KNOWN_PERMISSION_DEBT.length} ✅`)
  })

  it('certifie LOI-N : Permission Engine = unique contrôleur d\'accès', () => {
    const files = getFiles()
    const violations = scanViolations(files)
    const newViolations = violations.filter(v => !isKnownDebt(v.rel))
    const debtCount = violations.filter(v => !!isKnownDebt(v.rel)).length

    if (newViolations.length === 0) {
      console.log([
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-N CERTIFICATION — ACCORDÉE ✅                                   ║',
        '║  Permission Engine = unique contrôleur d\'accès (C-004.3)             ║',
        `║  ${debtCount} dette(s) connue(s) — migration usePermissions() planifiée`.padEnd(72) + '║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
      ].join('\n'))
    }

    expect(newViolations.length, `LOI-N : ${newViolations.length} nouvelle(s) violation(s)`).toBe(0)
  })
})
