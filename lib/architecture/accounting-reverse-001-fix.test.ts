/**
 * Tests statiques — ACCOUNTING-REVERSE-001-FIX
 *
 * fn_reverse_accounting_event (migration 138) construisait un event_type
 * d'extourne ('EXT-' + module + '-' + numéro, ex. 'EXT-VTE-001') qui viole
 * structurellement chk_ae_event_type pour TOUT event_type — confirmé par
 * exécution PostgreSQL réelle (docs/ACCOUNTING-REVERSE-001-IMPACT-AUDIT.md)
 * et par 0 ligne event_type LIKE 'EXT-%' en production, jamais une seule
 * extourne n'ayant réussi depuis la création de cette fonction.
 *
 * Migration 187 corrige UNIQUEMENT la construction de cet identifiant
 * (v_event.event_type || '-EXT', déjà conforme à la contrainte EXISTANTE,
 * sans la relâcher) — migration 138 elle-même reste inchangée (historique,
 * déjà appliquée).
 *
 * app/dashboard/facturation/page.tsx avalait l'erreur de cet appel sans la
 * lire, laissant une facture se supprimer même si son extourne comptable
 * échouait — corrigé pour propager l'échec et bloquer la suppression.
 *
 * Preuve d'exécution réelle contre PostgreSQL (pas seulement ce fichier) :
 * docs/ACCOUNTING-REVERSE-001-FIX-VALIDATION.md.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { REPO_ROOT } from './supabase-usage'

function read(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf-8')
}

const MIGRATION_187 = 'supabase/migrations/187_fix_accounting_reverse_event_type.sql'
const MIGRATION_138 = 'supabase/migrations/138_accounting_engine_infrastructure.sql'

describe('ACCOUNTING-REVERSE-001-FIX — migration 187', () => {
  it('CREATE OR REPLACE la fonction, ne modifie jamais directement la migration 138 (historique, déjà appliquée)', () => {
    const src = read(MIGRATION_187)
    expect(src).toContain('CREATE OR REPLACE FUNCTION fn_reverse_accounting_event')
    const src138 = read(MIGRATION_138)
    // La migration 138 elle-même ne doit porter aucune trace du correctif —
    // seule 187 le fait, par CREATE OR REPLACE (même patron que 142.5/175
    // pour fn_ae_execute_event).
    expect(src138).not.toContain("|| '-EXT'")
  })

  it('utilise event_type || \'-EXT\' (conforme à chk_ae_event_type sans le relâcher), plus jamais la construction EXT-<module>-<numéro> dans le code exécuté', () => {
    const src = read(MIGRATION_187)
    expect(src).toContain("v_event.event_type || '-EXT'")
    // L'ancienne construction est citée en commentaire ('--') dans l'en-tête
    // et le rollback pour expliquer le défaut corrigé — seul le CODE
    // exécuté (hors '--') doit en être exempt.
    const codeOnly = src.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    expect(codeOnly).not.toMatch(/'EXT-'\s*\|\|\s*v_event\.event_module/)
  })

  it('ne modifie ni chk_ae_event_type, ni accounting_event_rules, ni fn_ae_execute_event, ni fn_stock_move, ni reversed_movement_id (code exécuté, pas les commentaires explicatifs du en-tête/rollback)', () => {
    // Lecture sans commentaires SQL ('--') : le en-tête et la section
    // rollback NOMMENT délibérément chk_ae_event_type/l'ancienne
    // construction pour les expliquer — ça ne doit pas se faire passer
    // pour une modification réelle du code exécuté (même précaution que
    // readCodeOnly() dans vente-canonique.test.ts, adaptée au SQL).
    const codeOnly = read(MIGRATION_187)
      .split('\n')
      .filter(l => !l.trim().startsWith('--'))
      .join('\n')
    expect(codeOnly).not.toContain('ALTER TABLE accounting_events')
    // La contrainte peut légitimement être NOMMÉE (COMMENT ON FUNCTION,
    // explication) sans jamais être modifiée — seule une DDL qui la touche
    // (DROP/ADD CONSTRAINT) compterait comme une vraie modification.
    expect(codeOnly).not.toMatch(/(DROP|ADD)\s+CONSTRAINT\s+chk_ae_event_type/i)
    expect(codeOnly).not.toContain('ALTER TABLE accounting_event_rules')
    expect(codeOnly).not.toContain('CREATE OR REPLACE FUNCTION fn_ae_execute_event')
    expect(codeOnly).not.toContain('CREATE OR REPLACE FUNCTION fn_stock_move')
    expect(codeOnly).not.toContain('reversed_movement_id')
  })

  it('réutilise les colonnes existantes (correction_of, reversed_by, accounting_event_extournes) — aucune nouvelle colonne créée', () => {
    const src = read(MIGRATION_187)
    expect(src).not.toMatch(/ADD COLUMN/)
    expect(src).toContain('correction_of')
    expect(src).toContain('reversed_by')
    expect(src).toContain('accounting_event_extournes')
    // Le garde-fou d'idempotence déjà existant (migration 138) est préservé tel quel.
    expect(src).toContain("cet événement a déjà été extourné")
  })
})

describe('ACCOUNTING-REVERSE-001-FIX — app/dashboard/facturation/page.tsx', () => {
  it('reverseFactureEvents lit désormais l\'erreur de fn_reverse_accounting_event et la propage', () => {
    const src = read('app/dashboard/facturation/page.tsx')
    expect(src).toMatch(/const \{ error \} = await supabase\.rpc\('fn_reverse_accounting_event'/)
    expect(src).toMatch(/if \(error\) return \{ ok: false, error: error\.message \}/)
  })

  it('del() bloque la suppression de la facture si l\'extourne échoue, et informe l\'utilisateur', () => {
    const src = read('app/dashboard/facturation/page.tsx')
    const reversedIdx = src.indexOf('const reversed = await reverseFactureEvents(id)')
    const deleteIdx = src.indexOf("supabase.from('factures').delete()")
    expect(reversedIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(reversedIdx) // la suppression vient APRÈS le contrôle, jamais avant
    expect(src).toMatch(/if \(!reversed\.ok\)/)
  })
})
