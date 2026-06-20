'use client'
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { TrendingUp, FileText, AlertTriangle, Users, DollarSign, BarChart2, PieChart, Download, Loader2, Calendar } from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatutFac = 'brouillon' | 'envoyee' | 'payee' | 'partiellement_payee' | 'retard' | 'annulee'

interface Facture {
  id: string
  invoice_number: string | null
  client_name: string | null
  client_nom: string | null
  date: string | null
  due_date: string | null
  subtotal: number
  montant_ht: number
  tva: number
  ca: number
  total: number
  statut: StatutFac
  created_at: string
}

type PeriodFilter = 'mois' | '3mois' | '6mois' | 'annee' | 'tout'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getDateDebut(period: PeriodFilter): Date | null {
  const now = new Date()
  switch (period) {
    case 'mois':   return new Date(now.getFullYear(), now.getMonth(), 1)
    case '3mois':  return new Date(now.getFullYear(), now.getMonth() - 2, 1)
    case '6mois':  return new Date(now.getFullYear(), now.getMonth() - 5, 1)
    case 'annee':  return new Date(now.getFullYear(), 0, 1)
    case 'tout':   return null
  }
}

function jourRetard(dueDateStr: string | null): number {
  if (!dueDateStr) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(dueDateStr).getTime()) / 86400000))
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType
}) {
  return (
    <motion.div
      className="rounded-xl border border-[#E5E7EB] p-4 flex gap-3 items-start"
      style={{ background: '#FFFFFF' }}
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1A` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[#64748B] mb-0.5">{label}</p>
        <p className="text-base font-bold text-[#0F172A] truncate">{value}</p>
        {sub && <p className="text-[10px] text-[#64748B] mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    envoyee:              { label: 'Envoyée',   color: '#DC2626', bg: '#DC262618' },
    retard:               { label: 'En retard', color: '#DC2626', bg: '#DC262618' },
    partiellement_payee:  { label: 'Partiel',   color: '#F59E0B', bg: '#F59E0B18' },
    payee:                { label: 'Payée',     color: '#16A34A', bg: '#16A34A18' },
    brouillon:            { label: 'Brouillon', color: '#64748B', bg: '#64748B18' },
    annulee:              { label: 'Annulée',   color: '#64748B', bg: '#64748B18' },
  }
  const cfg = map[statut] ?? map.brouillon
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  )
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(factures: Facture[]) {
  const rows = factures.map(f => [
    f.invoice_number ?? f.id.slice(0, 8),
    f.client_name ?? f.client_nom ?? '',
    f.date ?? f.created_at.split('T')[0],
    f.subtotal ?? f.montant_ht ?? 0,
    f.tva ?? 0,
    f.ca ?? 0,
    f.total ?? 0,
    f.statut,
  ])
  const header = ['N°', 'Client', 'Date', 'HT', 'TVA', 'CA', 'TTC', 'Statut']
  const csv = [header, ...rows].map(r => r.join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `factures_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const { tenantId, loading: tenantLoading } = useTenant()

  const [factures,    setFactures]    = useState<Facture[]>([])
  const [loading,     setLoading]     = useState(true)
  const [period,      setPeriod]      = useState<PeriodFilter>('mois')

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    setFactures((data ?? []) as Facture[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  // ── Filtered factures by period ───────────────────────────────────────────

  const dateDebut = getDateDebut(period)
  const filtered: Facture[] = dateDebut
    ? factures.filter(f => new Date(f.created_at) >= dateDebut)
    : factures

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const now         = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const facturesPayees     = filtered.filter(f => f.statut === 'payee')
  const totalCA            = facturesPayees.reduce((s, f) => s + (f.total ?? 0), 0)
  const facturesCeMois     = factures.filter(f => new Date(f.created_at) >= startOfMonth).length
  const totalEmis          = filtered.length
  const tauxRecouvrement   = totalEmis === 0 ? 0 : Math.round((facturesPayees.length / totalEmis) * 100)
  const totalTVA           = facturesPayees.reduce((s, f) => s + (f.tva ?? 0), 0)

  // ── Impayées ──────────────────────────────────────────────────────────────

  const impayees = filtered
    .filter(f => ['envoyee', 'retard', 'partiellement_payee'].includes(f.statut))
    .sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : 0
      const db = b.due_date ? new Date(b.due_date).getTime() : 0
      return da - db
    })
  const totalImpaye = impayees.reduce((s, f) => s + (f.total ?? 0), 0)

  // ── Ventes par mois ───────────────────────────────────────────────────────

  const ventesParMois: Record<string, number> = {}
  facturesPayees.forEach(f => {
    const moisKey = (f.date ?? f.created_at).slice(0, 7) // YYYY-MM
    ventesParMois[moisKey] = (ventesParMois[moisKey] ?? 0) + (f.total ?? 0)
  })

  // Build last 12 months
  const derniers12Mois: { key: string; label: string; montant: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    derniers12Mois.push({ key, label, montant: ventesParMois[key] ?? 0 })
  }
  const maxMontant = Math.max(...derniers12Mois.map(m => m.montant), 1)

  // ── Top 5 clients ─────────────────────────────────────────────────────────

  const clientMap: Record<string, { ca: number; count: number }> = {}
  facturesPayees.forEach(f => {
    const nom = f.client_name ?? f.client_nom ?? 'Inconnu'
    if (!clientMap[nom]) clientMap[nom] = { ca: 0, count: 0 }
    clientMap[nom].ca    += f.total ?? 0
    clientMap[nom].count += 1
  })
  const top5Clients = Object.entries(clientMap)
    .sort(([, a], [, b]) => b.ca - a.ca)
    .slice(0, 5)

  // ── TVA par mois ─────────────────────────────────────────────────────────

  const tvaParMois: Record<string, { ht: number; tva: number; ca: number }> = {}
  facturesPayees.forEach(f => {
    const key = (f.date ?? f.created_at).slice(0, 7)
    if (!tvaParMois[key]) tvaParMois[key] = { ht: 0, tva: 0, ca: 0 }
    tvaParMois[key].ht  += f.subtotal ?? f.montant_ht ?? 0
    tvaParMois[key].tva += f.tva ?? 0
    tvaParMois[key].ca  += f.ca ?? 0
  })
  const tvaRows = Object.entries(tvaParMois)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)

  function fmtMoisLabel(key: string) {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#64748B]">
        <Loader2 className="animate-spin mr-2" size={18} /> Chargement des rapports…
      </div>
    )
  }

  const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
    { value: 'mois',   label: 'Ce mois' },
    { value: '3mois',  label: '3 mois' },
    { value: '6mois',  label: '6 mois' },
    { value: 'annee',  label: 'Cette année' },
    { value: 'tout',   label: 'Tout' },
  ]

  return (
    <div className="space-y-6" style={{ background: '#F5F7FB', minHeight: '100vh', padding: '0' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101729]">Rapports commerciaux</h1>
          <p className="text-xs text-[#64748B] mt-0.5">Ventes · TVA · Recouvrement · Top clients</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/facturation"
            className="px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg text-[#64748B] hover:text-[#101729] transition-colors"
          >
            ← Retour factures
          </Link>
          <button
            onClick={() => exportCSV(filtered)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: '#DC2626', color: 'white' }}
          >
            <Download size={13} /> Exporter CSV
          </button>
        </div>
      </div>

      {/* ── Filtre période ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar size={14} className="text-[#64748B]" />
        <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: period === opt.value ? '#DC2626' : 'transparent',
                color:      period === opt.value ? '#FFFFFF'  : '#64748B',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#64748B]">{filtered.length} facture{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Section 1 — KPIs ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-1.5">
          <TrendingUp size={14} style={{ color: '#DC2626' }} /> Vue d&apos;ensemble
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Chiffre d'affaires"
            value={fmt(totalCA)}
            sub="Factures payées"
            color="#DC2626"
            icon={DollarSign}
          />
          <KpiCard
            label="Factures émises"
            value={`${facturesCeMois} ce mois`}
            sub={`${totalEmis} sur la période`}
            color="#2563EB"
            icon={FileText}
          />
          <KpiCard
            label="Taux recouvrement"
            value={`${tauxRecouvrement} %`}
            sub={`${facturesPayees.length} / ${totalEmis} payées`}
            color="#16A34A"
            icon={TrendingUp}
          />
          <KpiCard
            label="TVA collectée"
            value={fmt(totalTVA)}
            sub="18 % sur factures payées"
            color="#F59E0B"
            icon={BarChart2}
          />
        </div>
      </div>

      {/* ── Section 2 — Factures impayées ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-1.5">
            <AlertTriangle size={14} style={{ color: '#DC2626' }} /> Factures impayées
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#DC262618', color: '#DC2626' }}>
              {impayees.length}
            </span>
          </h2>
          {impayees.length > 0 && (
            <span className="text-xs font-semibold" style={{ color: '#DC2626' }}>
              Total impayé : {fmt(totalImpaye)}
            </span>
          )}
        </div>

        {impayees.length === 0 ? (
          <div className="py-10 text-center text-[#64748B] text-sm">
            Aucune facture impayée — excellent recouvrement !
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB]" style={{ background: '#F9FAFB' }}>
                  {['N° Facture', 'Client', 'Montant TTC', 'Date échéance', 'Jours retard', 'Statut'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {impayees.map((f, i) => {
                  const jours = jourRetard(f.due_date)
                  return (
                    <tr key={f.id} className={`border-b border-[#E5E7EB] ${i % 2 === 1 ? 'bg-[#F9FAFB]' : ''}`}>
                      <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#DC2626]">
                        {f.invoice_number ?? f.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-[#0F172A] font-medium">
                        {f.client_name ?? f.client_nom ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-bold text-[#0F172A]">
                        {fmt(f.total ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#64748B]">
                        {f.due_date ? fmtDate(f.due_date) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {jours > 0 ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#DC262618', color: '#DC2626' }}>
                            {jours} j de retard
                          </span>
                        ) : (
                          <span className="text-xs text-[#64748B]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatutBadge statut={f.statut} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#DC2626]/30" style={{ background: '#FEF2F2' }}>
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-[#DC2626]">Total impayé</td>
                  <td className="px-4 py-2.5 text-sm font-bold text-[#DC2626]">{fmt(totalImpaye)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3 — Ventes par mois ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-1.5">
            <BarChart2 size={14} style={{ color: '#DC2626' }} /> Ventes par mois (CA encaissé)
          </h2>
        </div>
        <div className="p-5 space-y-3">
          {derniers12Mois.map(({ key, label, montant }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[11px] text-[#64748B] w-16 shrink-0 text-right">{label}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                <div
                  style={{
                    width: montant === 0 ? '0%' : `${Math.max(2, (montant / maxMontant) * 100)}%`,
                    background: '#DC2626',
                    height: 8,
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold text-[#0F172A] w-32 shrink-0 text-right">
                {montant > 0 ? fmt(montant) : <span className="text-[#64748B] font-normal">—</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 4 — Top 5 clients ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-1.5">
            <Users size={14} style={{ color: '#DC2626' }} /> Top 5 clients
          </h2>
        </div>
        {top5Clients.length === 0 ? (
          <div className="py-10 text-center text-[#64748B] text-sm">Aucun client avec des factures payées</div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {top5Clients.map(([nom, { ca, count }], i) => (
              <motion.div
                key={nom}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-[#E5E7EB] p-4 text-center"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2"
                  style={{ background: i === 0 ? '#F59E0B1A' : '#E5E7EB', color: i === 0 ? '#F59E0B' : '#64748B' }}
                >
                  {i + 1}
                </div>
                <p className="text-xs font-semibold text-[#0F172A] truncate" title={nom}>{nom}</p>
                <p className="text-sm font-bold mt-1" style={{ color: '#DC2626' }}>{fmt(ca)}</p>
                <p className="text-[10px] text-[#64748B] mt-0.5">{count} facture{count !== 1 ? 's' : ''}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 5 — TVA collectée ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-1.5">
            <PieChart size={14} style={{ color: '#DC2626' }} /> Déclaration TVA — par mois
          </h2>
        </div>
        {tvaRows.length === 0 ? (
          <div className="py-10 text-center text-[#64748B] text-sm">Aucune TVA à déclarer sur la période</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB]" style={{ background: '#F9FAFB' }}>
                  {['Mois', 'CA HT', 'TVA (18 %)', 'CA taxe (5 %)', 'Total TVA'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tvaRows.map(([key, { ht, tva, ca }], i) => (
                  <tr key={key} className={`border-b border-[#E5E7EB] ${i % 2 === 1 ? 'bg-[#F9FAFB]' : ''}`}>
                    <td className="px-4 py-2.5 text-xs font-medium text-[#0F172A]">{fmtMoisLabel(key)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#64748B]">{fmt(ht)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#0F172A] font-semibold">{fmt(tva)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#0F172A]">{fmt(ca)}</td>
                    <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#DC2626' }}>{fmt(tva + ca)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#E5E7EB]" style={{ background: '#F9FAFB' }}>
                  <td className="px-4 py-2.5 text-xs font-bold text-[#0F172A]">TOTAL</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-[#0F172A]">
                    {fmt(tvaRows.reduce((s, [, v]) => s + v.ht, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-bold text-[#0F172A]">
                    {fmt(tvaRows.reduce((s, [, v]) => s + v.tva, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-bold text-[#0F172A]">
                    {fmt(tvaRows.reduce((s, [, v]) => s + v.ca, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#DC2626' }}>
                    {fmt(tvaRows.reduce((s, [, v]) => s + v.tva + v.ca, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 6 — Export ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <h2 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-1.5">
          <Download size={14} style={{ color: '#DC2626' }} /> Export des données
        </h2>
        <p className="text-xs text-[#64748B] mb-4">
          Exportez vos factures au format CSV pour les importer dans Excel, LibreOffice ou un logiciel comptable.
          Le fichier contient {filtered.length} facture{filtered.length !== 1 ? 's' : ''} de la période sélectionnée.
        </p>
        <button
          onClick={() => exportCSV(filtered)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: '#DC2626', color: 'white' }}
        >
          <Download size={14} /> Exporter CSV ({filtered.length} lignes)
        </button>
      </div>

    </div>
  )
}
