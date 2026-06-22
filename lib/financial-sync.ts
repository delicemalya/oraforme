/**
 * financial-sync.ts — Utilitaires serveur pour la synchronisation financière croisée.
 * Chaque module peut appeler ces fonctions pour enregistrer une opération financière
 * complète (transaction + écriture journal) en une seule invocation.
 */

import { supabaseAdmin } from '@/lib/supabase-server'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OperationType = 'entree' | 'sortie' | 'transfert'

export interface FinancialOperationInput {
  tenantId:     string
  type:         OperationType
  categorie:    string
  montant:      number
  libelle:      string
  dateOperation?: string     // ISO date, default today
  moyenPaiement?: string     // 'especes' | 'mobile_money' | 'virement' | 'cheque'
  source?:      string       // 'factures' | 'paie' | 'scolarite' | 'stock' | etc.
  sourceId?:    string       // UUID référence source
  debitAccount?: string      // OHADA account (override auto-mapping)
  creditAccount?: string     // OHADA account (override auto-mapping)
  fiscalYear?:  number
  costCenterId?: string
  reference?:   string
  createdBy?:   string
}

// ── Mapping comptes SYSCOHADA Révisé 2017 (codes 2-5 chiffres) ───────────────

const ACCOUNT_MAP: Record<OperationType, Record<string, [string, string]>> = {
  entree: {
    'Vente':            ['571', '701'],
    'Facture payée':    ['521', '411'],
    'Avance client':    ['521', '419'],
    'Prestation':       ['521', '705'],
    'Scolarité':        ['521', '705'],
    'Virement reçu':    ['521', '471'],
    'Remboursement':    ['521', '409'],
    'Mobile Money':     ['542', '701'],
    '__default':        ['521', '705'],
  },
  sortie: {
    'Salaires':         ['661', '422'],
    'Salaires & CNSS':  ['661', '422'],
    'CNSS':             ['664', '431'],
    'Loyer':            ['622', '521'],
    'Achats':           ['601', '401'],
    'Carburant':        ['605', '571'],
    'Taxes':            ['641', '521'],
    'Charges':          ['658', '571'],
    'Fournitures':      ['604', '571'],
    '__default':        ['658', '571'],
  },
  transfert: {
    '__default':        ['521', '571'],
  },
}

function resolveAccounts(type: OperationType, categorie: string): [string, string] {
  const map = ACCOUNT_MAP[type] ?? {}
  return map[categorie] ?? map['__default'] ?? ['521', '705']
}

// ── Fonction principale ───────────────────────────────────────────────────────

export async function recordFinancialOperation(input: FinancialOperationInput): Promise<{
  transactionId?: string
  journalEntryId?: string
  error?: string
}> {
  const today = new Date().toISOString().split('T')[0]
  const dateOp = input.dateOperation ?? today
  const fiscalYear = input.fiscalYear ?? new Date(dateOp).getFullYear()

  const [debitAccount, creditAccount] = input.debitAccount && input.creditAccount
    ? [input.debitAccount, input.creditAccount]
    : resolveAccounts(input.type, input.categorie)

  // 1. Créer la transaction dans le registre de trésorerie
  const { data: txData, error: txErr } = await supabaseAdmin
    .from('transactions')
    .insert({
      tenant_id:          input.tenantId,
      type:               input.type,
      categorie:          input.categorie,
      montant:            input.montant,
      libelle:            input.libelle,
      date:               dateOp,
      moyen_paiement:     input.moyenPaiement ?? 'especes',
      source:             input.source,
      source_id:          input.sourceId,
      debit_account:      debitAccount,
      credit_account:     creditAccount,
      reference_externe:  input.reference,
    })
    .select('id')
    .single()

  if (txErr) return { error: `Transaction: ${txErr.message}` }

  // 2. Créer l'écriture comptable dans le journal (double-entrée OHADA)
  const { data: jeData, error: jeErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      tenant_id:       input.tenantId,
      date_operation:  dateOp,
      libelle:         input.libelle,
      debit_account:   debitAccount,
      credit_account:  creditAccount,
      montant:         input.montant,
      source:          input.source ?? 'manuel',
      source_id:       input.sourceId ?? txData?.id,
      fiscal_year:     fiscalYear,
      cost_center_id:  input.costCenterId,
      reference_piece: input.reference,
      created_by:      input.createdBy,
    })
    .select('id')
    .single()

  if (jeErr) return { transactionId: txData?.id, error: `Journal: ${jeErr.message}` }

  return { transactionId: txData?.id, journalEntryId: jeData?.id }
}

// ── Shortcuts sémantiques ─────────────────────────────────────────────────────

export async function recordInvoicePayment(params: {
  tenantId: string; factureId: string; invoiceNumber: string
  montant: number; datePayment?: string; moyen?: string
}) {
  return recordFinancialOperation({
    tenantId:      params.tenantId,
    type:          'entree',
    categorie:     'Facture payée',
    montant:       params.montant,
    libelle:       `Règlement facture ${params.invoiceNumber}`,
    dateOperation: params.datePayment,
    moyenPaiement: params.moyen ?? 'virement',
    source:        'factures',
    sourceId:      params.factureId,
    reference:     params.invoiceNumber,
  })
}

export async function recordSalaryPayment(params: {
  tenantId: string; ficheId: string; employe: string
  salaire: number; periode: string; datePayment?: string
}) {
  return recordFinancialOperation({
    tenantId:      params.tenantId,
    type:          'sortie',
    categorie:     'Salaires',
    montant:       params.salaire,
    libelle:       `Salaire ${params.employe} — ${params.periode}`,
    dateOperation: params.datePayment,
    moyenPaiement: 'virement',
    source:        'fiches_paie',
    sourceId:      params.ficheId,
  })
}

export async function recordStudentPayment(params: {
  tenantId: string; paiementId: string; etudiant: string
  montant: number; libelle?: string; mode?: string
}) {
  return recordFinancialOperation({
    tenantId:      params.tenantId,
    type:          'entree',
    categorie:     'Scolarité',
    montant:       params.montant,
    libelle:       params.libelle ?? `Frais scolarité — ${params.etudiant}`,
    moyenPaiement: params.mode ?? 'especes',
    source:        'paiements_scolaires',
    sourceId:      params.paiementId,
  })
}

export async function recordStockPurchase(params: {
  tenantId: string; reference: string; fournisseur: string
  montant: number; dateAchat?: string
}) {
  return recordFinancialOperation({
    tenantId:      params.tenantId,
    type:          'sortie',
    categorie:     'Achats',
    montant:       params.montant,
    libelle:       `Achat stock ${params.fournisseur} — ${params.reference}`,
    dateOperation: params.dateAchat,
    moyenPaiement: 'virement',
    source:        'achats',
    reference:     params.reference,
  })
}
