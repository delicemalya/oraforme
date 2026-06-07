'use client'

/**
 * compta-sync-client.ts
 *
 * Utilitaire côté client pour synchroniser TOUTE opération financière
 * avec les deux tables de comptabilité :
 *   - journal_comptable  → Tab "Journal OHADA" (comptabilité)
 *   - journal_entries    → Tab "Partie double" + "Grand Livre" (comptabilité)
 *
 * À appeler depuis n'importe quel module : Paie, Trésorerie, Facturation, etc.
 * Utilise le client supabase normal (RLS via get_my_tenant_id()).
 */

import { supabase } from '@/lib/supabase'

export interface ComptaEntryInput {
  tenantId:      string
  date:          string          // 'YYYY-MM-DD'
  libelle:       string
  type:          'recette' | 'depense'
  montant:       number          // montant net (sans TVA pour les salaires / dépenses)
  categorie:     string
  debitAccount:  string          // compte OHADA débité (ex: '641000')
  creditAccount: string          // compte OHADA crédité (ex: '521000')
  source:        string          // 'paie' | 'tresorerie' | 'prestataire' | 'factures' | ...
  sourceId?:     string          // UUID de la paie_ecole, transaction, facture, etc.
  createdBy?:    string          // auth.users.id
}

/**
 * Résolution automatique des comptes OHADA selon type + catégorie.
 * Surcharger avec debitAccount/creditAccount si besoin de précision.
 */
export const OHADA_DEFAULTS: Record<string, Record<string, [string, string]>> = {
  depense: {
    'Salaires':                  ['661', '521'],
    'Paiement prestataire':      ['621', '521'],
    'Charges de personnel':      ['661', '422'],
    'CNSS':                      ['664', '431'],
    'Loyer':                     ['622', '521'],
    'Achats / Fournisseur':      ['601', '401'],
    'Carburant / Transport':     ['605', '571'],
    'Impôts / Taxes':            ['641', '521'],
    'Charges diverses':          ['658', '571'],
    'Frais bancaires':           ['631', '521'],
    'Remboursement client':      ['419', '521'],
    'Autre dépense':             ['658', '571'],
  },
  recette: {
    "Vente / Chiffre d'affaires": ['521', '701'],
    'Vente':                      ['521', '701'],
    'Frais de scolarité':         ['571', '705'],
    'Facture payée':              ['521', '411'],
    'Prestation de services':     ['521', '705'],
    'Prestation':                 ['521', '705'],
    'Avance client':              ['521', '419'],
    'Virement reçu':              ['521', '471'],
    'Remboursement':              ['521', '409'],
    'Subvention / Don':           ['521', '711'],
    'Autre recette':              ['521', '758'],
  },
}

export function resolveOhadaAccounts(
  type: 'recette' | 'depense',
  categorie: string,
): [string, string] {
  const map = OHADA_DEFAULTS[type] ?? {}
  return map[categorie] ?? (type === 'depense' ? ['658', '571'] : ['521', '705'])
}

/**
 * Mapping catégorie métier → code OHADA "CODE — Label"
 * pour stockage dans journal_comptable.categorie.
 * La partie CODE (3 chiffres) est extraite par le Grand Livre pour regrouper les écritures.
 */
const CATEGORIE_OHADA_MAP: Record<string, string> = {
  // ── Dépenses ──────────────────────────────────────────────────────────────
  'Salaires':                   '641 — Rémunérations du personnel',
  'Charges de personnel':       '641 — Rémunérations du personnel',
  'Paiement prestataire':       '621 — Sous-traitance / Honoraires',
  'CNSS':                       '644 — Charges sociales patronales',
  'Loyer':                      '651 — Charges locatives',
  'Achats / Fournisseur':       '601 — Achats de marchandises',
  'Carburant / Transport':      '625 — Déplacements, missions, réceptions',
  'Impôts / Taxes':             '631 — Impôts, taxes et versements assimilés',
  'Charges diverses':           '628 — Autres charges diverses',
  'Frais bancaires':            '627 — Frais bancaires',
  'Remboursement client':       '419 — Clients — avoirs',
  'Autre dépense':              '628 — Autres charges diverses',
  // ── Recettes ──────────────────────────────────────────────────────────────
  "Vente / Chiffre d'affaires": '701 — Ventes de marchandises — Scolarité',
  'Vente':                      '701 — Ventes de marchandises — Scolarité',
  'Frais de scolarité':         '706 — Prestations de services',
  'Facture payée':              '411 — Clients — étudiants',
  'Prestation de services':     '706 — Prestations de services',
  'Prestation':                 '706 — Prestations de services',
  'Avance client':              '411 — Clients — étudiants',
  'Virement reçu':              '521 — Banques',
  'Remboursement':              '409 — Fournisseurs — avoirs',
  'Subvention / Don':           '773 — Subventions et dons',
  'Autre recette':              '709 — Autres produits',
}

/** Convertit une catégorie métier en format "CODE — Label" attendu par le Grand Livre. */
function toOhadaCategorie(cat: string): string {
  return CATEGORIE_OHADA_MAP[cat] ?? cat
}

/**
 * Mode de paiement → compte trésorerie OHADA
 */
export function modeToAccount(mode: string): string {
  switch (mode.toLowerCase()) {
    case 'virement':    return '521'  // Banques locales
    case 'cheque':      return '512'  // Chèques à encaisser
    case 'especes':     return '571'  // Caisse
    case 'airtel_money':return '541'  // Airtel Money
    case 'mtn_momo':    return '542'  // MTN MoMo
    case 'mobile_money':return '54'   // Instruments de monnaie électronique
    default:            return '521'
  }
}

/**
 * Écrit une entrée dans :
 *   1. journal_comptable  (vue simplifiée — Journal OHADA)
 *   2. journal_entries    (partie double — Grand Livre)
 *
 * Ne lève pas d'exception — retourne `{ ok: boolean, error?: string }`.
 */
export async function writeComptaEntry(input: ComptaEntryInput): Promise<{ ok: boolean; error?: string }> {
  const fiscalYear = new Date(input.date).getFullYear()

  try {
    // ── 1. journal_comptable ──────────────────────────────────────────────────
    const { error: jcErr } = await supabase.from('journal_comptable').insert({
      tenant_id:     input.tenantId,
      date:          input.date,
      libelle:       input.libelle,
      type:          input.type,
      montant_ht:    input.montant,
      tva:           0,
      ca:            0,
      montant_ttc:   input.montant,
      categorie:     toOhadaCategorie(input.categorie),
      debit_account: input.debitAccount,
      credit_account:input.creditAccount,
      source:        input.source,
      source_id:     input.sourceId ?? null,
      created_by:    input.createdBy ?? null,
    })
    if (jcErr) return { ok: false, error: `journal_comptable: ${jcErr.message}` }

    // ── 2. journal_entries ────────────────────────────────────────────────────
    const { error: jeErr } = await supabase.from('journal_entries').insert({
      tenant_id:      input.tenantId,
      date_operation: input.date,
      libelle:        input.libelle,
      debit_account:  input.debitAccount,
      credit_account: input.creditAccount,
      montant:        input.montant,
      source:         input.source,
      source_id:      input.sourceId ?? null,
      fiscal_year:    fiscalYear,
      created_by:     input.createdBy ?? null,
    })
    if (jeErr) return { ok: false, error: `journal_entries: ${jeErr.message}` }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Erreur inconnue' }
  }
}
