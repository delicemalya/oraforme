'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  Shield, FileText, AlertTriangle, Users, DollarSign,
  TrendingUp, TrendingDown, ArrowRight, Plus, RefreshCw,
  CheckCircle2, Clock, XCircle, BarChart2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Police {
  id: string
  numero_police: string
  type_police: string
  assure_nom: string
  prime_montant: number
  statut: string
  date_effet: string
  date_echeance: string
  created_at: string
}

interface Sinistre {
  id: string
  numero_sinistre: string
  statut: string
  montant_estime: number
  montant_paye: number
  created_at: string
  ass_polices?: { assure_nom: string; type_police: string }
}

interface DashboardData {
  polices: Police[]
  sinistres: Sinistre[]
  kpis: { primes_emises: number; nb_actives: number; total: number }
  taux_sinistralite: number
  primes_total: number
  sinistres_payes: number
  commissions: { total_a_payer: number; total_paye: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

const STATUT_POLICE: Record<string, { label: string; color: string }> = {
  active:     { label: 'Active',      color: 'bg-green-100 text-green-700'   },
  suspendue:  { label: 'Suspendue',   color: 'bg-yellow-100 text-yellow-700' },
  resiliee:   { label: 'Résiliée',    color: 'bg-red-100 text-red-700'       },
  expiree:    { label: 'Expirée',     color: 'bg-gray-100 text-gray-600'     },
  en_attente: { label: 'En attente',  color: 'bg-blue-100 text-blue-700'     },
}

const STATUT_SINISTRE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  declare:       { label: 'Déclaré',       color: 'bg-blue-100 text-blue-700',    icon: <Clock size={12} /> },
  en_instruction:{ label: 'En instruction',color: 'bg-yellow-100 text-yellow-700',icon: <RefreshCw size={12} /> },
  expertise:     { label: 'Expertise',     color: 'bg-purple-100 text-purple-700',icon: <Shield size={12} /> },
  accepte:       { label: 'Accepté',       color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 size={12} /> },
  refuse:        { label: 'Refusé',        color: 'bg-red-100 text-red-700',      icon: <XCircle size={12} /> },
  clos:          { label: 'Clos',          color: 'bg-gray-100 text-gray-600',    icon: <CheckCircle2 size={12} /> },
}

const TYPE_LABELS: Record<string, string> = {
  vie:'Vie', auto:'Auto', habitation:'Habitation', sante:'Santé',
  responsabilite_civile:'RC', transport:'Transport', agricole:'Agricole',
  maritime:'Maritime', aviation:'Aviation', voyage:'Voyage', incendie:'Incendie',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssuranceDashboard() {
  const { tenant } = useTenantContext()
  const tenantId = tenant?.tenantId ?? ''
  const [data, setData]     = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    const load = async () => {
      setLoading(true)
      try {
        const [pRes, sRes, cRes] = await Promise.all([
          fetch('/api/assurance/polices'),
          fetch('/api/assurance/sinistres'),
          fetch('/api/assurance/commissions'),
        ])
        const [pData, sData, cData] = await Promise.all([pRes.json(), sRes.json(), cRes.json()])
        setData({
          polices:          pData.data ?? [],
          sinistres:        sData.data ?? [],
          kpis:             pData.kpis ?? { primes_emises: 0, nb_actives: 0, total: 0 },
          taux_sinistralite:sData.taux_sinistralite ?? 0,
          primes_total:     sData.primes_total ?? 0,
          sinistres_payes:  sData.sinistres_payes ?? 0,
          commissions:      { total_a_payer: cData.total_a_payer ?? 0, total_paye: cData.total_paye ?? 0 },
        })
      } finally { setLoading(false) }
    }
    load()
  }, [tenantId])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-[#DC2626]" size={28} />
    </div>
  )

  const polices   = data?.polices   ?? []
  const sinistres = data?.sinistres ?? []
  const actives   = polices.filter(p => p.statut === 'active').length
  const enCours   = sinistres.filter(s => !['clos','refuse'].includes(s.statut)).length

