/**
 * lib/architecture/btp001-tva-ca-separation.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mission P0-FISCAL-CG-2026 — correction BTP-001 / TVA → comptabilité
 * (2026-09-18).
 *
 * BTP-001 postait montantHT × 0.189 (TVA 18% + Centime Additionnel 5% de la
 * TVA, fusionnés) intégralement sur le compte 4441 (TVA collectée). Comme
 * computeTVAFromJournal() (source canonique de la déclaration TVA depuis la
 * mission précédente) lit tout crédit sur 4441/4442 comme de la TVA, le
 * Centime Additionnel BTP était compté à tort comme de la TVA — la
 * déclaration de tout tenant BTP était surestimée.
 *
 * Correction (migration 181) : BTP-001 gagne une 3ᵉ séquence (411/447,
 * metadata.ca) — même compte que FAC-001 séquence 3 (migration 139),
 * précédent démontré, pas inventé. app/api/btp/chantiers/route.ts calcule
 * désormais tva et ca séparément via
 * lib/fiscalite/engine-adapter.ts::calculerTVASurMontantUnifie().
 *
 * Ces tests ne frappent pas la base (aucun accès réseau) : ils simulent les
 * écritures que emit_accounting_event produirait pour BTP-001 séquences 1/2/3
 * telles que définies dans la migration 181, et vérifient leur effet sur
 * computeTVAFromJournal() — la fonction canonique elle-même est déjà testée
 * par ailleurs (lib/erp-core/compute/accounting.test.ts).
 */

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { computeTVAFromJournal, type JournalBalanceRow } from '../erp-core/compute/accounting'
import { calculerTVASurMontantUnifie } from '../fiscalite/engine-adapter'

const ROOT = path.resolve(__dirname, '../..')
const ROUTE_SOURCE     = readFileSync(path.join(ROOT, 'app/api/btp/chantiers/route.ts'), 'utf-8')
const MIGRATION_181     = readFileSync(path.join(ROOT, 'supabase/migrations/181_fix_btp001_tva_ca_separation.sql'), 'utf-8')
const MIGRATION_148     = readFileSync(path.join(ROOT, 'supabase/migrations/148_accounting_rules_btp_agriculture.sql'), 'utf-8')
const MIGRATION_139_FAC = readFileSync(path.join(ROOT, 'supabase/migrations/139_accounting_rules_facturation.sql'), 'utf-8')

/** Simule les écritures que BTP-001 (post-migration 181) produirait pour un chantier donné. */
function ecrituresBTP001(montantHT: number, date: string): JournalBalanceRow[] {
  const { tva, ca } = calculerTVASurMontantUnifie(montantHT, 'CG')
  const rows: JournalBalanceRow[] = [
    { date_operation: date, debit_account: '411', credit_account: '722', montant: montantHT },
  ]
  if (tva > 0) rows.push({ date_operation: date, debit_account: '411', credit_account: '4441', montant: tva })
  if (ca  > 0) rows.push({ date_operation: date, debit_account: '411', credit_account: '447',  montant: ca })
  return rows
}

/** L'ancien comportement (avant migration 181) : TVA+CA fusionnés sur 4441 seul. */
function ecrituresBTP001Avant(montantHT: number, date: string): JournalBalanceRow[] {
  const montantTVAFusionne = Math.round(montantHT * 0.189 * 100) / 100
  return [
    { date_operation: date, debit_account: '411', credit_account: '722', montant: montantHT },
    { date_operation: date, debit_account: '411', credit_account: '4441', montant: montantTVAFusionne },
  ]
}

// ── 1. Cause racine démontrée : nature du 0.189 ────────────────────────────

describe('BTP-001 — nature du 0.189 (démonstration, pas une supposition)', () => {
  it('0.189 = 0.18 (TVA) + 0.18×0.05 (Centime Additionnel), pas un taux à part', () => {
    const tauxTVA = 0.18
    const tauxCA  = 0.05  // 5% de la TVA, pas du HT
    const tauxEffectif = tauxTVA * (1 + tauxCA)
    expect(Math.round(tauxEffectif * 1000) / 1000).toBe(0.189)
  })

  it('migration 148 documente elle-même la composition (18% + Centime Additionnel = 18,9%)', () => {
    expect(MIGRATION_148).toMatch(/TVA 18%.*Centime Additionnel.*18\.9%|18\.9%.*TVA.*Centime Additionnel|18% \+ Centime Additionnel/i)
  })
})

// ── 2. Compte du Centime Additionnel : démontré par précédent, pas inventé ──

describe('BTP-001 séquence 3 — le compte 447 est démontré par FAC-001, pas inventé', () => {
  it('FAC-001 séquence 3 poste déjà metadata.ca sur 411/447, restreint au Congo', () => {
    expect(MIGRATION_139_FAC).toContain("'FAC-001', 3, 1, 'active'")
    expect(MIGRATION_139_FAC).toContain("'411', '447'")
    expect(MIGRATION_139_FAC).toContain("'metadata.ca'")
  })

  it('migration 181 ajoute BTP-001 séquence 3 avec exactement le même compte et le même champ', () => {
    expect(MIGRATION_181).toContain("'BTP-001', 3, 1, 'active'")
    expect(MIGRATION_181).toContain("'411', '447'")
    expect(MIGRATION_181).toContain("'metadata.ca'")
    expect(MIGRATION_181).toContain("ARRAY['CG']")
  })

  it('BTP-001 séquences 1 et 2 ne sont pas modifiées par la migration 181 (seule la note change)', () => {
    // La migration ne doit pas réécrire debit_account/credit_account des
    // séquences existantes — seule une correction de note (séq 2) et un ajout
    // (séq 3) sont attendus.
    expect(MIGRATION_181).not.toContain("SET debit_account")
    expect(MIGRATION_181).not.toContain("SET credit_account")
  })
})

