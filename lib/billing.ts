/**
 * lib/billing.ts — Types, constantes et utilitaires pour le moteur SaaS Billing
 * Compatible avec la migration 062_billing_saas.sql
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BillingPlanType = 'core' | 'industry_pack' | 'addon'

export type SubscriptionStatut =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'expired'

export type SubscriptionPeriode = 'mensuel' | 'annuel'

export type PaymentProvider =
  | 'airtel_money'
  | 'mtn_money'
  | 'orange_money'
  | 'stripe'
  | 'paypal'
  | 'bank_transfer'
  | 'cheque'
  | 'manual'

export type InvoiceStatut = 'draft' | 'sent' | 'paid' | 'past_due' | 'cancelled'

export type PaymentStatut = 'pending' | 'processing' | 'confirmed' | 'failed' | 'refunded'

export interface BillingPlan {
  id:             string
  code:           string
  nom:            string
  description:    string | null
  type:           BillingPlanType
  secteur_cible:  string | null
  prix_mensuel:   number
  prix_annuel:    number | null
  devise:         string
  modules_inclus: string[]
  max_users:      number | null
  max_clients:    number | null
  max_storage_gb: number | null
  trial_days:     number
  is_active:      boolean
  sort_order:     number
  metadata:       Record<string, unknown>
  created_at:     string
  updated_at:     string
}

export interface BillingSubscription {
  id:                    string
  tenant_id:             string
  plan_id:               string
  statut:                SubscriptionStatut
  periode:               SubscriptionPeriode
  date_debut:            string
  date_fin:              string | null
  trial_ends_at:         string | null
  next_billing_date:     string | null
  montant_actuel:        number
  devise:                string
  modules_extra:         string[]
  montant_addons:        number
  stripe_subscription_id: string | null
  stripe_customer_id:    string | null
  created_at:            string
  updated_at:            string
  billing_plans?:        BillingPlan
}

export interface BillingInvoice {
  id:              string
  tenant_id:       string
  subscription_id: string | null
  numero:          string
  statut:          InvoiceStatut
  periode_debut:   string
  periode_fin:     string
  montant_ht:      number
  tva_pct:         number
  montant_tva:     number
  montant_ttc:     number
  montant_paye:    number
  devise:          string
  date_echeance:   string | null
  date_paiement:   string | null
  notes:           string | null
  created_at:      string
  updated_at:      string
}

export interface BillingPayment {
  id:               string
  tenant_id:        string
  invoice_id:       string | null
  subscription_id:  string | null
  provider:         PaymentProvider
  montant:          number
  devise:           string
  statut:           PaymentStatut
  reference:        string | null
  numero_transaction: string | null
  phone_number:     string | null
  notes:            string | null
  confirmed_at:     string | null
  created_at:       string
  updated_at:       string
}

// ─── Libellés ─────────────────────────────────────────────────────────────────

export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  airtel_money:  'Airtel Money',
  mtn_money:     'MTN Mobile Money',
  orange_money:  'Orange Money',
  stripe:        'Stripe (Carte)',
  paypal:        'PayPal',
  bank_transfer: 'Virement bancaire',
  cheque:        'Chèque',
  manual:        'Paiement manuel',
}

export const PROVIDER_LOGOS: Record<PaymentProvider, string> = {
  airtel_money:  '🔴',
  mtn_money:     '🟡',
  orange_money:  '🟠',
  stripe:        '💳',
  paypal:        '🔵',
  bank_transfer: '🏦',
  cheque:        '📄',
  manual:        '✍️',
}

export const MOBILE_MONEY_PROVIDERS: PaymentProvider[] = [
  'airtel_money',
  'mtn_money',
  'orange_money',
]

export const SUB_STATUT_LABELS: Record<SubscriptionStatut, string> = {
  trial:     'Essai gratuit',
  active:    'Actif',
  past_due:  'Paiement en retard',
  suspended: 'Suspendu',
  cancelled: 'Résilié',
  expired:   'Expiré',
}

export const SUB_STATUT_COLORS: Record<SubscriptionStatut, { bg: string; text: string; border: string }> = {
  trial:     { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  active:    { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  past_due:  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  suspended: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  cancelled: { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' },
  expired:   { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' },
}

export const INVOICE_STATUT_LABELS: Record<InvoiceStatut, string> = {
  draft:    'Brouillon',
  sent:     'Envoyée',
  paid:     'Payée',
  past_due: 'En retard',
  cancelled:'Annulée',
}

export const INVOICE_STATUT_COLORS: Record<InvoiceStatut, { bg: string; text: string }> = {
  draft:    { bg: '#F9FAFB', text: '#6B7280' },
  sent:     { bg: '#EFF6FF', text: '#2563EB' },
  paid:     { bg: '#F0FDF4', text: '#16A34A' },
  past_due: { bg: '#FEF2F2', text: '#DC2626' },
  cancelled:{ bg: '#F9FAFB', text: '#9CA3AF' },
}

export const PAYMENT_STATUT_LABELS: Record<PaymentStatut, string> = {
  pending:    'En attente',
  processing: 'En cours',
  confirmed:  'Confirmé',
  failed:     'Échoué',
  refunded:   'Remboursé',
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

export function trialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const end = new Date(trialEndsAt).getTime()
  const now = Date.now()
  const diff = Math.ceil((end - now) / 86400000)
  return Math.max(0, diff)
}

export function trialPercent(trialEndsAt: string | null, trialDays: number): number {
  if (!trialEndsAt || trialDays <= 0) return 0
  const daysLeft = trialDaysLeft(trialEndsAt)
  return Math.round(((trialDays - daysLeft) / trialDays) * 100)
}

export function computeMRR(sub: BillingSubscription): number {
  if (sub.statut === 'cancelled' || sub.statut === 'expired') return 0
  const base = sub.periode === 'annuel'
    ? (sub.montant_actuel / 12)
    : sub.montant_actuel
  return base + (sub.montant_addons ?? 0)
}

export function computeARR(sub: BillingSubscription): number {
  return computeMRR(sub) * 12
}

export function fmtFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style:    'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function annualDiscount(plan: BillingPlan): number {
  if (!plan.prix_annuel || plan.prix_mensuel <= 0) return 0
  const annualIfMonthly = plan.prix_mensuel * 12
  const saved = annualIfMonthly - plan.prix_annuel
  return Math.round((saved / annualIfMonthly) * 100)
}

export function isSubscriptionActive(statut: SubscriptionStatut): boolean {
  return statut === 'active' || statut === 'trial'
}

export function subscriptionNeedsAttention(statut: SubscriptionStatut): boolean {
  return statut === 'past_due' || statut === 'suspended'
}