  // Répartition par type de police
  const byType: Record<string, number> = {}
  polices.forEach(p => { byType[p.type_police] = (byType[p.type_police] ?? 0) + 1 })
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] flex items-center gap-2">
            <Shield className="text-[#DC2626]" size={26} />
            Assurance & Réassurance
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Vue d&apos;ensemble · Portefeuille & sinistralité</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/assurance/polices"
            className="inline-flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus size={15} /> Nouvelle police
          </Link>
          <Link href="/dashboard/assurance/sinistres"
            className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:border-[#DC2626] text-[#374151] hover:text-[#DC2626] text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <AlertTriangle size={15} /> Déclarer sinistre
          </Link>
        </div>
      </div>

      {/* KPIs ── 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Primes émises',
            value: `${fmt(data?.kpis?.primes_emises ?? 0)} FCFA`,
            sub:   `${actives} polices actives`,
            icon:  <DollarSign size={20} className="text-green-600" />,
            color: 'bg-green-50 border-green-100',
          },
          {
            label: 'Sinistres en cours',
            value: String(enCours),
            sub:   `${sinistres.filter(s => s.statut === 'declare').length} nouveaux déclarés`,
            icon:  <AlertTriangle size={20} className="text-orange-600" />,
            color: 'bg-orange-50 border-orange-100',
          },
          {
            label: 'Taux de sinistralité',
            value: `${data?.taux_sinistralite ?? 0}%`,
            sub:   `${fmt(data?.sinistres_payes ?? 0)} FCFA réglés`,
            icon:  data?.taux_sinistralite && data.taux_sinistralite > 70
              ? <TrendingUp size={20} className="text-red-600" />
              : <TrendingDown size={20} className="text-green-600" />,
            color: (data?.taux_sinistralite ?? 0) > 70
              ? 'bg-red-50 border-red-100'
              : 'bg-green-50 border-green-100',
          },
          {
            label: 'Commissions à payer',
            value: `${fmt(data?.commissions?.total_a_payer ?? 0)} FCFA`,
            sub:   `${fmt(data?.commissions?.total_paye ?? 0)} FCFA déjà payées`,
            icon:  <BarChart2 size={20} className="text-blue-600" />,
            color: 'bg-blue-50 border-blue-100',
          },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border p-5 ${k.color}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                {k.icon}
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#0F172A] mb-0.5">{k.value}</div>
            <div className="text-xs font-semibold text-[#64748B]">{k.label}</div>
            <div className="text-[11px] text-[#94A3B8] mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Contenu principal ── 2 colonnes */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Polices récentes */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#DC2626]" />
              <span className="font-bold text-[#0F172A] text-sm">Polices récentes</span>
            </div>
            <Link href="/dashboard/assurance/polices"
              className="text-xs font-semibold text-[#DC2626] hover:underline flex items-center gap-1">
              Tout voir <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {polices.slice(0, 6).map(p => {
              const s = STATUT_POLICE[p.statut] ?? STATUT_POLICE.en_attente
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-[#DC2626]/8 flex items-center justify-center shrink-0">
                    <Shield size={15} className="text-[#DC2626]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#0F172A] truncate">{p.assure_nom}</div>
                    <div className="text-xs text-[#64748B]">{p.numero_police} · {TYPE_LABELS[p.type_police] ?? p.type_police}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#0F172A]">{fmt(p.prime_montant)} FCFA</div>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${s.color}`}>{s.label}</span>
                  </div>
                </div>
              )
            })}
            {polices.length === 0 && (
              <div className="py-10 text-center text-sm text-[#94A3B8]">
                Aucune police — <Link href="/dashboard/assurance/polices" className="text-[#DC2626] font-semibold">créer la première</Link>
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-5">

          {/* Sinistres en cours */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-orange-500" />
                <span className="font-bold text-[#0F172A] text-sm">Sinistres actifs</span>
              </div>
              <Link href="/dashboard/assurance/sinistres"
                className="text-xs font-semibold text-[#DC2626] hover:underline flex items-center gap-1">
                Tout voir <ArrowRight size={12} />
              </Link>
            </div>
            <ul className="divide-y divide-gray-50">
              {sinistres.filter(s => s.statut !== 'clos').slice(0, 5).map(s => {
                const st = STATUT_SINISTRE[s.statut] ?? STATUT_SINISTRE.declare
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`w-1.5 h-6 rounded-full shrink-0 ${s.statut === 'declare' ? 'bg-blue-400' : s.statut === 'expertise' ? 'bg-purple-400' : 'bg-orange-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#0F172A] truncate">
                        {s.ass_polices?.assure_nom ?? '—'}
                      </div>
                      <div className="text-[10px] text-[#64748B]">{s.numero_sinistre}</div>
                    </div>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 flex items-center gap-1 ${st.color}`}>
                      {st.icon}{st.label}
                    </span>
                  </li>
                )
              })}
              {sinistres.filter(s => s.statut !== 'clos').length === 0 && (
                <li className="py-6 text-center text-xs text-[#94A3B8]">Aucun sinistre en cours</li>
              )}
            </ul>
          </div>

          {/* Répartition par type */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={15} className="text-[#DC2626]" />
              <span className="font-bold text-[#0F172A] text-sm">Répartition portefeuille</span>
            </div>
            {topTypes.length > 0 ? (
              <div className="space-y-2.5">
                {topTypes.map(([type, count]) => {
                  const pct = Math.round((count / polices.length) * 100)
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-[#374151]">{TYPE_LABELS[type] ?? type}</span>
                        <span className="font-bold text-[#0F172A]">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#DC2626] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-[#94A3B8] text-center py-4">Aucune police enregistrée</p>
            )}
          </div>

          {/* Raccourcis */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Accès rapides</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Clients',     href: '/dashboard/assurance/clients',     icon: <Users size={14} /> },
                { label: 'Produits',    href: '/dashboard/assurance/produits',    icon: <Shield size={14} /> },
                { label: 'Partenaires', href: '/dashboard/assurance/partenaires', icon: <DollarSign size={14} /> },
                { label: 'Analytics',   href: '/dashboard/assurance/analytics',   icon: <BarChart2 size={14} /> },
              ].map(item => (
                <Link key={item.label} href={item.href}
                  className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-[#DC2626]/5 hover:text-[#DC2626] text-[#374151] text-xs font-semibold transition-colors">
                  {item.icon}{item.label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
