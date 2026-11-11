/**
 * Architecture regression test — STOCK PAR PROVENANCE (BOI-010)
 *
 * Mission P0-BOI-010, docs/BOI-010-IMPLEMENTATION-STOCK-PROVENANCE.md.
 * Implémente le modèle validé en BOI-007 (Modèle D : origine + purchase_item_id
 * sur stock_movements, vue dérivée v_products_stock_par_origine) et la
 * politique métier retenue en BOI-009 (choix manuel, jamais de bascule
 * automatique).
 *
 * DEUX FAMILLES DE TESTS ICI :
 *
 * 1. Tests d'ARITHMÉTIQUE PURE (describe "logique...") : une réimplémentation
 *    JS fidèle de l'algorithme SQL de fn_stock_move (migration 184, préparée
 *    mais NON exécutée — le MCP Supabase était déconnecté pendant cette
 *    mission, voir docs/BOI-010-IMPLEMENTATION-STOCK-PROVENANCE.md §15).
 *    Ces tests prouvent que le RAISONNEMENT est correct sur les scénarios
 *    exacts de la mission (TEST 1 à 7) — ils ne remplacent PAS un test
 *    d'intégration contre la vraie fonction PL/pgSQL, qui reste à faire une
 *    fois la migration appliquée et le MCP reconnecté.
 *
 * 2. Tests de CONTRAT STATIQUE (describe "BOI-010 —...") : vérifient que le
 *    code réellement modifié respecte l'isolation tenant, ne touche à aucune
 *    règle comptable, et n'implémente aucune accise (TEST 8, 9, 10).
 */

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { REPO_ROOT } from './supabase-usage'

