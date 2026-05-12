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

// ── Mapping comptes OHADA (miroir de accounting-engine.ts côté serveur) ───────

const ACCOUNT_MAP: Record<OperationType, Record<string, [string, string]>> = {
  entree: {
    'Vente':            ['571000', '707000'],
    'Facture payée':    ['521000', '411000'],
    'Avance client':    ['571000', '411000'],
    'Prestation':       ['571000', '706000'],
    'Scolarité':        ['571000', '706000'],
    'Virement reçu':    ['521000', '709000'],
    'Remboursement':    ['571000', '409000'],
    'Mobile Money':     ['571100', '707000'],
    '__default':        ['571000', '709000'],
  },
  sortie: {
    'Salaires':         ['641000', '421000'],
    'Salaires & CNSS':  ['641000', '421000'],
    'CNSS':             ['644000', '431000'],
    'Loyer':            ['651000', '521000'],
    'Achats':           ['601000', '401000'],
    'Carburant':        ['601000', '571000'],
    'Taxes':            ['447000', '521000'],
    'Charges':          ['651000', '571000'],
    'Fournitures':      ['604000', '571000'],
    '__default':        ['651000', '571000'],
  },
  transfert: {
    '__default':        ['521000', '571000'],
  },
}

function resolveAccounts(type: OperationType, categorie: string): [string, string] {
  const map = ACCOUNT_MAP[type] ?? {}
  return map[categorie] ?? map['__default'] ?? ['571000', '709000']
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
      date_operation:     dateOp,
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
