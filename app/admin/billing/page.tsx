import { supabaseAdmin } from '@/lib/supabase-server'
import { fmtFCFA } from '@/lib/admin-config'
import {
  CreditCard, TrendingUp, DollarSign, AlertTriangle,
  CheckCircle2, Clock, Users, Package,
} from 'lucide-react'
import type { SubscriptionStatut } from '@/lib/billing'
import { SUB_STATUT_LABELS, SUB_STATUT_COLORS } from '@/lib/billing'

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface SubRow {
  id:                string
  tenant_id:         string
  statut:            SubscriptionStatut
  periode:           string
  montant_actuel:    number
  montant_addons:    number
  trial_ends_at:     string | null
  next_billing_date: string | null
  created_at:        string
  billing_plans: {
    code:         string
    nom:          string
    secteur_cible: string | null
  } | null
  tenants: {
    nom_entreprise: string
    secteur:        string | null
  } | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BillingPage() {

  // Abonnements depuis le nouveau moteur billing
  const { data: subs } = await supabaseAdmin
    .from('billing_subscriptions')
    .select(`
      id, tenant_id, statut, periode, montant_actuel, montant_addons,
      trial_ends_at, next_billing_date, created_at,
      billing_plans ( code, nom, secteur_cible ),
      tenants ( nom_entreprise, secteur )
    `)
    .order('created_at', { ascending: false })

  const allSubs = (subs ?? []) as unknown as SubRow[]
  const now = new Date()

  // ── Agrégats ──────────────────────────────────────────────────────────────

  function mrr(sub: SubRow): number {
    if (sub.statut === 'cancelled' || sub.statut === 'expired') return 0
    const base = sub.periode === 'annuel'
      ? sub.montant_actuel / 12
      : sub.montant_actuel
    return base + (sub.montant_addons ?? 0)
  }

  const activeSubs    = allSubs.filter(s => s.statut === 'active')
  const trialSubs     = allSubs.filter(s => s.statut === 'trial')
  const pastDueSubs   = allSubs.filter(s => s.statut === 'past_due')
  const suspendedSubs = allSubs.filter(s => s.statut === 'suspended')

  const totalMRR = allSubs.reduce((s, sub) => s + mrr(sub), 0)
  const totalARR = totalMRR * 12

  // Churn : % d'abonnements annulés ou expirés parmi tous les abonnements non-trial
  const nonTrialTotal    = allSubs.filter(s => s.statut !== 'trial').length
  const churnedCount     = allSubs.filter(s => s.statut === 'cancelled' || s.statut === 'expired').length
  const churnRate        = nonTrialTotal > 0 ? Math.round((churnedCount / nonTrialTotal) * 100) : 0

  // Revenus par plan (top 5)
  const planMRR: Record<string, { nom: string; mrr: number; count: number }> = {}
  for (const sub of allSubs) {
    if (!sub.billing_plans) continue
    const code = sub.billing_plans.code
    if (!planMRR[code]) planMRR[code] = { nom: sub.billing_plans.nom, mrr: 0, count: 0 }
    planMRR[code].mrr   += mrr(sub)
    planMRR[code].count += 1
  }
  const topPlans = Object.entries(planMRR)
    .sort((a, b) => b[1].mrr - a[1].mrr)
    .slice(0, 5)

  // Essais expirant dans 7 jours
  const expiringTrials = trialSubs.filter(s => {
    if (!s.trial_ends_at) return false
    const diff = (new Date(s.trial_ends_at).getTime() - now.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  })

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Billing & Paiements</h1>
        <p className="text-sm text-gray-500 mt-0.5">Facturation SaaS — abonnements, revenus et alertes</p>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: DollarSign,    label: 'MRR Plateforme',      value: fmtFCFA(totalMRR),           color: '#10B981', sub: 'revenu mensuel récurrent'  },
          { icon: TrendingUp,    label: 'ARR Projeté',         value: fmtFCFA(totalARR),           color: '#3B82F6', sub: 'revenu annuel projeté'      },
          { icon: CheckCircle2,  label: 'Abonnements actifs',  value: activeSubs.length.toString(),color: '#8B5CF6', sub: `+ ${trialSubs.length} essais` },
          { icon: AlertTriangle, label: 'Retards / Suspendus', value: (pastDueSubs.length + suspendedSubs.length).toString(), color: '#EF4444', sub: `churn ${churnRate}%` },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + '15' }}>
                <Icon size={16} style={{ color: k.color }} />
              </div>
              <p className="text-[22px] font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Essais expirant bientôt */}
      {expiringTrials.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-amber-500" />
            <h3 className="text-[13px] font-bold text-amber-800">
              {expiringTrials.length} essai{expiringTrials.length > 1 ? 's' : ''} expire{expiringTrials.length > 1 ? 'nt' : ''} dans 7 jours
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringTrials.map(s => {
              const diff = s.trial_ends_at
                ? Math.ceil((new Date(s.trial_ends_at).getTime() - now.getTime()) / 86400000)
                : 0
              return (
                <span key={s.id} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {s.tenants?.nom_entreprise ?? '—'} — J{diff >= 0 ? `-${diff}` : '+0'}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Top plans par MRR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
              <Package size={14} className="text-gray-400" /> Top plans par MRR
            </h2>
          </div>
          <div className="px-5 py-3 space-y-3">
            {topPlans.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Aucun abonnement actif</p>
            ) : topPlans.map(([code, data]) => (
              <div key={code} className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-gray-900">{data.nom}</p>
                  <p className="text-[11px] text-gray-400">{data.count} abonnement{data.count > 1 ? 's' : ''}</p>
                </div>
                <p className="text-[13px] font-bold text-green-600">{fmtFCFA(data.mrr)}<span className="text-[10px] text-gray-400 font-normal">/mois</span></p>
              </div>
            ))}
          </div>
        </div>

        {/* Répartition par statut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
              <Users size={14} className="text-gray-400" /> Répartition par statut
            </h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {(['active', 'trial', 'past_due', 'suspended', 'cancelled', 'expired'] as SubscriptionStatut[]).map(statut => {
              const count = allSubs.filter(s => s.statut === statut).length
              if (count === 0) return null
              const sc = SUB_STATUT_COLORS[statut]
              return (
                <div key={statut} className="flex items-center justify-between py-1">
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
                    style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
                  >
                    {SUB_STATUT_LABELS[statut]}
                  </span>
                  <span className="text-[13px] font-bold text-gray-700">
                    {count} <span className="text-gray-400 font-normal text-[11px]">
                      {count > 1 ? 'entreprises' : 'entreprise'}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table des abonnements */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Abonnements par entreprise</h2>
            <p className="text-xs text-gray-400 mt-0.5">Données en temps réel depuis billing_subscriptions</p>
          </div>
          <span className="text-xs text-gray-400">{allSubs.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-gray-50">
                {['Entreprise', 'Plan', 'Statut', 'Période', 'MRR', 'Prochaine échéance', 'Essai expire'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSubs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                    <CreditCard size={28} className="mx-auto mb-2 opacity-30" />
                    <p>Aucun abonnement enregistré</p>
                    <p className="text-xs mt-1">Les abonnements apparaîtront ici après exécution de la migration 062.</p>
                  </td>
                </tr>
              )}
              {allSubs.map(sub => {
                const sc      = SUB_STATUT_COLORS[sub.statut]
                const subMRR  = mrr(sub)
                return (
                  <tr key={sub.id}
                    className={`border-t border-gray-50 hover:bg-gray-50/50 transition-colors ${
                      sub.statut === 'past_due' || sub.statut === 'suspended' ? 'bg-red-50/20' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-semibold text-gray-900">
                        {sub.tenants?.nom_entreprise ?? '—'}
                      </p>
                      {sub.tenants?.secteur && (
                        <p className="text-[11px] text-gray-400 capitalize">{sub.tenants.secteur}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] font-semibold text-gray-700">
                        {sub.billing_plans?.nom ?? '—'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
                        style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
                      >
                        {SUB_STATUT_LABELS[sub.statut]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 capitalize">{sub.periode}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[13px] font-bold ${subMRR > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                        {subMRR > 0 ? fmtFCFA(subMRR) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {fmtDate(sub.next_billing_date)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {sub.statut === 'trial' && sub.trial_ends_at ? (
                        <span className={`font-semibold ${
                          Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86400000) <= 3
                            ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {fmtDate(sub.trial_ends_at)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
