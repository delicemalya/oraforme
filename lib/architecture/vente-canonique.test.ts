/**
 * Tests statiques — C6 (vente canonique)
 *
 * Vérifient des propriétés structurelles/sécuritaires par lecture du code
 * source (migration + routes), sans exécution DB. Ne prouvent PAS le
 * comportement réel en production — voir
 * lib/architecture/sales-route.integration.test.ts pour l'exécution réelle
 * (mockée) de la logique d'orchestration, et docs/C6-IMPLEMENTATION-REPORT.md
 * section 14 pour ce qui reste NOT_TESTABLE sans canal DB.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { REPO_ROOT } from './supabase-usage'

function read(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf-8')
}

// Lecture sans commentaires — un commentaire qui NOMME une valeur interdite
// (pour expliquer pourquoi elle est interdite) ne doit pas se faire passer
// pour une violation réelle du code exécuté.
function readCodeOnly(rel: string): string {
  return read(rel)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

const MIGRATION = 'supabase/migrations/185_vente_canonique.sql'
const MIGRATION_184 = 'supabase/migrations/184_stock_provenance.sql'
const MIGRATION_186 = 'supabase/migrations/186_vente_atomic_et_reverse_idempotent.sql'
const ROUTES = [
  'app/api/sales/route.ts',
  'app/api/sales/[id]/route.ts',
  'app/api/sales/[id]/paiement/route.ts',
  'app/api/sales/[id]/reverse/route.ts',
]

describe('C6 — gateway tenant canonique (pas tenant-guard.ts, pas de tenant_id client)', () => {
  for (const route of ROUTES) {
    it(`${route} utilise requireTenant()/requireRole() de require-tenant.ts`, () => {
      const src = read(route)
      expect(src).toContain("from '@/lib/api/require-tenant'")
      expect(src).not.toContain("from '@/lib/tenant-guard'")
      expect(src).toMatch(/require(Tenant|Role)\(/)
    })

    it(`${route} ne lit jamais tenant_id depuis le body/query client`, () => {
      const src = read(route)
      expect(src).not.toMatch(/body\.tenant_id/)
      expect(src).not.toMatch(/searchParams\.get\('tenant_id'\)/)
    })
  }
})

describe('C6 — aucun taux fiscal codé en dur dans le nouveau flux', () => {
  it('app/api/sales/route.ts et commerce/page.tsx utilisent decomposerTTCUnifie, jamais un taux local', () => {
    for (const file of ['app/api/sales/route.ts', 'app/dashboard/commerce/page.tsx']) {
      const src = readCodeOnly(file)
      expect(src).toContain('decomposerTTCUnifie')
      // Interdiction explicite (Phase 6) : aucun taux recopié dans le nouveau code.
      expect(src).not.toMatch(/0\.18\b/)
      expect(src).not.toMatch(/0\.05\b/)
      expect(src).not.toMatch(/0\.189\b/)
      expect(src).not.toMatch(/0\.075\b/)
    }
  })
})

describe('C6 — coût des marchandises vendues : products.prix_achat, pas un PMP inventé', () => {
  it("app/api/sales/route.ts lit prix_achat depuis products, n'invente aucune valorisation", () => {
    const src = read('app/api/sales/route.ts')
    expect(src).toContain('prix_achat')
    expect(src).not.toMatch(/\bpmp\b/i)
    expect(src).not.toMatch(/fifo/i)
  })
})

describe('C6 — STK-002 n\'est jamais réutilisée comme identité de vente', () => {
  it('ni app/api/sales/route.ts, ni les migrations 185/186 n\'émettent STK-002', () => {
    for (const file of ['app/api/sales/route.ts', MIGRATION, MIGRATION_186]) {
      const src = read(file)
      expect(src).not.toMatch(/'STK-002'/)
    }
  })
})

describe('C6 — idempotence : contrainte UNIQUE comme autorité, pas SELECT puis INSERT', () => {
  it('la migration 185 crée un index UNIQUE partiel scopé tenant sur idempotency_key', () => {
    const src = read(MIGRATION)
    expect(src).toMatch(/CREATE UNIQUE INDEX idx_ventes_tenant_idempotency/)
    expect(src).toMatch(/ON ventes \(tenant_id, idempotency_key\)/)
    expect(src).toMatch(/WHERE idempotency_key IS NOT NULL/)
  })

  it('fn_create_vente_atomique (migration 186) tente l\'INSERT via ON CONFLICT DO NOTHING, jamais un SELECT préalable non protégé', () => {
    const src = read(MIGRATION_186)
    const insertIdx = src.indexOf('INSERT INTO ventes (')
    const conflictIdx = src.indexOf('ON CONFLICT (tenant_id, idempotency_key)')
    expect(insertIdx).toBeGreaterThan(-1)
    expect(conflictIdx).toBeGreaterThan(-1)
    expect(conflictIdx).toBeGreaterThan(insertIdx)
  })
})

describe('C6-POST-REVIEW-FIX — A1 : point transactionnel unique, pas une fausse transaction frontend', () => {
  it('app/api/sales/route.ts appelle fn_create_vente_atomique, jamais directement fn_stock_move ou emit_accounting_event', () => {
    const src = readCodeOnly('app/api/sales/route.ts')
    expect(src).toContain("rpc('fn_create_vente_atomique'")
    expect(src).not.toContain("rpc('fn_stock_move'")
    expect(src).not.toContain("rpc('emit_accounting_event'")
  })

  it('fn_create_vente_atomique (migration 186) orchestre lignes + fn_stock_move + emit_accounting_event, et vérifie explicitement le statut comptable', () => {
    const src = read(MIGRATION_186)
    expect(src).toContain('CREATE OR REPLACE FUNCTION fn_create_vente_atomique')
    expect(src).toContain('INSERT INTO vente_lignes')
    expect(src).toMatch(/PERFORM fn_stock_move\(/)
    expect(src).toContain('emit_accounting_event(')
    // A2 : ne jamais déduire le succès comptable de l'absence d'erreur de
    // l'appel — relecture explicite du statut, sinon RAISE EXCEPTION (annule
    // toute la transaction).
    expect(src).toMatch(/SELECT status INTO v_ae_status FROM accounting_events/)
    expect(src).toMatch(/IF v_ae_status IS DISTINCT FROM 'processed' THEN/)
  })

  it('fn_stock_move passe de 10 à 11 paramètres avec le même garde-fou de signature que 184 (DROP explicite avant CREATE)', () => {
    const src = read(MIGRATION_186)
    const dropIdx = src.indexOf('DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID);')
    const createIdx = src.indexOf('CREATE OR REPLACE FUNCTION fn_stock_move(')
    expect(dropIdx).toBeGreaterThan(-1)
    expect(createIdx).toBeGreaterThan(dropIdx)
    expect(src).toContain('p_reversed_movement_id UUID DEFAULT NULL')
  })
})

describe('C6-185-CA-FIX — Centime Additionnel (447) : metadata.ca, jamais montant_ca', () => {
  it('les séquences 3 et 6 de VTE-001 utilisent metadata.ca (montant_ca n\'existe sur aucune colonne de accounting_events)', () => {
    const src = read(MIGRATION)
    expect(src).toMatch(/'VTE-001', 3, 1, 'active',\s*\n\s*'521', '447',\s*\n\s*'metadata\.ca', NULL, 'treasury_debit'/)
    expect(src).toContain('"field":"metadata.ca","op":">"')
    expect(src).toMatch(/'VTE-001', 6, 1, 'active',\s*\n\s*'411', '447',\s*\n\s*'metadata\.ca', NULL, NULL/)
    // Régression : l'ancien champ invalide ne doit plus apparaître dans les
    // définitions de règles (seule la colonne ventes.montant_ca, sans rapport,
    // peut légitimement contenir cette sous-chaîne ailleurs dans le fichier).
    expect(src).not.toMatch(/'montant_ca', NULL/)
    expect(src).not.toContain('"field":"montant_ca"')
  })

  it('fn_create_vente_atomique (migration 186) propage p_montant_ca dans metadata.ca — sans quoi la règle ne résoudrait jamais rien', () => {
    const src = readCodeOnly(MIGRATION_186)
    expect(src).toMatch(/'ca', p_montant_ca/)
  })
})

describe('C6-POST-REVIEW-FIX — B1 : purchase_item_id isolé par tenant, côté route ET côté DB', () => {
  it('app/api/sales/route.ts valide purchase_item_id contre purchases.tenant_id avant tout RPC', () => {
    const src = readCodeOnly('app/api/sales/route.ts')
    expect(src).toContain("from('purchase_items')")
    expect(src).toContain("eq('purchases.tenant_id', ctx.tid)")
  })

  it('fn_stock_move (migrations 184 et 186) refuse un purchase_item_id hors tenant au niveau DB, pas seulement côté route', () => {
    for (const file of [MIGRATION_184, MIGRATION_186]) {
      const src = read(file)
      expect(src).toMatch(/JOIN purchases p ON p\.id = pi\.purchase_id/)
      expect(src).toMatch(/WHERE pi\.id = p_purchase_item_id AND p\.tenant_id = p_tenant_id/)
    }
  })
})

describe('C6-POST-REVIEW-FIX — C1 : reverse idempotent côté comptable ET côté stock', () => {
  it('app/api/sales/[id]/reverse/route.ts distingue les événements déjà \'reversed\' avant d\'appeler fn_reverse_accounting_event', () => {
    const src = readCodeOnly('app/api/sales/[id]/reverse/route.ts')
    expect(src).toContain("in('status', ['processed', 'reversed'])")
    expect(src).toMatch(/if \(ev\.status === 'reversed'\)/)
  })

  it('app/api/sales/[id]/reverse/route.ts transmet p_reversed_movement_id et traite 23505 comme un no-op, pas un échec', () => {
    const src = readCodeOnly('app/api/sales/[id]/reverse/route.ts')
    expect(src).toContain('p_reversed_movement_id: m.id')
    expect(src).toMatch(/error\.code === '23505'/)
  })

  it('migration 186 ajoute une contrainte UNIQUE partielle sur reversed_movement_id (autorité d\'idempotence, pas un second moteur)', () => {
    const src = read(MIGRATION_186)
    expect(src).toContain('ADD COLUMN reversed_movement_id UUID NULL REFERENCES stock_movements(id)')
    expect(src).toMatch(/CREATE UNIQUE INDEX idx_stock_movements_reversed_movement/)
    expect(src).toMatch(/ON stock_movements \(reversed_movement_id\)/)
    expect(src).toMatch(/WHERE reversed_movement_id IS NOT NULL/)
  })
})

describe('C6-POST-REVIEW-FIX — A2 : VTE-002 refusé si VTE-001 n\'est pas confirmé \'processed\'', () => {
  it('app/api/sales/[id]/paiement/route.ts relit accounting_events plutôt que de faire confiance à l\'existence de la vente', () => {
    const src = readCodeOnly('app/api/sales/[id]/paiement/route.ts')
    expect(src).toContain("eq('event_type', 'VTE-001')")
    expect(src).toMatch(/vte001\.status !== 'processed'/)
    // Jamais un statut envoyé par le client comme preuve de succès comptable.
    expect(src).not.toMatch(/body\.vte001_status/)
    expect(src).not.toMatch(/body\.accounting_status/)
  })

  it('un retry sur une vente déjà réglée (\'solde\') est traité comme un replay, pas une ré-émission', () => {
    const src = readCodeOnly('app/api/sales/[id]/paiement/route.ts')
    expect(src).toMatch(/statut_paiement === 'solde'/)
    expect(src).toMatch(/replay: true/)
  })
})

describe('C6 — VTE-001 : 7 séquences (pas 4), découverte documentée dans la migration', () => {
  it('la migration contient exactement 7 INSERT de règles VTE-001 et 1 pour VTE-002', () => {
    const src = read(MIGRATION)
    const vte001Count = (src.match(/'VTE-001', [1-7], 1, 'active'/g) ?? []).length
    expect(vte001Count).toBe(7)
    expect(src).toContain("'VTE-002', 1, 1, 'active'")
  })

  it('les séquences comptant utilisent treasury_debit avec un placeholder debit_account (jamais NULL), les séquences crédit utilisent 411 statique', () => {
    const src = read(MIGRATION)
    // C6-185-FIX : accounting_event_rules.debit_account est NOT NULL (migration
    // 138) — un treasury_debit doit stocker un placeholder (même patron que
    // FAC-002/139, '521'), jamais NULL littéral. Régression détectée par
    // exécution PostgreSQL réelle (docs/DB-LOCAL-C6-HARNESS.md §11), pas par
    // une revue statique seule — ce test verrouille le correctif.
    expect(src).toMatch(/'VTE-001', 1, 1, 'active',\s*\n\s*'521', '701',\s*\n\s*'montant_ht', NULL, 'treasury_debit'/)
    expect(src).not.toMatch(/'VTE-001', 1, 1, 'active',\s*\n\s*NULL,/)
    expect(src).toMatch(/'VTE-001', 4, 1, 'active',\s*\n\s*'411', '701'/)
  })

  it('aucune séquence treasury_debit/treasury_credit de VTE-001/VTE-002 ne stocke un debit_account/credit_account NULL littéral', () => {
    const src = read(MIGRATION)
    // Recherche générique : toute ligne qui déclare account_resolver
    // treasury_debit/treasury_credit doit avoir fourni une valeur non-NULL
    // pour debit_account (1er champ après status) — la contrainte NOT NULL
    // de accounting_event_rules (migration 138) l'exige, quelle que soit la
    // valeur réellement utilisée à l'exécution (écrasée par le resolver).
    const treasuryRows = src.match(/'VTE-00[12]', \d, 1, 'active',\s*\n\s*(NULL|'\d+'), '\d+',[\s\S]*?'treasury_(debit|credit)'/g) ?? []
    expect(treasuryRows.length).toBeGreaterThan(0) // confirme que le pattern cible bien des lignes réelles
    for (const row of treasuryRows) {
      expect(row).not.toMatch(/'active',\s*\n\s*NULL,/)
    }
  })

  it('la séquence coût (7) utilise metadata.cout_marchandises, comptes 601/311, condition >0', () => {
    const src = read(MIGRATION)
    expect(src).toMatch(/'VTE-001', 7, 1, 'active',\s*\n\s*'601', '311'/)
    expect(src).toContain("'metadata.cout_marchandises'")
    expect(src).toContain('"field":"metadata.cout_marchandises","op":">"')
  })

  it('aucune séquence ne modifie ou ne supprime une règle existante (FAC-001, BOI-001, STK-002)', () => {
    const src = read(MIGRATION)
    expect(src).not.toMatch(/UPDATE accounting_event_rules[\s\S]*?event_type\s*=\s*'(FAC|BOI|STK)/)
    expect(src).not.toMatch(/DELETE FROM accounting_event_rules[\s\S]*?event_type\s*=\s*'(FAC|BOI|STK)/)
  })
})

describe('C6 — D1 : fiscalité au niveau ventes uniquement, vente_lignes inchangée', () => {
  it('la migration ajoute montant_ht/tva/ca sur ventes, aucune colonne fiscale sur vente_lignes', () => {
    const src = read(MIGRATION)
    expect(src).toMatch(/ALTER TABLE ventes[\s\S]*montant_ht/)
    expect(src).not.toMatch(/ALTER TABLE vente_lignes/)
  })
})

describe('C6 — D3 : destinataire obligatoire pour une vente à crédit', () => {
  it('app/api/sales/route.ts refuse une vente credit sans destinataire', () => {
    const src = read('app/api/sales/route.ts')
    expect(src).toMatch(/mode_paiement === 'credit' && !destinataire\?\.trim\(\)/)
  })

  it('commerce/page.tsx désactive la validation si credit sans client', () => {
    const src = read('app/dashboard/commerce/page.tsx')
    expect(src).toContain('creditSansClient')
  })
})

describe('C6 — D2 : stocks/sorties converge vers /api/sales pour la branche vente uniquement', () => {
  it("handleCreateVente appelle /api/sales, les 5 autres raisons restent sur l'ancien code", () => {
    const src = read('app/dashboard/stocks/sorties/page.tsx')
    expect(src).toContain('handleCreateVente')
    expect(src).toContain("fetch('/api/sales'")
    // Les 5 autres raisons continuent d'utiliser fn_stock_move/writeComptaEntry
    // directement (hors périmètre C6, non modifiées).
    expect(src).toContain("['perte', 'don'].includes(form.type_sortie)")
  })

  it("n'a pas créé de table sorties/sortie_lignes (confirmé absentes en production, C6-SCHEMA-VALIDATION)", () => {
    const src = read(MIGRATION)
    expect(src).not.toMatch(/CREATE TABLE.*sortie/i)
  })
})

describe('C6 — reverse : fn_reverse_accounting_event générique réutilisé, pas un second moteur', () => {
  it("app/api/sales/[id]/reverse/route.ts n'implémente aucune logique d'inversion manuelle des comptes", () => {
    const src = read('app/api/sales/[id]/reverse/route.ts')
    expect(src).toContain('fn_reverse_accounting_event')
    expect(src).not.toMatch(/debit_account.*=.*credit_account|inverser.*compte/i)
  })

  it('VTE-002 est extourné avant VTE-001 si les deux existent', () => {
    const src = read('app/api/sales/[id]/reverse/route.ts')
    expect(src).toMatch(/VTE-002.*-1.*:.*0/)
  })
})

describe('C6 — paiement crédit : structure FAC-002 réutilisée, pas un nouveau payment engine', () => {
  it("app/api/sales/[id]/paiement/route.ts émet VTE-002 via emit_accounting_event, source_table='ventes'", () => {
    const src = read('app/api/sales/[id]/paiement/route.ts')
    expect(src).toContain("p_event_type:    'VTE-002'")
    expect(src).toContain("p_source_table:  'ventes'")
  })
})
