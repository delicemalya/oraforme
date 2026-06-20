'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  Pill, ShoppingCart, AlertTriangle, TrendingUp,
  Loader2, ChevronRight, Package, Clock,
} from 'lucide-react'
import Link from 'next/link'

interface Medicament {
  id:               string
  nom_commercial:   string
  dci:              string | null
  forme:            string | null
  dosage:           string | null
  prix_vente:       number
  stock_actuel:     number
  stock_min:        number
  date_expiration:  string | null
  ordonnance_requise: boolean
  actif:            boolean
}

interface Stats {
  totalMedicaments: number
  stockFaible:      number
  expiresBientot:   number
  ventesMois:       number
}

const NAV_MODULES = [
  { href: '/dashboard/pharmacie/medicaments', label: 'Médicaments',  icon: Pill,         color: '#2563EB', bg: '#EFF6FF', desc: 'Stock & catalogue' },
  { href: '/dashboard/pharmacie/ventes',      label: 'Ventes / POS', icon: ShoppingCart, color: '#16A34A', bg: '#F0FDF4', desc: 'Ordonnances & caisse' },
]

function daysUntilExpiry(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

export default function PharmaciePage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId, loading: tenantLoading } = useTenant()
  const [stats, setStats]   = useState<Stats | null>(null)
  const [meds,  setMeds]    = useState<Medicament[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const startMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const in30days  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    const [
      { count: totalMeds },
      { count: stockFaible },
      { count: expiresBientot },
      { data: ventes },
      { data: medsData },
    ] = await Promise.all([
      supabase.from('pharmacie_medicaments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('pharmacie_medicaments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('actif', true).lte('stock_actuel', 5),
      supabase.from('pharmacie_medicaments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('actif', true).lte('date_expiration', in30days).not('date_expiration', 'is', null),
      supabase.from('pharmacie_ventes').select('montant_total').eq('tenant_id', tenantId).eq('statut', 'valide').gte('created_at', startMois).limit(200),
      supabase.from('pharmacie_medicaments').select('id, nom_commercial, dci, forme, dosage, prix_vente, stock_actuel, stock_min, date_expiration, ordonnance_requise, actif').eq('tenant_id', tenantId).eq('actif', true).order('stock_actuel').limit(10),
    ])

    const ventesMois = (ventes ?? []).reduce((s: number, v: { montant_total: number }) => s + (v.montant_total || 0), 0)
    setStats({ totalMedicaments: totalMeds ?? 0, stockFaible: stockFaible ?? 0, expiresBientot: expiresBientot ?? 0, ventesMois })
    setMeds(medsData ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  const alertMeds = meds.filter(m => m.stock_actuel <= m.stock_min)

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <Pill size={22} className="text-[#2563EB]" /> Pharmacie
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">Tableau de bord · Gestion médicaments & ventes</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Médicaments',    value: stats?.totalMedicaments ?? 0,  color: '#2563EB', bg: '#EFF6FF',  icon: Pill,          danger: false },
          { label: 'Stock faible',   value: stats?.stockFaible ?? 0,       color: stats?.stockFaible ? '#DC2626' : '#16A34A', bg: stats?.stockFaible ? '#FEF2F2' : '#F0FDF4', icon: AlertTriangle, danger: true },
          { label: 'Expirent < 30j', value: stats?.expiresBientot ?? 0,    color: stats?.expiresBientot ? '#D97706' : '#16A34A', bg: stats?.expiresBientot ? '#FFFBEB' : '#F0FDF4', icon: Clock,       danger: true },
          { label: 'Ventes du mois', value: fmtFCFA(stats?.ventesMois ?? 0), color: '#7C3AED', bg: '#F5F3FF',  icon: TrendingUp,    danger: false },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: k.bg }}>
              <k.icon size={14} style={{ color: k.color }} />
            </div>
            <p className="text-[11px] text-[#94A3B8] font-medium">{k.label}</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: k.danger && (k.value as number) > 0 ? k.color : '#0F172A' }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Alertes stock */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#DC2626]" /> Stocks à surveiller
            </h2>
            <Link href="/dashboard/pharmacie/medicaments" className="text-xs text-[#DC2626] hover:underline flex items-center gap-1">
              Tout voir <ChevronRight size={12} />
            </Link>
          </div>
          {alertMeds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package size={24} className="text-[#CBD5E1] mb-2" />
              <p className="text-xs text-[#94A3B8]">Tous les stocks sont suffisants</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F8FAFC]">
              {alertMeds.map(m => {
                const days = daysUntilExpiry(m.date_expiration)
                const isLow = m.stock_actuel <= m.stock_min
                const isExp = days !== null && days <= 30
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
                      <Pill size={14} className="text-[#DC2626]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#0F172A]">{m.nom_commercial}</p>
                      <p className="text-[10px] text-[#94A3B8]">{m.dci}{m.forme ? ` · ${m.forme}` : ''}</p>
                    </div>
                    <div className="text-right">
                      {isLow && (
                        <span className="block text-xs font-bold text-[#DC2626]">Stock: {m.stock_actuel} / min {m.stock_min}</span>
                      )}
                      {isExp && days !== null && (
                        <span className="block text-[10px] text-[#D97706]">Expire dans {days}j</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Navigation modules */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#0F172A] px-1">Modules</h2>
          {NAV_MODULES.map(m => (
            <Link key={m.href} href={m.href}
              className="flex items-center gap-3 bg-white rounded-2xl border border-[#E5E7EB] p-4 hover:border-[#2563EB]/30 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: m.bg }}>
                <m.icon size={16} style={{ color: m.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0F172A] group-hover:text-[#2563EB]">{m.label}</p>
                <p className="text-xs text-[#94A3B8]">{m.desc}</p>
              </div>
              <ChevronRight size={14} className="text-[#CBD5E1]" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
