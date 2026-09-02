/**
 * Architecture regression test — IMPACT TRÉSORERIE DÉRIVÉ DES RÈGLES (P0-04)
 *
 * Le moteur comptable créait une ligne `transactions` (journal de caisse)
 * pour tout événement dont le MODULE figurait dans une liste
 * (fn_ae_has_treasury_impact). FAC-001, ACH-001, SAN-001, AGR-001 — des
 * constatations qui ne touchent aucun compte 5xx — créaient donc une entrée
 * de caisse à l'émission, et le règlement qui suivait (FAC-002, ACH-002…)
 * était rejeté par transactions_source_unique. C'est l'origine des 96
 * erreurs 23505 relevées en ANO-C08.
 *
 * La migration 175 fait dériver l'impact trésorerie des règles réellement
 * appliquées : une séquence dont account_resolver vaut treasury_debit ou
 * treasury_credit. Ce test fige :
 *   - que la dernière définition du moteur ne consulte plus la liste ;
 *   - que le catalogue des règles distingue bien constatation et règlement ;
 *   - qu'aucune migration ultérieure ne réintroduit la liste dans le moteur.
 */

import { readFileSync, readdirSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const MIG  = path.join(ROOT, 'supabase', 'migrations')
const lire = (f: string) => readFileSync(path.join(MIG, f), 'utf-8')

const fichiers = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()

/** Corps de la dernière définition de fn_ae_execute_event, hors blocs commentés. */
function derniereDefinitionMoteur(): { fichier: string; corps: string } {
  const candidats = fichiers.filter(f => lire(f).includes('FUNCTION fn_ae_execute_event('))
  const fichier = candidats[candidats.length - 1]
  const src = lire(fichier).replace(/\/\*[\s\S]*?\*\//g, '')
  const debut = src.lastIndexOf('FUNCTION fn_ae_execute_event(')
  const fin = src.indexOf('$$;', src.indexOf('$$', debut + 40) + 2)
  return { fichier, corps: src.slice(debut, fin) }
}

/** event_type → résolveurs de trésorerie utilisés par ses règles actives. */
function resolveursParEvenement(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const f of fichiers) {
    const src = lire(f).replace(/\/\*[\s\S]*?\*\//g, '')
    // En-tête d'un tuple de règle : 'XXX-NNN', sequence, version, 'active',
    // Le tuple se termine à la première parenthèse fermante en début de ligne.
    const re = /^\s*'([A-Z]{3}-\d{3})',\s*\d+,\s*\d+,\s*'active',/gm
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      const ev = m[1]
      const debut = m.index + m[0].length
      const finRel = src.slice(debut).search(/\n\)/)
      const bloc = finRel === -1 ? src.slice(debut) : src.slice(debut, debut + finRel)
      const set = map.get(ev) ?? new Set<string>()
      const sansCommentaires = bloc.split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
      for (const r of sansCommentaires.match(/'treasury_(debit|credit)'/g) ?? []) set.add(r.replace(/'/g, ''))
      map.set(ev, set)
    }
  }
  return map
}

describe('fn_ae_execute_event — dernière définition', () => {
  const { fichier, corps } = derniereDefinitionMoteur()

  it('est celle de la migration 175', () => {
    expect(fichier).toBe('175_treasury_impact_from_rules.sql')
  })

  it('ne consulte plus la liste de modules pour la trésorerie', () => {
    expect(corps).not.toContain('fn_ae_has_treasury_impact')
    expect(corps).not.toContain('fn_ae_is_income')
  })

  it('accumule les séquences treasury_debit (entrée) et treasury_credit (sortie)', () => {
    expect(corps).toMatch(/account_resolver = 'treasury_debit' THEN\s+v_treso_in/)
    expect(corps).toMatch(/account_resolver = 'treasury_credit' THEN\s+v_treso_out/)
  })

  it('crée la ligne transactions seulement si une règle de trésorerie a été appliquée, avec le solde', () => {
    expect(corps).toMatch(/IF v_treso_touch AND v_treso_net <> 0 THEN\s+INSERT INTO transactions/)
    expect(corps).toMatch(/CASE WHEN v_treso_net > 0 THEN 'entree' ELSE 'sortie' END/)
    expect(corps).toMatch(/ABS\(v_treso_net\)/)
    expect(corps).not.toMatch(/v_event\.montant_ttc, v_event\.date_event/)
  })

  it('synchronise les soldes dès qu\'un compte 5xx a bougé, sans liste de modules', () => {
    expect(corps).toMatch(/IF v_treso_touch THEN\s+BEGIN\s+PERFORM fn_sync_tresorerie_soldes/)
    expect(corps).not.toMatch(/IN \('TRE','MOB','FAC','SAN','RES','ECO'\)/)
  })

  it('conserve les garde-fous 142.5 : CAS pending→processing, pays, exception avec message', () => {
    expect(corps).toMatch(/SET status = 'processing'\s+WHERE id = p_event_id AND status = 'pending'/)
    expect(corps).toMatch(/WHEN 'Congo-Brazzaville' THEN 'CG'/)
    expect(corps).toMatch(/error_message = SQLERRM \|\| ' \[' \|\| SQLSTATE \|\| '\]'/)
    expect(corps).toMatch(/retry_count\s+= retry_count \+ 1/)
  })

  it('trace les montants de trésorerie dans le journal d\'audit', () => {
    expect(corps).toMatch(/'treasury_in',\s+v_treso_in/)
    expect(corps).toMatch(/'treasury_out',\s+v_treso_out/)
  })
})

describe('catalogue des règles — constatation ≠ règlement', () => {
  const res = resolveursParEvenement()

  it.each(['FAC-001', 'ACH-001', 'SAN-001', 'AGR-001', 'PAI-001', 'STK-001', 'STK-002'])(
    '%s (constatation) n\'a aucune séquence de trésorerie active', (ev) => {
      expect(res.has(ev), `${ev} absent du catalogue actif`).toBe(true)
      expect([...(res.get(ev) ?? [])]).toEqual([])
    })

  it.each([
    ['FAC-002', 'treasury_debit'],
    ['SAN-002', 'treasury_debit'],
    ['PAI-002', 'treasury_credit'],
    ['PAI-003', 'treasury_credit'],
    ['ACH-002', 'treasury_credit'],
    ['ECO-001', 'treasury_debit'],
    ['RES-001', 'treasury_debit'],
    ['HOT-001', 'treasury_debit'],
    ['ONG-001', 'treasury_debit'],
    ['BOI-001', 'treasury_debit'],
    ['BTP-002', 'treasury_debit'],
    ['AGR-002', 'treasury_debit'],
  ])('%s (mouvement de caisse) résout %s', (ev, resolver) => {
    expect(res.get(ev)?.has(resolver), `${ev} sans ${resolver}`).toBe(true)
  })
})

describe('migration 175 — forme', () => {
  const src = lire('175_treasury_impact_from_rules.sql')

  it('ne modifie aucune donnée : pas de DELETE ni d\'UPDATE hors moteur', () => {
    const horsFonction = src.replace(/CREATE OR REPLACE FUNCTION fn_ae_execute_event[\s\S]*?\$\$;/, '')
                            .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(horsFonction).not.toMatch(/^\s*DELETE\s/m)
    expect(horsFonction).not.toMatch(/^\s*UPDATE\s/m)
    expect(horsFonction).not.toMatch(/DROP TABLE|TRUNCATE/)
  })

  it('enregistre la version 1.11.0 et le journal d\'audit la porte', () => {
    expect(src).toMatch(/'1\.11\.0', 1, 11, 0/)
    expect(src).toMatch(/TRUE, '1\.11\.0'/)
  })
})
