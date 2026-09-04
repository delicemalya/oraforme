/**
 * Architecture regression test — CHAÎNE PAIE → COMPTABILITÉ (P0-03)
 *
 * La migration 141 a supprimé le trigger trg_bulletins_paie et confié les
 * écritures de paie aux routes, via emit_accounting_event(). Or la seule route
 * appelée par l'interface, POST /api/paie/bulletins, n'émettait rien : depuis
 * cette migration, une paie générée à l'écran ne produisait aucune écriture.
 *
 * Les deux routes qui émettaient n'avaient aucun appelant, et se
 * contredisaient : l'une émettait PAI-001 dès la création, l'autre passait le
 * net en montant_ttc sur PAI-001 (transaction créée à la validation, puis
 * PAI-002 rejeté sur transactions_source_unique).
 *
 * Ce test fige : un seul contrat, toutes les routes qui changent le statut
 * d'un bulletin l'utilisent, et la page ne parle qu'à une route qui émet.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { BULLETIN_COMPTABLE_SELECT } from '@/lib/paie/evenements-comptables'

const ROOT = path.resolve(__dirname, '../..')
const lire = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

const ROUTE_UI      = 'app/api/paie/bulletins/route.ts'
const ROUTE_ID      = 'app/api/rh/paie/[id]/route.ts'
const ROUTE_CREATE  = 'app/api/rh/paie/route.ts'
const PAGE          = 'app/dashboard/rh/paie/page.tsx'
const CONTRAT       = 'lib/paie/evenements-comptables.ts'
const MIGRATION_141 = 'supabase/migrations/141_accounting_rules_paie.sql'
const LOI_K         = 'lib/architecture/loi-k-unique-writer.test.ts'

/**
 * Colonnes réelles de bulletins_paie, relevées migration par migration.
 *
 *   007_paie                    création : salaire_base, primes, heures_sup,
 *                               taux_horaire, brut, cnss_salarie, cnss_patronal,
 *                               irpp, net, statut, date_paiement, created_at
 *   046_erp_full_interconnection mode_paiement
 *   077_paie_v2                 primes détaillées, retenues, charges patronales,
 *                               cnss_taux, reference_paiement, notes, genere_par
 *   118_rls_bulletins_paie_fix  prime_risque
 *
 * La table a été créée par 007 ; 046 et 077 sont en CREATE IF NOT EXISTS et
 * n'ont ajouté que par ALTER. updated_at (077) n'existe donc que si 077 a
 * créé la table : non retenue.
 */
const BULLETINS_PAIE_COLUMNS = new Set([
  'id', 'tenant_id', 'employe_id', 'mois', 'annee',
  'salaire_base', 'primes', 'heures_sup', 'taux_horaire',
  'brut', 'cnss_salarie', 'cnss_patronal', 'irpp', 'net',
  'statut', 'date_paiement', 'created_at',
  'mode_paiement',
  'prime_rendement', 'prime_anciennete', 'prime_transport', 'prime_logement',
  'prime_responsabilite', 'indemnite_deplacement', 'avantages_nature', 'autres_gains',
  'cnss_taux', 'mutuelle', 'acompte', 'opposition', 'autres_retenues', 'total_retenues',
  'tus_patronal', 'medecine_travail', 'cout_total_employeur',
  'reference_paiement', 'notes', 'genere_par',
  'prime_risque',
])

const sansCommentaires = (src: string) =>
  src.split('\n').filter(l => {
    const t = l.trim()
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))
  }).join('\n')

// ── Le sélecteur ne nomme que des colonnes réelles ───────────────────────────

describe('BULLETIN_COMPTABLE_SELECT — colonnes réelles de bulletins_paie', () => {
  const colonnes = BULLETIN_COMPTABLE_SELECT
    .replace(/employes\([^)]*\)/, '')
    .split(',').map(c => c.trim()).filter(Boolean)

  it.each(colonnes)('%s existe', (col) => {
    expect(BULLETINS_PAIE_COLUMNS.has(col), `${col} absente de bulletins_paie`).toBe(true)
  })

  it('joint le nom de l\'employé, qui n\'est pas dans bulletins_paie', () => {
    expect(BULLETIN_COMPTABLE_SELECT).toMatch(/employes\(nom\)/)
  })

  it('porte tout ce que le contrat lit', () => {
    for (const c of ['brut', 'net', 'cnss_salarie', 'cnss_patronal', 'irpp', 'statut', 'mode_paiement', 'date_paiement', 'mois', 'annee', 'id']) {
      expect(colonnes).toContain(c)
    }
  })
})

// ── La route appelée par l'interface émet ────────────────────────────────────

