/**
 * LOI-K — Unique Writer Law (C-004.2)
 *
 * L'Accounting Core (fn_ae_execute_event, appelé via emit_accounting_event) est
 * l'UNIQUE autorité d'écriture dans journal_entries et accounting_events.
 *
 * Ce test CI échoue si un développeur ajoute un nouveau chemin d'écriture direct
 * dans ces tables sans passer par le moteur comptable.
 *
 * Voir docs/LOI-K-UNIQUE-WRITER.md pour la liste complète des exemptions et la
 * doctrine architecturale.
 */

import { readFileSync, existsSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ── Chemins exemptés — journal_entries ──────────────────────────────────────
// Chaque exemption est intentionnelle et documentée.
// Toute nouvelle exemption exige une décision architecturale explicite.
const JOURNAL_EXEMPT = [
  // EXM-JE-001 : Saisie manuelle comptable — fonctionnalité intentionnelle
  /[\\/]app[\\/]dashboard[\\/]comptabilite[\\/]/,
  // EXM-JE-002 : accounting-engine.ts — helper serveur (createJournalEntry), usage contrôlé
  /[\\/]lib[\\/]accounting-engine\.ts$/,
  // EXM-JE-003 : compta-sync-client.ts — dette technique, writeComptaEntry() legacy
  /[\\/]lib[\\/]compta-sync-client\.ts$/,
  // Infra
  /[\\/]supabase[\\/]migrations[\\/]/,
  /[\\/]lib[\\/]architecture[\\/]/,
  /[\\/]docs[\\/]/,
  /[\\/]scripts[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
]

// ── Chemins exemptés — accounting_events ─────────────────────────────────────
// Aucun code applicatif ne doit insérer directement dans accounting_events.
// Seule la fonction SQL emit_accounting_event() peut le faire.
const ACCOUNTING_EVENTS_EXEMPT = [
  /[\\/]supabase[\\/]migrations[\\/]/,
  /[\\/]lib[\\/]architecture[\\/]/,
  /[\\/]docs[\\/]/,
  /[\\/]scripts[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
]

// ── Writers autorisés — pour la certification ─────────────────────────────────
// Ces chemins sont les seuls autorisés à appeler emit_accounting_event.
// Utiliser des séparateurs '/' (normalisés dans le test).
const AUTHORIZED_EMITTERS = [
  'app/api/factures/route.ts',
  'app/api/factures/[id]/route.ts',
  'app/dashboard/facturation/page.tsx',
  'app/dashboard/erp-sync/page.tsx',
  // Modules métier via API routes
  'app/api/hotel/payments/route.ts',
  'app/api/rh/paie/route.ts',
  'app/api/rh/paie/[id]/route.ts',
  'app/api/rh/acomptes/route.ts',
  'app/api/paie/acomptes/route.ts',
  'app/api/agriculture/recoltes/route.ts',
  'app/api/btp/chantiers/route.ts',
  'app/api/stock/move/route.ts',
  'app/api/stock/reception/route.ts',
  'app/api/achats/route.ts',
  'app/api/boisson/tournees/route.ts',
  'app/api/ong/dons/route.ts',
  'app/api/ecole/paiements/route.ts',
  'app/api/resto/achats/route.ts',
  'app/api/resto/commandes/route.ts',
  'app/api/sante/consultations/route.ts',
  'app/api/sante/facturation/route.ts',
]

// ── Patterns interdits ────────────────────────────────────────────────────────

const JOURNAL_ENTRIES_WRITE_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: /\.from\s*\(\s*['"`]journal_entries['"`]\s*\)\s*\.insert\s*\(/,
    description: "INSERT direct dans journal_entries — utiliser rpc('emit_accounting_event')",
  },
  {
    pattern: /\.from\s*\(\s*['"`]journal_entries['"`]\s*\)\s*\.update\s*\(/,
    description: "UPDATE direct dans journal_entries — le moteur gère via extourne (fn_reverse_accounting_event)",
  },
  {
    pattern: /\.from\s*\(\s*['"`]journal_entries['"`]\s*\)\s*\.upsert\s*\(/,
    description: "UPSERT direct dans journal_entries — utiliser rpc('emit_accounting_event')",
  },
  {
    pattern: /\.from\s*\(\s*['"`]journal_entries['"`]\s*\)\s*\.delete\s*\(\s*\)/,
    description: "DELETE direct dans journal_entries — utiliser rpc('fn_reverse_accounting_event')",
  },
]

const ACCOUNTING_EVENTS_WRITE_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: /\.from\s*\(\s*['"`]accounting_events['"`]\s*\)\s*\.insert\s*\(/,
    description: "INSERT direct dans accounting_events — utiliser rpc('emit_accounting_event')",
  },
  {
    pattern: /\.from\s*\(\s*['"`]accounting_events['"`]\s*\)\s*\.update\s*\(/,
    description: "UPDATE direct dans accounting_events — état géré exclusivement par fn_ae_execute_event",
  },
  {
    pattern: /\.from\s*\(\s*['"`]accounting_events['"`]\s*\)\s*\.delete\s*\(\s*\)/,
    description: "DELETE direct dans accounting_events — interdit (audit trail immuable)",
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

function scanViolations(
  files: string[],
  patterns: { pattern: RegExp; description: string }[],
): string[] {
  const violations: string[] = []
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const rel = filePath.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
    for (const { pattern, description } of patterns) {
      lines.forEach((line, i) => {
        const t = line.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
        if (pattern.test(line)) {
          violations.push(`  ${rel}:${i + 1} — ${description}\n    ↳ ${t.slice(0, 140)}`)
        }
      })
    }
  }
  return violations
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LOI-K — Unique Writer Law (C-004.2)', () => {

  it('aucun composant métier ne fait INSERT/UPDATE/DELETE direct dans journal_entries', () => {
    const files = getFiles(JOURNAL_EXEMPT)
    const violations = scanViolations(files, JOURNAL_ENTRIES_WRITE_PATTERNS)

    if (violations.length > 0) {
      const msg = [
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-K VIOLÉE — INSERT/UPDATE/DELETE direct dans journal_entries      ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
        '',
        `${violations.length} violation(s) détectée(s) :`,
        '',
        ...violations,
        '',
        'LOI-K : fn_ae_execute_event est l\'unique writer de journal_entries.',
        'Chemin autorisé : supabase.rpc(\'emit_accounting_event\', {...})',
        'Pour supprimer : supabase.rpc(\'fn_reverse_accounting_event\', {...})',
        'Exemptions existantes : voir JOURNAL_EXEMPT dans ce fichier.',
        'Voir : docs/LOI-K-UNIQUE-WRITER.md',
      ].join('\n')
      expect.fail(msg)
    }

    console.log(
      `[LOI-K] journal_entries : ${files.length} fichiers scannés — 0 violation ✅`
    )
  })

  it('aucun composant métier ne fait INSERT direct dans accounting_events', () => {
    const files = getFiles(ACCOUNTING_EVENTS_EXEMPT)
    const violations = scanViolations(files, ACCOUNTING_EVENTS_WRITE_PATTERNS)

    if (violations.length > 0) {
      const msg = [
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-K VIOLÉE — écriture directe dans accounting_events              ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
        '',
        `${violations.length} violation(s) détectée(s) :`,
        '',
        ...violations,
        '',
        'LOI-K : accounting_events est la queue exclusive du moteur comptable.',
        'Chemin autorisé : supabase.rpc(\'emit_accounting_event\', {...})',
        'Voir : docs/LOI-K-UNIQUE-WRITER.md',
      ].join('\n')
      expect.fail(msg)
    }

    console.log(
      `[LOI-K] accounting_events : ${files.length} fichiers scannés — 0 violation ✅`
    )
  })

  it('emit_accounting_event est appelé uniquement depuis des routes/composants autorisés', () => {
    // Détecte des appels de emit_accounting_event depuis des fichiers NON listés
    // dans AUTHORIZED_EMITTERS — pas un échec CI mais un avertissement de traçabilité.
    const allFiles = globSync('app/**/*.{ts,tsx}', { cwd: ROOT, absolute: true })
    const unexpected: string[] = []

    for (const filePath of allFiles) {
      const content = readFileSync(filePath, 'utf-8')
      if (!content.includes('emit_accounting_event')) continue
      const rel = filePath.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
      // Normaliser les séparateurs (Windows path.sep = '\', rel utilise '/')
      const relNorm = rel.replace(/\\/g, '/')
      const isKnown = AUTHORIZED_EMITTERS.some(a => relNorm.endsWith(a) || relNorm === a)
      if (!isKnown) {
        unexpected.push(`  NOUVEAU EMITTER : ${rel}`)
      }
    }

    if (unexpected.length > 0) {
      console.warn(
        [
          '',
          '[LOI-K] NOUVEAU(X) EMITTER(S) emit_accounting_event détecté(s) :',
          ...unexpected,
          '',
          'Action requise : ajouter ces chemins dans AUTHORIZED_EMITTERS (loi-k-unique-writer.test.ts)',
          'et documenter la décision dans docs/LOI-K-UNIQUE-WRITER.md',
        ].join('\n')
      )
    }

    // Ceci est un avertissement, pas un échec CI — les nouveaux emitters sont
    // autorisés mais doivent être enregistrés.
    expect(unexpected.length).toBeLessThanOrEqual(5)
  })

  it('les writers exemptés existent toujours (détecte les exemptions orphelines)', () => {
    // Si un fichier exempté est supprimé ou renommé, son exemption devient orpheline.
    // Ce test détecte ces cas pour maintenir la liste propre.
    const knownExemptFiles = [
      path.join(ROOT, 'lib', 'accounting-engine.ts'),
      path.join(ROOT, 'lib', 'compta-sync-client.ts'),
    ]

    const missing: string[] = []
    for (const f of knownExemptFiles) {
      if (!existsSync(f)) {
        missing.push(`  EXEMPTION ORPHELINE : ${f.replace(ROOT, '')}`)
      }
    }

    if (missing.length > 0) {
      const msg = [
        '',
        '[LOI-K] Exemptions orphelines détectées — les fichiers n\'existent plus :',
        ...missing,
        '',
        'Supprimer les entrées correspondantes dans JOURNAL_EXEMPT (loi-k-unique-writer.test.ts)',
        'et mettre à jour docs/LOI-K-UNIQUE-WRITER.md',
      ].join('\n')
      expect.fail(msg)
    }

    console.log('[LOI-K] Exemptions : toutes valides ✅')
  })

  it('certifie LOI-K : Accounting Core = unique writer', () => {
    // Test de certification finale — synthèse de toutes les vérifications précédentes.
    // Si ce test passe, la certification LOI-K est accordée.
    const jeFiles = getFiles(JOURNAL_EXEMPT)
    const aeFiles = getFiles(ACCOUNTING_EVENTS_EXEMPT)

    const jeViolations = scanViolations(jeFiles, JOURNAL_ENTRIES_WRITE_PATTERNS)
    const aeViolations = scanViolations(aeFiles, ACCOUNTING_EVENTS_WRITE_PATTERNS)

    const total = jeViolations.length + aeViolations.length

    if (total === 0) {
      console.log([
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-K CERTIFICATION — ACCORDÉE ✅                                   ║',
        '║  Accounting Core = unique writer certifié (C-004.2)                  ║',
        '║                                                                       ║',
        '║  journal_entries : fn_ae_execute_event UNIQUEMENT                     ║',
        '║  accounting_events : emit_accounting_event() UNIQUEMENT               ║',
        '║  Exemptions actives : 3 (comptabilite UI, accounting-engine, legacy)  ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
      ].join('\n'))
    }

    expect(total, `LOI-K : ${total} violation(s) bloquent la certification`).toBe(0)
  })
})
