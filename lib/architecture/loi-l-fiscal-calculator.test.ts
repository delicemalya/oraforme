/**
 * LOI-L — Unique Fiscal Calculator (C-004.3)
 *
 * lib/fiscal/universal-tax-engine.ts + lib/fiscalite/* + lib/contexts/PaysContext.tsx
 * constituent l'UNIQUE autorité de calcul fiscal dans Oraforme.
 *
 * Aucun composant applicatif ne peut multiplier directement par un taux TVA/IS/CNSS
 * codé en dur (ex : montantHT * 0.18). Le seul chemin autorisé est :
 *
 *   UI      → const { calculerTVA } = usePays()       (PaysContext)
 *   Serveur → lib/fiscal/universal-tax-engine.ts
 *   Décl.   → lib/fiscalite/engine.ts
 *
 * Voir docs/LOI-L-FISCAL-CALCULATOR.md
 */

import { readFileSync, existsSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ── Chemins exemptés — fiscal engines (autorisés à contenir des taux) ────────
const FISCAL_EXEMPT = [
  // Moteurs officiels
  /[\\/]lib[\\/]fiscal[\\/]/,
  /[\\/]lib[\\/]fiscalite[\\/]/,
  /[\\/]lib[\\/]fiscalite-\w/,            // fiscalite-congo.ts, fiscalite-cameroun.ts …
  /[\\/]lib[\\/]countries[\\/]/,
  /[\\/]lib[\\/]contexts[\\/]PaysContext\.tsx$/,
  // Engines dérivés légitimes
  /[\\/]lib[\\/]accounting-engine\.ts$/,
  /[\\/]lib[\\/]audit[\\/]/,
  /[\\/]lib[\\/]scenarios[\\/]/,
  /[\\/]lib[\\/]conventions[\\/]/,
  /[\\/]lib[\\/]miaa/,
  /[\\/]lib[\\/]payroll[\\/]/,
  // Routes agents IA — utilisent des pourcentages de scoring, pas des taux fiscaux
  /[\\/]app[\\/]api[\\/]agents[\\/]/,
  // Onboarding UI — animations et transitions (ex: delay: i * 0.18)
  /[\\/]components[\\/]onboarding[\\/]/,
  // Tests de ces engines
  /\.test\.ts$/,
  /\.test\.tsx$/,
  // Infra
  /[\\/]supabase[\\/]migrations[\\/]/,
  /[\\/]lib[\\/]architecture[\\/]/,
  /[\\/]docs[\\/]/,
  /[\\/]scripts[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
]

// ── Dettes techniques documentées ─────────────────────────────────────────────
// Ces fichiers calculent TVA inline — à migrer vers calculerTVA() de usePays().
const KNOWN_FISCAL_DEBT: { file: string; id: string; note: string }[] = [
  {
    file: 'app/api/cabinet/clients/[id]/factures/route.ts',
    id: 'DET-L-001',
    note: 'const tva = Math.round(ht * 0.18) — migrer vers calculerTVA(ht, \'CG\') du fiscal engine',
  },
  {
    file: 'app/dashboard/cabinet/clients/[id]/page.tsx',
    id: 'DET-L-002',
    note: 'TVA 18% hardcodée (2 occurrences) — migrer vers calculerTVA() via usePays() ou PaysContext',
  },
  {
    file: 'app/dashboard/finance/page.tsx',
    id: 'DET-L-003',
    note: 'Estimation TVA sur entrees/sorties * 0.18 (3 occurrences) — migrer vers estimationTVA() du fiscal engine',
  },
]

// ── Taux fiscaux CEMAC interdits hors engines ─────────────────────────────────
// Patterns ciblés : multiplication d'une variable fiscale par un taux TVA CEMAC.
// Variables fiscales typiques : ht, montant, base, ca_annee, entrees, sorties, prix
// EXCLUT les faux positifs : i * 0.18 (animation), threshold * 0.15 (ratio scoring)
const FISCAL_VAR = '(?:ht|montant(?:HT|_ht)?|base(?:HT|_ht)?|prix(?:HT|_ht)?|ca_annee|ca_ht|entrees|sorties|income|revenue|valeur|value)'
const FISCAL_RATE_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: new RegExp(`${FISCAL_VAR}\\s*\\*\\s*0\\.18\\b`, 'i'),
    description: 'Taux TVA 18% codé en dur (Congo/Gabon/Tchad/RCA) — utiliser calculerTVA() de usePays()',
  },
  {
    pattern: new RegExp(`${FISCAL_VAR}\\s*\\*\\s*0\\.175\\b`, 'i'),
    description: 'Taux TVA 17.5% codé en dur (Cameroun) — utiliser calculerTVA() de usePays()',
  },
  {
    pattern: new RegExp(`${FISCAL_VAR}\\s*\\*\\s*0\\.19\\b`, 'i'),
    description: 'Taux TVA 19% codé en dur (RCA) — utiliser calculerTVA() de usePays()',
  },
  {
    pattern: new RegExp(`${FISCAL_VAR}\\s*\\*\\s*0\\.16\\b`, 'i'),
    description: 'Taux TVA 16% codé en dur (RDC) — utiliser calculerTVA() de usePays()',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFiles(exemptions: RegExp[]): string[] {
  const patterns = ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.ts']
  const files: string[] = []
  for (const p of patterns) {
    files.push(...globSync(p, { cwd: ROOT, absolute: true }))
  }
  return files.filter(f => !exemptions.some(rx => rx.test(f.replace(/\\/g, '/'))))
}

function getRelative(filePath: string): string {
  return filePath.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
}

function isKnownDebt(rel: string): string | null {
  const debt = KNOWN_FISCAL_DEBT.find(d => rel.endsWith(d.file) || rel === d.file)
  return debt ? `${debt.id} : ${debt.note}` : null
}

interface Violation { rel: string; line: number; description: string; excerpt: string }

function scanViolations(
  files: string[],
  patterns: { pattern: RegExp; description: string }[],
): Violation[] {
  const violations: Violation[] = []
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const rel = getRelative(filePath)
    for (const { pattern, description } of patterns) {
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

describe('LOI-L — Unique Fiscal Calculator (C-004.3)', () => {

  it('aucun composant métier ne multiplie par un taux TVA hardcodé', () => {
    const files = getFiles(FISCAL_EXEMPT)
    const violations = scanViolations(files, FISCAL_RATE_PATTERNS)

    const newViolations = violations.filter(v => !isKnownDebt(v.rel))
    const debtViolations = violations.filter(v => !!isKnownDebt(v.rel))

    if (debtViolations.length > 0) {
      console.warn([
        '',
        '[LOI-L] DETTES TECHNIQUES CONNUES (à migrer vers FiscalCalculationEngine) :',
        ...debtViolations.map(v => `  ${v.rel}:${v.line} [${isKnownDebt(v.rel)}]`),
        '',
        'Migration : remplacer ht * 0.18 par calculerTVA(ht) depuis usePays() ou universal-tax-engine.',
      ].join('\n'))
    }

    if (newViolations.length > 0) {
      const msg = [
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-L VIOLÉE — Calcul fiscal inline détecté hors FiscalEngine       ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
        '',
        `${newViolations.length} NOUVELLE(S) violation(s) :`,
        '',
        ...newViolations.map(v => `  ${v.rel}:${v.line} — ${v.description}\n    ↳ ${v.excerpt}`),
        '',
        'LOI-L : FiscalCalculationEngine est l\'unique autorité de calcul fiscal.',
        'Pour UI      : const { calculerTVA } = usePays() → { tva, ca, ttc, taux }',
        'Pour serveur : import { calculerTVA } from \'@/lib/fiscal/universal-tax-engine\'',
        'Pour décl.   : import { calculerTVA } from \'@/lib/fiscalite/engine\'',
        'Si c\'est de la dette, ajouter à KNOWN_FISCAL_DEBT avec un ID DET-L-XXX.',
        'Voir : docs/LOI-L-FISCAL-CALCULATOR.md',
      ].join('\n')
      expect.fail(msg)
    }

    console.log(
      `[LOI-L] taux hardcodés : ${files.length} fichiers scannés — ` +
      `0 nouvelle violation ✅ (${debtViolations.length} dettes connues)`
    )
  })

  it('PaysContext fournit calculerTVA comme méthode canonique UI', () => {
    const paysCtx = path.join(ROOT, 'lib', 'contexts', 'PaysContext.tsx')
    expect(existsSync(paysCtx), '[LOI-L] lib/contexts/PaysContext.tsx introuvable').toBe(true)
    const content = readFileSync(paysCtx, 'utf-8')
    expect(content, '[LOI-L] PaysContext.tsx doit exposer calculerTVA').toContain('calculerTVA')
    console.log('[LOI-L] PaysContext.calculerTVA : présente ✅')
  })

  it('universal-tax-engine existe et exporte calculerTVA', () => {
    const engine = path.join(ROOT, 'lib', 'fiscal', 'universal-tax-engine.ts')
    expect(existsSync(engine), '[LOI-L] lib/fiscal/universal-tax-engine.ts introuvable').toBe(true)
    const content = readFileSync(engine, 'utf-8')
    expect(content, '[LOI-L] universal-tax-engine.ts doit exporter calculerTVA').toContain('calculerTVA')
    console.log('[LOI-L] universal-tax-engine.ts : présent ✅')
  })

  it('certifie LOI-L : FiscalCalculationEngine = unique calculateur fiscal', () => {
    const files = getFiles(FISCAL_EXEMPT)
    const violations = scanViolations(files, FISCAL_RATE_PATTERNS)
    const newViolations = violations.filter(v => !isKnownDebt(v.rel))
    const debtCount = violations.filter(v => !!isKnownDebt(v.rel)).length

    if (newViolations.length === 0) {
      console.log([
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-L CERTIFICATION — ACCORDÉE ✅                                   ║',
        '║  FiscalCalculationEngine = unique calculateur fiscal (C-004.3)        ║',
        `║  ${debtCount} dette(s) technique(s) documentée(s) — migration planifiée`.padEnd(72) + '║',
        '║  TVA : calculerTVA() de usePays() ou universal-tax-engine UNIQUEMENT  ║',
        '║  Pays couverts : CG, CM, GA, TD, CF, GQ, CD (7 pays CEMAC + RDC)     ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
      ].join('\n'))
    }

    expect(newViolations.length, `LOI-L : ${newViolations.length} nouvelle(s) violation(s) bloquent la certification`).toBe(0)
  })
})