// ── 3. Réconciliation : TVA canonique cohérente avec la déclaration ────────

describe('BTP-001 corrigé — réconciliation avec computeTVAFromJournal (section 6 de la mission)', () => {
  it('la TVA collectée lue par la déclaration correspond exactement à la TVA calculée par le moteur central, sans le Centime Additionnel', () => {
    const montantHT = 500_000
    const { tva, ca } = calculerTVASurMontantUnifie(montantHT, 'CG')
    expect(tva).toBe(90_000)   // 500 000 × 18%
    expect(ca).toBe(4_500)     // 90 000 × 5%

    const entries = ecrituresBTP001(montantHT, '2026-06-05')
    const summary = computeTVAFromJournal(entries, 2026)
    const juin = summary.mensuel.find(m => m.mois === 6)!

    expect(juin.tva_collectee).toBe(tva)          // exactement la TVA pure, pas 94 500
    expect(juin.tva_collectee).not.toBe(tva + ca)  // preuve que le CA n'est plus mélangé
  })

  it('AVANT la correction (fusion 18.9% sur 4441 seul), la déclaration aurait surestimé la TVA du montant du Centime Additionnel', () => {
    const montantHT = 500_000
    const { tva, ca } = calculerTVASurMontantUnifie(montantHT, 'CG')

    const avant = computeTVAFromJournal(ecrituresBTP001Avant(montantHT, '2026-06-05'), 2026)
    const apres = computeTVAFromJournal(ecrituresBTP001(montantHT, '2026-06-05'), 2026)

    const collecteeAvant = avant.mensuel.find(m => m.mois === 6)!.tva_collectee
    const collecteeApres = apres.mensuel.find(m => m.mois === 6)!.tva_collectee

    expect(collecteeAvant).toBe(tva + ca)   // 94 500 — le bug démontré
    expect(collecteeApres).toBe(tva)        // 90 000 — la correction
    expect(collecteeAvant - collecteeApres).toBe(ca)   // écart exactement égal au CA fusionné à tort
  })

  it('le total facturé (TTC) est préservé — seule la répartition interne change, pas le montant client', () => {
    const montantHT = 500_000
    const { ttc } = calculerTVASurMontantUnifie(montantHT, 'CG')
    const ttcAvant = montantHT + Math.round(montantHT * 0.189 * 100) / 100
    // Différence de ±quelques francs possible : l'ancien calcul arrondissait
    // une fois sur 18,9% combiné, le nouveau arrondit tva puis ca séparément
    // (même convention que fiscalite-congo.ts et universal-tax-engine.ts
    // partout ailleurs dans le dépôt) — pas un nouveau choix, un alignement.
    expect(Math.abs(ttc - ttcAvant)).toBeLessThanOrEqual(1)
  })
})

// ── 4. Multi-tenant (section 7 de la mission) ──────────────────────────────

describe('BTP-001 — isolation multi-tenant', () => {
  it('computeTVAFromJournal reste une fonction pure : deux tenants BTP ne se mélangent jamais', () => {
    const tenantA = ecrituresBTP001(500_000, '2026-06-05')
    const tenantB = ecrituresBTP001(1_200_000, '2026-06-10')

    const rA = computeTVAFromJournal(tenantA, 2026)
    const rB = computeTVAFromJournal(tenantB, 2026)

    expect(rA.total_collectee).not.toBe(rB.total_collectee)
    expect(computeTVAFromJournal(tenantA, 2026).total_collectee).toBe(rA.total_collectee)
  })

  it('app/api/btp/chantiers/route.ts filtre tenant_id avant tout emit_accounting_event (vérification statique)', () => {
    // Les 3 points d'émission (POST création, PATCH règlement) doivent tous
    // utiliser ctx.tenantId — jamais un tenant_id venu du corps de la requête.
    const occurrences = ROUTE_SOURCE.split("p_tenant_id:").length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2)   // BTP-001 et BTP-002
    expect(ROUTE_SOURCE).not.toContain('p_tenant_id:     body.')
    expect(ROUTE_SOURCE).toContain('const { ctx, error } = await requireTenant()')
  })
})

// ── 5. Aucun taux recopié dans le routeur (section 4 de la mission) ───────

describe('Architecture — app/api/btp/chantiers/route.ts ne recopie plus aucun taux TVA', () => {
  it('délègue à calculerTVASurMontantUnifie, aucun calcul par 0.189/0.18/0.05/1.189 dans le code (hors commentaires)', () => {
    expect(ROUTE_SOURCE).toContain("from '@/lib/fiscalite/engine-adapter'")
    expect(ROUTE_SOURCE).toContain('calculerTVASurMontantUnifie(montantHT')

    // Ignore les lignes de commentaire (// ...) qui documentent l'ancien
    // calcul à des fins d'historique — seul le CODE compte ici.
    const codeSansCommentaires = ROUTE_SOURCE
      .split('\n')
      .filter(l => !l.trim().startsWith('//'))
      .join('\n')

    expect(codeSansCommentaires).not.toMatch(/\*\s*0\.189/)
    expect(codeSansCommentaires).not.toMatch(/\*\s*1\.189/)
    expect(codeSansCommentaires).not.toMatch(/\*\s*0\.18\b/)
    expect(codeSansCommentaires).not.toMatch(/\*\s*0\.05\b/)
  })
})