describe('POST/PATCH /api/paie/bulletins — la route de l\'interface émet en comptabilité', () => {
  const src = sansCommentaires(lire(ROUTE_UI))

  it('la page de paie n\'écrit ses bulletins que par cette route', () => {
    const page = sansCommentaires(lire(PAGE))
    expect(page).toContain("fetch('/api/paie/bulletins'")
    expect(page).not.toMatch(/from\(\s*['"]bulletins_paie['"]\s*\)\s*\.(insert|upsert|update|delete)/)
    expect(page).not.toMatch(/fetch\(\s*[`'"]\/api\/rh\/paie[`'"]/)
  })

  it('appelle emit_accounting_event', () => {
    expect(src).toContain("rpc('emit_accounting_event'")
  })

  it('tire ses paramètres du contrat unique, sans event_type en dur', () => {
    expect(src).toContain('evenementsComptablesBulletin')
    expect(src).toContain('BULLETIN_COMPTABLE_SELECT')
    expect(src).not.toMatch(/PAI-00\d/)
    expect(src).not.toMatch(/p_event_type\s*:/)
  })

  it('relit les lignes écrites avec le sélecteur du contrat, après upsert et après update', () => {
    const upsert = /\.upsert\([\s\S]*?\.select\(BULLETIN_COMPTABLE_SELECT\)/
    const update = /\.update\([\s\S]*?\.select\(BULLETIN_COMPTABLE_SELECT\)/
    expect(src).toMatch(upsert)
    expect(src).toMatch(update)
  })

  it('un échec d\'émission ne renvoie pas ok:true', () => {
    expect(src).toMatch(/écritures comptables non émises/)
    expect(src).toMatch(/status:\s*500/)
  })

  it('conserve la garde tenant sur chaque ligne (403)', () => {
    expect(src).toMatch(/b\.tenant_id !== ctx\.tid/)
    expect(src).toMatch(/status:\s*403/)
  })

  it('n\'écrit jamais journal_entries ni accounting_events en direct (LOI-K)', () => {
    expect(src).not.toMatch(/from\(\s*['"]journal_entries['"]\s*\)/)
    expect(src).not.toMatch(/from\(\s*['"]accounting_events['"]\s*\)/)
  })

  it('est déclarée émetteur autorisé dans LOI-K', () => {
    expect(lire(LOI_K)).toContain(`'${ROUTE_UI}'`)
  })
})

// ── Un seul contrat pour toutes les routes ───────────────────────────────────

describe('un seul contrat PAI-001/PAI-002 pour toutes les routes', () => {
  it('PATCH /api/rh/paie/[id] utilise le contrat, sans paramètres en dur', () => {
    const src = sansCommentaires(lire(ROUTE_ID))
    expect(src).toContain('evenementsComptablesBulletin')
    expect(src).toContain("rpc('emit_accounting_event'")
    expect(src).not.toMatch(/p_event_type\s*:/)
    expect(src).not.toMatch(/p_montant_ttc\s*:/)
  })

  it('POST /api/rh/paie n\'émet plus à la création : un bulletin generee n\'est pas un fait comptable', () => {
    const src = sansCommentaires(lire(ROUTE_CREATE))
    expect(src).not.toContain('emit_accounting_event')
    expect(src).not.toMatch(/PAI-00\d/)
  })

  it('les paramètres emit_accounting_event ne sont écrits qu\'à un seul endroit du domaine paie', () => {
    const fichiers = [ROUTE_UI, ROUTE_ID, ROUTE_CREATE, PAGE]
    for (const f of fichiers) {
      expect(sansCommentaires(lire(f)), `${f} redéfinit les paramètres`).not.toMatch(/p_source_table\s*:\s*['"]bulletins_paie['"]/)
    }
    expect(sansCommentaires(lire(CONTRAT))).toMatch(/p_source_table:\s*'bulletins_paie'/)
  })
})

// ── Le contrat est celui de la migration 141 ─────────────────────────────────

describe('le contrat reproduit les règles actives de la migration 141', () => {
  const mig = lire(MIGRATION_141)
  const contrat = sansCommentaires(lire(CONTRAT))

  it('PAI-001 séquence 1 lit montant_ht : le contrat y met le brut', () => {
    expect(mig).toMatch(/'PAI-001', 1, 1, 'active',\s*'661', '421',\s*'montant_ht'/)
    expect(contrat).toMatch(/p_montant_ht:\s*brut/)
  })

  it.each([
    ['metadata.cnss_patronal', 2, 'cnss_patronal'],
    ['metadata.cnss_salarie',  3, 'cnss_salarie'],
    ['metadata.irpp',          4, 'irpp'],
  ])('PAI-001 séquence %s lit %s : le contrat renseigne metadata.%s', (champ, seq, cle) => {
    expect(mig).toMatch(new RegExp(`'PAI-001', ${seq}, 1, 'active',[\\s\\S]{0,60}'${champ.replace('.', '\\.')}'`))
    expect(contrat).toMatch(new RegExp(`${cle}:\\s*montant\\(b\\.${cle}\\)`))
  })

  it('PAI-002 lit montant_ttc et résout la trésorerie par metadata.mode_paiement', () => {
    // Entre l'en-tête et le champ : '421', puis '521' suivi d'un commentaire de placeholder.
    expect(mig).toMatch(/'PAI-002', 1, 1, 'active',[\s\S]{0,200}'montant_ttc', NULL, 'treasury_credit'/)
    expect(contrat).toMatch(/p_montant_ttc:\s*net/)
    expect(contrat).toMatch(/mode_paiement:/)
  })

  it('PAI-001 ne porte aucun montant_ttc : le module PAI est à impact de trésorerie et la sortie appartient à PAI-002', () => {
    // fn_ae_has_treasury_impact (138:585, 148:75) inclut 'PAI' ; tout montant_ttc > 0
    // crée une ligne transactions sous UNIQUE (tenant_id, source, source_id).
    const bloc = contrat.slice(contrat.indexOf("p_event_type:    'PAI-001'"), contrat.indexOf("p_event_type:    'PAI-002'"))
    expect(bloc).toMatch(/p_montant_ttc:\s*0,/)
  })

  it('le trigger trg_bulletins_paie est bien supprimé par la migration 141, hors bloc de rollback', () => {
    const avantRollback = mig.slice(0, mig.indexOf('ROLLBACK'))
    expect(avantRollback).toMatch(/DROP TRIGGER IF EXISTS trg_bulletins_paie ON bulletins_paie;/)
    expect(avantRollback).not.toMatch(/^\s*CREATE TRIGGER trg_bulletins_paie/m)
  })
})