function read(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Réimplémentation JS de l'algorithme SQL (fn_stock_move, migration 184)
// ═══════════════════════════════════════════════════════════════════════════

type Origine = 'achat_fournisseur' | 'production_locale' | 'import_direct'
type Mouvement = { type: string; quantite: number; origine: Origine | null }

const SIGNES_POSITIFS = ['entree', 'reception', 'ajustement', 'retour']
const SIGNES_NEGATIFS = ['sortie']

function stockSign(type: string): number {
  if (SIGNES_POSITIFS.includes(type)) return 1
  if (SIGNES_NEGATIFS.includes(type)) return -1
  return 0 // transfert : signe neutre, comme fn_stock_sign() réel (BOI-003)
}

function soldeTotal(mouvements: Mouvement[]): number {
  return mouvements.reduce((s, m) => s + stockSign(m.type) * m.quantite, 0)
}

function soldeParOrigine(mouvements: Mouvement[], origine: Origine): number {
  return mouvements
    .filter(m => m.origine === origine)
    .reduce((s, m) => s + stockSign(m.type) * m.quantite, 0)
}

/** Mirroir de la double vérification anti-négatif de fn_stock_move (migration 184). */
function peutEnregistrer(mouvements: Mouvement[], type: string, quantite: number, origine: Origine | null): boolean {
  const sign = stockSign(type)
  if (soldeTotal(mouvements) + sign * quantite < 0) return false
  if (origine != null && sign < 0) {
    if (soldeParOrigine(mouvements, origine) + sign * quantite < 0) return false
  }
  return true
}

describe('BOI-010 — logique fn_stock_move (réimplémentation JS du SQL, migration 184 non exécutée)', () => {
  it('TEST 1 — 100 achat + 100 production → 100 / 100', () => {
    const m: Mouvement[] = [
      { type: 'reception', quantite: 100, origine: 'achat_fournisseur' },
      { type: 'entree',    quantite: 100, origine: 'production_locale' },
    ]
    expect(soldeParOrigine(m, 'achat_fournisseur')).toBe(100)
    expect(soldeParOrigine(m, 'production_locale')).toBe(100)
    expect(soldeTotal(m)).toBe(200)
  })

  it('TEST 2 — sortie 30 achat → 70 / 100', () => {
    const m: Mouvement[] = [
      { type: 'reception', quantite: 100, origine: 'achat_fournisseur' },
      { type: 'entree',    quantite: 100, origine: 'production_locale' },
      { type: 'sortie',    quantite: 30,  origine: 'achat_fournisseur' },
    ]
    expect(soldeParOrigine(m, 'achat_fournisseur')).toBe(70)
    expect(soldeParOrigine(m, 'production_locale')).toBe(100)
  })

  it('TEST 3 — puis sortie 20 production → 70 / 80', () => {
    const m: Mouvement[] = [
      { type: 'reception', quantite: 100, origine: 'achat_fournisseur' },
      { type: 'entree',    quantite: 100, origine: 'production_locale' },
      { type: 'sortie',    quantite: 30,  origine: 'achat_fournisseur' },
      { type: 'sortie',    quantite: 20,  origine: 'production_locale' },
    ]
    expect(soldeParOrigine(m, 'achat_fournisseur')).toBe(70)
    expect(soldeParOrigine(m, 'production_locale')).toBe(80)
    // Le total global reste toujours la somme des soldes par origine —
    // invariant explicitement attendu par BOI-007 §3.
    expect(soldeTotal(m)).toBe(70 + 80)
  })

  it('TEST 4 — tentative de sortie 81 sur production (disponible 80) → REFUS, jamais de bascule', () => {
    const m: Mouvement[] = [
      { type: 'reception', quantite: 100, origine: 'achat_fournisseur' },
      { type: 'entree',    quantite: 100, origine: 'production_locale' },
      { type: 'sortie',    quantite: 30,  origine: 'achat_fournisseur' },
      { type: 'sortie',    quantite: 20,  origine: 'production_locale' },
    ]
    expect(peutEnregistrer(m, 'sortie', 81, 'production_locale')).toBe(false)
    // Le stock GLOBAL (achat 70 + production 80 = 150) suffirait largement à
    // 81 unités — la demande doit pourtant être refusée : le choix manuel
    // signifie que la provenance est imposée par l'utilisateur, jamais
    // remplacée silencieusement par une autre (BOI-009/BOI-010 §6).
    expect(soldeTotal(m)).toBeGreaterThan(81)
    expect(soldeParOrigine(m, 'production_locale')).toBe(80)
  })

  it('TEST 5 — produit à provenance unique : la vérification par origine et globale concordent', () => {
    const m: Mouvement[] = [
      { type: 'reception', quantite: 50, origine: 'achat_fournisseur' },
    ]
    expect(peutEnregistrer(m, 'sortie', 20, 'achat_fournisseur')).toBe(true)
    expect(soldeParOrigine(m, 'achat_fournisseur')).toBe(50)
    expect(soldeTotal(m)).toBe(50)
    // Une sortie de 51 doit être refusée, avec ou sans origine déclarée —
    // les deux vérifications (globale et par origine) sont équivalentes ici.
    expect(peutEnregistrer(m, 'sortie', 51, 'achat_fournisseur')).toBe(false)
    expect(peutEnregistrer(m, 'sortie', 51, null)).toBe(false)
  })

  it('TEST 6 — un transfert conserve la provenance (modélisation logique — stock_transferts reste déconnecté de stock_movements, BOI-003/008/009, non reconnecté par cette mission)', () => {
    // Entrepôt A : 50 production_locale. Représentation logique d'un
    // transfert de 20 vers B : une sortie de A (origine conservée) + une
    // entrée dans B (même origine) — PAS une nouvelle origine.
    const entrepotA: Mouvement[] = [{ type: 'entree', quantite: 50, origine: 'production_locale' }]
    const transfertSortieA: Mouvement = { type: 'sortie', quantite: 20, origine: 'production_locale' }
    const transfertEntreeB: Mouvement = { type: 'entree', quantite: 20, origine: 'production_locale' }

    const soldeA = soldeParOrigine([...entrepotA, transfertSortieA], 'production_locale')
    const soldeB = soldeParOrigine([transfertEntreeB], 'production_locale')

    expect(soldeA).toBe(30)
    expect(soldeB).toBe(20)
    // La provenance n'a jamais changé pendant le transfert — même valeur des
    // deux côtés, jamais une origine différente ou NULL introduite par le
    // seul fait de changer d'entrepôt.
    expect(transfertSortieA.origine).toBe(transfertEntreeB.origine)
  })

  it('TEST 7 — mouvements historiques origine=NULL : stock global inchangé, exclus des soldes par origine', () => {
    const m: Mouvement[] = [
      { type: 'entree', quantite: 40, origine: null },      // mouvement historique, avant BOI-010
      { type: 'reception', quantite: 100, origine: 'achat_fournisseur' },
      { type: 'sortie', quantite: 10, origine: null },       // sortie historique également sans origine
    ]
    // Le solde global reste la somme de TOUS les mouvements, origine=NULL compris.
    expect(soldeTotal(m)).toBe(40 + 100 - 10)
    // Mais aucun mouvement NULL ne contribue à un solde par origine spécifique.
    expect(soldeParOrigine(m, 'achat_fournisseur')).toBe(100)
    expect(soldeParOrigine(m, 'production_locale')).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Contrats statiques sur le code réellement modifié
// ═══════════════════════════════════════════════════════════════════════════

describe('BOI-010 — TEST 8 : isolation tenant sur le code modifié', () => {
  it('réception d\'achat (origine=achat_fournisseur) reste filtrée par tenant_id', () => {
    const src = read('app/api/stocks/purchases/route.ts')
    expect(src).toContain("p_origine:          'achat_fournisseur'")
    expect(src.match(/\.eq\('tenant_id', ctx\.tenantId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('/api/stock/move reste filtré par tenant_id et vérifie la propriété du produit', () => {
    const src = read('app/api/stock/move/route.ts')
    expect(src).toContain('assertResourceOwnership')
    expect(src).toContain('p_tenant_id:        ctx.tenantId')
  })

  it('POS charge la vue par origine filtrée par tenant_id', () => {
    const src = read('app/dashboard/commerce/page.tsx')
    expect(src).toMatch(/v_products_stock_par_origine[\s\S]{0,80}\.eq\('tenant_id', tid\)/)
  })

  it('la vue v_products_stock_par_origine est security_invoker (RLS de la table sous-jacente appliquée)', () => {
    const migration = read('supabase/migrations/184_stock_provenance.sql')
    expect(migration).toContain('ALTER VIEW v_products_stock_par_origine SET (security_invoker = true);')
  })
})

describe('BOI-010 — TEST 9 : aucune accise implémentée', () => {
  const files = [
    'supabase/migrations/184_stock_provenance.sql',
    'app/api/stocks/purchases/route.ts',
    'app/api/stock/move/route.ts',
    'app/dashboard/commerce/page.tsx',
  ]

  it.each(files)('%s ne contient aucune mention d\'accise, taux, ou ConfigAccise', (rel) => {
    const src = read(rel).toLowerCase()
    expect(src).not.toContain('accise')
    expect(src).not.toContain('configaccise')
    expect(src).not.toMatch(/taux_accise|p_taux/)
  })
})

describe('BOI-010 — TEST 10 : accounting_event_rules non modifié, aucune régression comptable', () => {
  it('la migration ne touche pas accounting_event_rules', () => {
    const migration = read('supabase/migrations/184_stock_provenance.sql')
    expect(migration).not.toMatch(/accounting_event_rules/i)
  })

  it('aucun nouveau compte comptable ni nouvel event_type introduit', () => {
    const migration = read('supabase/migrations/184_stock_provenance.sql')
    expect(migration).not.toMatch(/INSERT INTO accounting_event_rules/i)
  })

  it('ACH-001/ACH-002 restent émis exactement comme en BOI-004 (aucune modification du corps comptable)', () => {
    const src = read('app/api/stocks/purchases/route.ts')
    expect(src).toContain("p_event_type:    'ACH-001'")
    expect(src).toContain("p_event_type:    'ACH-002'")
  })

  it('STK-002 (sortie générique) reste émis exactement comme en BOI-004', () => {
    const src = read('app/api/stock/move/route.ts')
    expect(src).toContain("p_event_type:    'STK-002'")
  })
})

describe('BOI-010 — écrans réellement modifiés, aucune réparation d\'écran mort hors périmètre', () => {
  it('la page sorties dédiée (confirmée cassée en BOI-008) n\'est pas touchée par cette mission', () => {
    const src = read('app/dashboard/stocks/sorties/page.tsx')
    expect(src).not.toContain('origine')
    expect(src).not.toContain('purchase_item_id')
  })

  it('fn_stock_move accepte les nouveaux paramètres avec des valeurs par défaut (rétrocompatibilité)', () => {
    const migration = read('supabase/migrations/184_stock_provenance.sql')
    expect(migration).toMatch(/p_origine\s+TEXT\s+DEFAULT\s+NULL/)
    expect(migration).toMatch(/p_purchase_item_id\s+UUID\s+DEFAULT\s+NULL/)
  })

  it('aucune bascule automatique de provenance : pas de logique de sélection alternative dans fn_stock_move', () => {
    const migration = read('supabase/migrations/184_stock_provenance.sql')
    // La fonction ne doit jamais essayer une seconde origine si la première échoue.
    expect(migration).not.toMatch(/ELSE.*origine/i)
    expect(migration).not.toMatch(/COALESCE\(p_origine/i)
  })
})

describe('BOI-010B — revue statique : remplacement propre de fn_stock_move, pas de surcharge fantôme', () => {
  it('la migration DROP explicitement l\'ancienne signature à 8 paramètres avant de recréer la fonction', () => {
    const migration = read('supabase/migrations/184_stock_provenance.sql')
    // Sans ce DROP, CREATE OR REPLACE avec une liste de paramètres différente
    // crée une fonction SURCHARGÉE à côté de l'ancienne (PostgreSQL identifie
    // une fonction par nom + types de paramètres, pas par nom seul) — un
    // appel avec les 8 paramètres d'origine deviendrait ambigu entre les deux
    // signatures et échouerait avec « function is not unique ».
    expect(migration).toMatch(
      /DROP FUNCTION IF EXISTS fn_stock_move\(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT\);/,
    )
    const dropIdx = migration.indexOf('DROP FUNCTION IF EXISTS fn_stock_move')
    const createIdx = migration.indexOf('CREATE OR REPLACE FUNCTION fn_stock_move')
    expect(dropIdx).toBeGreaterThan(-1)
    expect(createIdx).toBeGreaterThan(dropIdx)
  })
})
