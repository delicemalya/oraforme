'use client'

import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  CreditCard, CheckCircle2, AlertTriangle, Clock,
  Zap, Package, ChevronRight, X, Phone, FileText,
  TrendingUp, Calendar, RefreshCw,
} from 'lucide-react'
import type {
  BillingSubscription, BillingInvoice, BillingPayment,
  PaymentProvider,
} from '@/lib/billing'
import {
  SUB_STATUT_LABELS, SUB_STATUT_COLORS, INVOICE_STATUT_LABELS,
  INVOICE_STATUT_COLORS, PROVIDER_LABELS, MOBILE_MONEY_PROVIDERS,
  PAYMENT_STATUT_LABELS, trialDaysLeft,
} from '@/lib/billing'
import { TRIAL_DAYS } from '@/lib/plans'

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface PaymentForm {
  provider:          PaymentProvider
  phone:             string
  provider_reference: string
  description:       string
}

const EMPTY_FORM: PaymentForm = {
  provider:           'mtn_money',
  phone:              '',
  provider_reference: '',
  description:        '',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AbonnementPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { t } = useLocale()
  const { tenantId, loading: authLoading } = useTenant()

  const [sub,      setSub]      = useState<BillingSubscription | null>(null)
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [modalInvoice, setModalInvoice] = useState<BillingInvoice | null>(null)
  const [form,         setForm]         = useState<PaymentForm>(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [saveOk,       setSaveOk]       = useState(false)

  // ── Chargement ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return
    load()
  }, [tenantId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [subRes, invRes, payRes] = await Promise.all([
        supabase
          .from('billing_subscriptions')
          .select('*, billing_plans(*)')
          .eq('tenant_id', tenantId!)
          .not('statut', 'in', '("cancelled","expired")')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('billing_invoices')
          .select('*')
          .eq('tenant_id', tenantId!)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('billing_payments')
          .select('*')
          .eq('tenant_id', tenantId!)
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      if (subRes.error) throw subRes.error
      if (invRes.error) throw invRes.error
      if (payRes.error) throw payRes.error
      setSub(subRes.data as unknown as BillingSubscription | null)
      setInvoices((invRes.data ?? []) as unknown as BillingInvoice[])
      setPayments((payRes.data ?? []) as unknown as BillingPayment[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  // ── Paiement ──────────────────────────────────────────────────────────────

  async function submitPayment() {
    if (!modalInvoice || !tenantId) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('billing_payments').insert({
        tenant_id:          tenantId,
        invoice_id:         modalInvoice.id,
        subscription_id:    sub?.id ?? null,
        provider:           form.provider,
        montant:            modalInvoice.montant_total - modalInvoice.montant_paye,
        devise:             modalInvoice.devise,
        statut:             'pending',
        provider_reference: form.provider_reference || null,
        phone_number:       form.phone || null,
        description:        form.description || null,
      })
      if (err) throw err
      setSaveOk(true)
      setTimeout(() => {
        setSaveOk(false)
        setModalInvoice(null)
        setForm(EMPTY_FORM)
        load()
      }, 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de paiement')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  const plan     = sub?.billing_plans
  const statut   = sub?.statut ?? 'expired'
  const sColor   = SUB_STATUT_COLORS[statut]
  const daysLeft = trialDaysLeft(sub?.trial_ends_at ?? null)

  const unpaidInvoices = invoices.filter(i => i.statut === 'pending' || i.statut === 'overdue')
  const totalDue       = unpaidInvoices.reduce((s, i) => s + (i.montant_total - i.montant_paye), 0)

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Mon Abonnement</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérer votre plan, factures et paiements</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Plan actuel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
            <Package size={16} className="text-gray-400" /> Plan actuel
          </h2>
          <span
            className="text-[11px] font-bold px-3 py-1 rounded-full border"
            style={{ background: sColor.bg, color: sColor.text, borderColor: sColor.border }}
          >
            {SUB_STATUT_LABELS[statut]}
          </span>
        </div>

        {!sub ? (
          <div className="px-6 py-10 text-center text-gray-400">
            <CreditCard size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun abonnement actif</p>
            <p className="text-xs mt-1">Contactez votre administrateur pour activer un plan.</p>
          </div>
        ) : (
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plan */}
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Plan</p>
              <p className="text-[17px] font-bold text-gray-900">{plan?.nom ?? '—'}</p>
              {plan?.description && (
                <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
              )}
            </div>
            {/* Montant */}
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{t('common.amount')}</p>
              <p className="text-[17px] font-bold text-gray-900">{fmtFCFA(sub.montant_actuel)}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                par {sub.periode === 'annuel' ? 'an' : 'mois'}
                {sub.montant_addons > 0 && ` + ${fmtFCFA(sub.montant_addons)} add-ons`}
              </p>
            </div>
            {/* Renouvellement / Essai */}
            <div>
              {statut === 'trial' ? (
                <>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Essai gratuit</p>
                  <p className="text-[17px] font-bold text-blue-600">{daysLeft} jours restants</p>
                  {sub.trial_ends_at && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Expire le {new Date(sub.trial_ends_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.max(5, 100 - (daysLeft / TRIAL_DAYS) * 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Prochain renouvellement</p>
                  <p className="text-[17px] font-bold text-gray-900">
                    {sub.next_billing_date
                      ? new Date(sub.next_billing_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                      : '—'
                    }
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Alerte retard / suspension */}
      {(statut === 'past_due' || statut === 'suspended') && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">
              {statut === 'suspended' ? 'Accès suspendu' : 'Paiement en retard'}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {statut === 'suspended'
                ? "Votre accès est suspendu. Régularisez votre situation pour restaurer l'accès."
                : `${fmtFCFA(totalDue)} en attente de paiement. Réglez dès que possible pour éviter la suspension.`}
            </p>
          </div>
        </div>
      )}

      {/* ── Notifications d'essai ─────────────────────────────────────────── */}

      {/* J-7 : rappel informatif */}
      {statut === 'trial' && daysLeft <= 7 && daysLeft > 3 && (
        <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
          style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <Clock size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-800">
              Plus que {daysLeft} jours d&apos;essai gratuit
            </p>
            <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
              Votre essai Oraforme expire dans <strong>{daysLeft} jours</strong>.
              Activez votre abonnement maintenant pour continuer à utiliser tous les modules sans interruption.
            </p>
            <a
              href="mailto:contact@oraforme.com?subject=Activation abonnement"
              className="inline-flex items-center gap-1 mt-2 text-[12px] font-bold text-blue-700 underline underline-offset-2"
            >
              Contacter l&apos;équipe Oraforme →
            </a>
          </div>
        </div>
      )}

      {/* J-3 : avertissement urgent */}
      {statut === 'trial' && daysLeft <= 3 && daysLeft > 1 && (
        <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
          style={{ background: '#FFFBEB', border: '2px solid #FCD34D' }}>
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              ⚡ Attention — {daysLeft} jours avant expiration
            </p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Votre essai gratuit se termine dans <strong>{daysLeft} jours</strong>.
              Après cette date, l&apos;accès à vos données et modules sera suspendu.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="mailto:contact@oraforme.com?subject=Activation urgente abonnement Oraforme"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white"
                style={{ background: '#F59E0B' }}
              >
                <Zap size={12} /> Activer mon abonnement
              </a>
              <a
                href="tel:+242060000000"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-amber-700 bg-amber-100"
              >
                <Phone size={12} /> Appeler le support
              </a>
            </div>
          </div>
        </div>
      )}

      {/* J-1 : alerte critique */}
      {statut === 'trial' && daysLeft === 1 && (
        <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
          style={{ background: '#FEF2F2', border: '2px solid #F87171' }}>
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">
              🚨 Votre essai expire DEMAIN
            </p>
            <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
              Après demain, toutes vos données seront préservées mais l&apos;accès sera bloqué.
              Activez votre abonnement <strong>aujourd&apos;hui</strong> pour éviter toute interruption.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="mailto:contact@oraforme.com?subject=URGENT - Activation abonnement Oraforme J-1"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white"
                style={{ background: '#DC2626' }}
              >
                <CreditCard size={13} /> Activer maintenant
              </a>
              <a
                href="tel:+242060000000"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-red-700 bg-red-100"
              >
                <Phone size={12} /> Appeler d&apos;urgence
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Essai expiré : activation obligatoire */}
      {statut === 'expired' && (
        <div className="rounded-2xl overflow-hidden border-2 border-red-300">
          <div className="px-5 py-4 flex items-start gap-3" style={{ background: '#FEF2F2' }}>
            <AlertTriangle size={20} className="text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-base font-extrabold text-red-800">
                Votre essai gratuit a expiré
              </p>
              <p className="text-sm text-red-700 mt-1 leading-relaxed">
                L&apos;accès complet à Oraforme nécessite un abonnement actif.
                Vos données sont conservées en sécurité. Contactez-nous pour réactiver votre compte.
              </p>
            </div>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-3 items-center" style={{ background: '#FFF5F5' }}>
            <a
              href="mailto:contact@oraforme.com?subject=Réactivation compte Oraforme"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
              style={{ background: '#DC2626' }}
            >
              <CreditCard size={14} /> Activer mon abonnement
            </a>
            <a
              href="tel:+242060000000"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-red-700 bg-white border border-red-200"
            >
              <Phone size={14} /> Appeler Oraforme
            </a>
            <span className="text-[11px] text-red-400 ml-auto">
              Données sécurisées — aucune perte
            </span>
          </div>
        </div>
      )}

      {/* Modules inclus */}
      {plan && plan.modules_inclus.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
              <Zap size={16} className="text-gray-400" /> Modules inclus
            </h2>
          </div>
          <div className="px-6 py-4 flex flex-wrap gap-2">
            {plan.modules_inclus.map(mod => (
              <span key={mod}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-100"
              >
                <CheckCircle2 size={11} /> {mod}
              </span>
            ))}
            {(sub?.modules_extra ?? []).map(mod => (
              <span key={mod}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
              >
                <Zap size={11} /> {mod} <span className="opacity-60 text-[10px]">add-on</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Factures */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
            <FileText size={16} className="text-gray-400" /> Factures
          </h2>
          {totalDue > 0 && (
            <span className="text-xs font-bold text-red-600">
              {fmtFCFA(totalDue)} à payer
            </span>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400">
            <FileText size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucune facture pour le moment</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-gray-50">
                  {['N° Facture', 'Période', 'Total', 'Payé', 'Statut', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const sc    = INVOICE_STATUT_COLORS[inv.statut]
                  const reste = inv.montant_total - inv.montant_paye
                  return (
                    <tr key={inv.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-semibold text-gray-900 font-mono">{inv.numero_facture || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {new Date(inv.periode_debut).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                        {' – '}
                        {new Date(inv.periode_fin).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-bold text-gray-900">{fmtFCFA(inv.montant_total)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[12px] font-semibold ${inv.montant_paye >= inv.montant_total ? 'text-green-600' : 'text-gray-400'}`}>
                          {fmtFCFA(inv.montant_paye)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {INVOICE_STATUT_LABELS[inv.statut]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {(inv.statut === 'pending' || inv.statut === 'overdue') && reste > 0 && (
                          <button
                            onClick={() => { setModalInvoice(inv); setForm(EMPTY_FORM) }}
                            className="flex items-center gap-1 text-[12px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            Payer <ChevronRight size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historique paiements */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={16} className="text-gray-400" /> Historique des paiements
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="bg-gray-50">
                  {['Date', 'Moyen', 'Montant', 'Référence', 'Statut'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-700">
                      {PROVIDER_LABELS[p.provider]}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] font-bold text-gray-900">{fmtFCFA(p.montant)}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 font-mono">
                      {p.provider_reference ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] font-bold ${
                        p.statut === 'completed'  ? 'text-green-600' :
                        p.statut === 'failed'     ? 'text-red-600'   :
                        p.statut === 'pending'    ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        {PAYMENT_STATUT_LABELS[p.statut]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal paiement ── */}
      {modalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Payer la facture</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {modalInvoice.numero_facture || '—'} — {fmtFCFA(modalInvoice.montant_total - modalInvoice.montant_paye)}
                </p>
              </div>
              <button onClick={() => setModalInvoice(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {saveOk && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Paiement enregistré — en attente de confirmation
                </div>
              )}
              {error && !saveOk && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              {/* Mode de paiement */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Mode de paiement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([...MOBILE_MONEY_PROVIDERS, 'bank_transfer', 'cheque', 'manual'] as PaymentProvider[]).map(prov => (
                    <button
                      key={prov}
                      onClick={() => setForm(f => ({ ...f, provider: prov }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        form.provider === prov
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-base">
                        {prov === 'airtel_money'  ? '🔴' :
                         prov === 'mtn_money'     ? '🟡' :
                         prov === 'orange_money'  ? '🟠' :
                         prov === 'bank_transfer' ? '🏦' :
                         prov === 'cheque'        ? '📄' : '✍️'}
                      </span>
                      {PROVIDER_LABELS[prov]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Numéro de téléphone si Mobile Money */}
              {MOBILE_MONEY_PROVIDERS.includes(form.provider as typeof MOBILE_MONEY_PROVIDERS[number]) && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    <Phone size={11} className="inline mr-1" /> Numéro de téléphone
                  </label>
                  <input
                    type="tel"
                    placeholder="ex: +242 06 XXX XX XX"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Référence */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Référence de transaction <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                  type="text"
                  placeholder="N° de confirmation..."
                  value={form.provider_reference}
                  onChange={e => setForm(f => ({ ...f, provider_reference: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setModalInvoice(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={submitPayment}
                disabled={saving || saveOk}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                {saving ? 'Enregistrement...' : `Payer ${fmtFCFA(modalInvoice.montant_total - modalInvoice.montant_paye)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Icône décorative calendrier inutilisée évitée */}
      <div className="hidden"><Calendar size={1} /></div>
    </div>
  )
}
