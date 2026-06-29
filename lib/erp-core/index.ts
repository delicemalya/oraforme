/**
 * lib/erp-core/index.ts
 *
 * ERP Core — Point d'entrée unique.
 * Une seule vérité métier. Une seule logique. Toutes les pages consomment ici.
 *
 * Architecture :
 *   filters/context.ts   → ERPContext, buildERPContext(), buildDateRange()
 *   compute/payroll.ts   → computePayrollSummary()  [masse salariale]
 *   compute/tresorerie.ts → computeTresorerie()     [trésorerie totale]
 *   compute/ca.ts        → computeCA()              [CA + flux]
 *   compute/ebitda.ts    → computeEBITDA()          [EBITDA + résultat net]
 *   compute/clients.ts   → computeClientsSummary(), computeFournisseursSummary()
 *   compute/stock.ts     → computeStockSummary()
 */

// ── Filtres ───────────────────────────────────────────────────────────────────
export type { ERPContext, ERPDateRange }                   from './filters/context'
export { buildERPContext, buildDateRange, buildMonthKeys, MONTH_LABELS_FR } from './filters/context'

// ── Paie ──────────────────────────────────────────────────────────────────────
export type { PayrollSummary, PayrollMonthPoint, BulletinRow } from './compute/payroll'
export { computePayrollSummary, BULLETIN_SELECT }              from './compute/payroll'

// ── Trésorerie ────────────────────────────────────────────────────────────────
export type { TresoSummary, CompteDetail, BanqueRow, CaisseRow, WalletRow } from './compute/tresorerie'
export { computeTresorerie, BANQUE_SELECT, CAISSE_SELECT, WALLET_SELECT }   from './compute/tresorerie'

// ── CA / Flux ─────────────────────────────────────────────────────────────────
export type { CASummary, CAMonthPoint, TransactionRow, FactureRow } from './compute/ca'
export { computeCA, TRANSACTION_SELECT, FACTURE_SELECT }            from './compute/ca'

// ── EBITDA ────────────────────────────────────────────────────────────────────
export type { EBITDASummary, JournalRow } from './compute/ebitda'
export { computeEBITDA, JOURNAL_SELECT }  from './compute/ebitda'

// ── Clients / Fournisseurs ────────────────────────────────────────────────────
export type { ClientsSummary, FournisseursSummary, FactureRow as FactureClientsRow, AchatRow } from './compute/clients'
export { computeClientsSummary, computeFournisseursSummary, FACTURE_CLIENTS_SELECT, ACHAT_FOURNI_SELECT } from './compute/clients'

// ── Stock ─────────────────────────────────────────────────────────────────────
export type { StockSummary, ArticleRow }      from './compute/stock'
export { computeStockSummary, ARTICLE_SELECT } from './compute/stock'

// ── Comptabilité SYSCOHADA ────────────────────────────────────────────────────
export type {
  JournalLedgerRow, JournalBalanceRow, AccountAggregation,
  BalanceLine, BalanceSummary, GrandLivreCompte, GrandLivreSummary,
  TVAMonthPoint, TVASummary,
} from './compute/accounting'
export {
  aggregateByAccount, computeBalance, computeGrandLivre, computeTVAFromJournal,
  BALANCE_SELECT, GRAND_LIVRE_SELECT, TVA_COLLECTEE_ACCOUNTS, TVA_DEDUCTIBLE_ACCOUNTS,
} from './compute/accounting'

// ── Fiscal (CNSS, IRPP, charges patronales) ───────────────────────────────────
export type {
  BulletinFiscalRow, CNSSMonthPoint, CNSSSummary,
  IRPPMonthPoint, IRPPSummary, FiscalPayrollSummary, FiscalMonthPoint,
} from './compute/fiscal'
export {
  computePayrollFiscal, computeCNSSSummary, computeIRPPSummary,
  BULLETIN_FISCAL_SELECT,
} from './compute/fiscal'

// ── Paiements & Recouvrement ──────────────────────────────────────────────────
export type {
  PaymentRow, FactureStatutRow, PaymentByMode, CollectionStatus, PaymentMonthPoint,
} from './compute/payments'
export {
  aggregatePaymentsByMode, computeCollectionStatus, computePaymentsTrend, sumAmount,
  PAYMENT_SELECT, FACTURE_STATUS_SELECT,
} from './compute/payments'
