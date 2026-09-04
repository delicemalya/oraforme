/**
 * Architecture regression test — AUCUN TAUX NI PLAFOND DANS UN DOCUMENT (P0-01)
 *
 * Les documents remis à l'administration ou au salarié portaient leurs propres
 * constantes fiscales, différentes de celles du moteur :
 *
 *   déclaration DGI      TUS liquidée à 4,5 %, taxe supprimée par la LF 2026
 *   déclaration CNSS     « 10.03% » sur une base plafonnée à 600 000 F, alors
 *                        que les allocations familiales ont leur propre plafond
 *                        de 1 200 000 F — 60 240 F sous-déclarés par mois
 *   PDF CNSS             « Taux salarié: 5,04% · Patronal: 14,36% », deux
 *                        valeurs qui ne sortaient d'aucun calcul
 *   contrat de travail   5,04 % du brut et coût employeur × 1,1416
 *
 * Le point commun n'est pas l'erreur, c'est le mécanisme : un document qui
 * détient son propre taux est cohérent avec lui-même et faux par rapport au
 * droit, donc invisible. Ce test interdit le mécanisme.
 *
 * Les montants doivent venir de lib/fiscal/universal-tax-engine.ts, qui les
 * tire de lib/countries/.
 */

import { readFileSync, existsSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

/** Chaînes produisant un document opposable : déclaration, PDF, contrat. */
const CHAINES_DOCUMENTAIRES = [
  'lib/declarations/**/*.ts',
  'components/declarations/**/*.tsx',
  'components/rh/ContratPDF.tsx',
  'app/api/declarations/**/*.ts',
  'app/api/fiscalite/cnss/**/*.ts',
  'app/dashboard/declarations/**/*.tsx',
  'app/dashboard/rh/contrats/page.tsx',
]

const IGNORE = ['**/node_modules/**', '**/.next/**', '**/*.test.ts', '**/*.test.tsx']

/**
 * Un taux fiscal écrit à la main, sous ses deux formes :
 *   - un décimal utilisé comme coefficient : 0.045, 0.1003, 1.1416
 *   - un pourcentage écrit dans un libellé : « 5,04% », « 10.03 % »
 *
 * Les entiers ne sont pas visés : une taille de police vaut 9, un flex vaut 3.
 */
const TAUX_DECIMAL    = /(?<![\w.])(?:0|1)\.\d{2,6}(?![\w.])/g
const TAUX_POURCENT   = /\d+[.,]\d+\s*%/g

/** Plafonds de cotisation congolais, écrits en clair dans un document. */
const PLAFOND_LITTERAL = /(?<![\w.])(?:600[\s_]?000|1[\s_]?200[\s_]?000)(?![\w.])/g

/** Contextes où un décimal n'a rien de fiscal. */
const LIGNES_EXEMPTES = /opacity|rgba?\(|scale\(|translate|lineHeight|letterSpacing|borderRadius|flex:|zIndex|toFixed|Math\.random|version/i

type Violation = { file: string; line: number; extrait: string; motif: string }

function analyser(contenu: string, rel: string): Violation[] {
  const out: Violation[] = []
  contenu.split('\n').forEach((ligne, i) => {
    const nettoyee = ligne.trim()
    if (nettoyee.startsWith('//') || nettoyee.startsWith('*')) return   // commentaire
    if (LIGNES_EXEMPTES.test(ligne)) return

    for (const [motif, regex] of [
      ['taux décimal', TAUX_DECIMAL],
      ['pourcentage écrit', TAUX_POURCENT],
      ['plafond en clair', PLAFOND_LITTERAL],
    ] as const) {
      regex.lastIndex = 0
      const m = ligne.match(regex)
      if (m) out.push({ file: rel, line: i + 1, extrait: nettoyee.slice(0, 110), motif: `${motif} : ${m.join(', ')}` })
    }
  })
  return out
}

function fichiersDocumentaires(): string[] {
  return CHAINES_DOCUMENTAIRES
    .flatMap(g => globSync(g, { cwd: ROOT, ignore: IGNORE, absolute: false }))
    .filter(f => existsSync(path.join(ROOT, f)))
}

describe('DOCUMENTS FISCAUX — le scanner détecte bien les formes historiques', () => {
  // Un scanner qu'on affaiblit pour obtenir un succès ne sert à rien.
  // Ces quatre lignes sont celles qui étaient réellement dans le code.
  const historiques = [
    "const tus = Math.round(salaireBrut * 0.045)",
    "function cnssEmploye(brut: number) { return Math.round(brut * 0.0504) }",
    "{ label: 'Allocations Familiales (AF)', taux: '10.03%' }",
    "Plafond vieillesse : 1 200 000 FCFA/agent/mois",
  ]

  it.each(historiques)('détecte : %s', (ligne) => {
    expect(analyser(ligne, 'echantillon').length).toBeGreaterThan(0)
  })

  it('ne signale pas une ligne sans valeur fiscale', () => {
    expect(analyser("const total = branches.reduce((s, b) => s + b.montant_patronal, 0)", 'x')).toEqual([])
  })
})

describe('DOCUMENTS FISCAUX — aucune valeur fiscale écrite à la main', () => {
  const fichiers = fichiersDocumentaires()

  it('trouve bien les chaînes documentaires à vérifier', () => {
    expect(fichiers.length).toBeGreaterThan(5)
  })

  it('aucun taux ni plafond en dur dans les documents', () => {
    const violations = fichiers.flatMap(f =>
      analyser(readFileSync(path.join(ROOT, f), 'utf-8'), f),
    )
    const detail = violations
      .map(v => `${v.file}:${v.line} — ${v.motif}\n    ${v.extrait}`)
      .join('\n')
    expect(
      violations,
      `Valeur fiscale écrite dans un document. Passer par lib/fiscal/universal-tax-engine.ts :\n${detail}`,
    ).toEqual([])
  })
})
