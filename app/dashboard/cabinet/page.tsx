'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import { EnterClientButton } from '@/components/cabinet/SwitchBanner'
import {
  Building2, Users, TrendingUp, AlertTriangle, CheckCircle,
  Clock, FileText, DollarSign, RefreshCw, Plus,
  BarChart3, MessageSquare, Loader2, ChevronRight,
  Calendar, Sparkles,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Client {
  id: string; nom_entreprise: string; secteur_activite: string | null
  statut: string; type_compte: string | null; pays: string | null
  honoraires_mensuel: number; frais_oraforme: number
  cabinet_taches: { statut: string }[]
  cabinet_messages: { lu: boolean; expediteur: string }[]
  cabinet_documents: { statut: string }[]
  created_at: string
}

interface Declaration {
  id: string; type_declaration: string; date_limite: string
  statut: string; periode_mois: number | null; periode_annee: number
  cabinet_clients: { id: string; nom_entreprise: string } | null
}

interface KPIs {
  total: number; actifs: number; prospects: number; suspendus: number
  revenue_mois: number; honoraires_mois: number; msgs_non_lus: number; taches_urgentes: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }

const TYPE_DECL_LABELS: Record<string, string> = {
  tva_mensuelle: 'TVA mensuelle', tva_trimestrielle: 'TVA trim.',
  cnss_mensuelle: 'CNSS mensuelle', cnss_trimestrielle: 'CNSS trim.',
  irpp_annuel: 'IRPP annuel', is_annuel: 'IS annuel', is_acompte: 'Acompte IS',
  patente_annuelle: 'Patente', bilan_annuel: 'Bilan annuel',
  declaration_loyer: 'Décl. Loyer', retenue_source: 'Retenue source', autre: 'Autre',
}

const TYPE_COMPTE_COLORS: Record<string, string> = {
  comptable: '#2563EB', fiscal: '#7C3AED', audit: '#DC2626', conseil: '#16A34A',
  juridique: '#F59E0B', mixte: '#0F172A',
}

const STATUT_COLORS: Record<string, string> = {
  actif: '#16A34A', prospect: '#F59E0B', suspendu: '#DC2626',
  archive: '#94A3B8', resilie: '#64748B',
}

function urgenceColor(date_limite: string) {
  const j = Math.ceil((new Date(date_limite).getTime() - Date.now()) / 86400000)
  if (j < 0)   return { bg: '#FEF2F2', text: '#DC2626', label: `${Math.abs(j)}j retard` }
  if (j <= 3)  return { bg: '#FEF2F2', text: '#DC2626', label: `J-${j}` }
  if (j <= 7)  return { bg: '#FFFBEB', text: '#D97706', label: `J-${j}` }
  if (j <= 15) return { bg: '#EFF6FF', text: '#2563EB', label: `J-${j}` }
  return { bg: '#F0FDF4', text: '#16A34A', label: `J-${j}` }
}

// ── Graphique donut portefeuille ───────────────────────────────────────────────

function DonutChart({ actifs, prospects, suspendus }: { actifs: number; prospects: number; suspendus: number }) {
  const total = actifs + prospects + suspendus || 1
  const r = 38; const circumference = 2 * Math.PI * r
  const arcs = [
    { count: actifs,    color: '#16A34A', label: `${actifs} actif${actifs > 1 ? 's' : ''}` },
    { count: prospects, color: '#F59E0B', label: `${prospects} prospect${prospects > 1 ? 's' : ''}` },
    { count: suspendus, color: '#DC2626', label: `${suspendus} suspendu${suspendus > 1 ? 's' : ''}` },
  ]
  let offset = 0
  const segments = arcs.map(a => {
    const dash = (a.count / total) * circumference
    const seg = { ...a, strokeDasharray: `${dash} ${circumference - dash}`, strokeDashoffset: -offset }
    offset += dash
    return seg
  })
  return (
    <div className="flex items-center gap-5">
      <svg width="96" height="96" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F1F5F9" strokeWidth="14" />
        {segments.map((s, i) => (
          <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="14"
            strokeDasharray={s.strokeDasharray} strokeDashoffset={s.strokeDashoffset}
            transform="rotate(-90 50 50)" />
        ))}
        <text x="50" y="46" textAnchor="middle" fill="#0F172A" fontSize="15" fontWeight="900">{total}</text>
        <text x="50" y="60" textAnchor="middle" fill="#94A3B8" fontSize="8">clients</text>
      </svg>
      <div className="space-y-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <p className="text-[11px] font-semibold text-[#475569]">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Graphique barres revenue ───────────────────────────────────────────────────

function RevenueBar({ par_mois }: { par_mois: { mois: number; montant: number }[] }) {
  const max = Math.max(...par_mois.map(m => m.montant), 1)
  const MOIS = ['J','F','M','A','M','J','J','A','S','O','N','D']
  const now = new Date().getMonth()
  return (
    <div className="flex items-end gap-1 h-16">
      {par_mois.map((m, i) => {
        const h = Math.max(3, Math.round((m.montant / max) * 64))
        return (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <div className="w-full rounded-t-md" style={{ height: h, background: i === now ? '#F59E0B' : m.montant > 0 ? '#CBD5E1' : '#F1F5F9' }}
              title={`${MOIS[i]}: ${fmt(m.montant)} FCFA`} />
            <span className={`text-[8px] font-bold ${i === now ? 'text-amber-600' : 'text-[#CBD5E1]'}`}>{MOIS[i]}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CabinetDashboardPage() {
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [clients, setClients]           = useState<Client[]>([])
  const [kpis, setKpis]                 = useState<KPIs | null>(null)
  const [declarations, setDeclarations] = useState<Declaration[]>([])
  const [revenueData, setRevenueData]   = useState<{ par_mois: { mois: number; montant: number }[]; total_annee: number } | null>(null)
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<'overview'|'clients'|'declarations'>('overview')

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [{ data: cl }, { data: decl }, { data: rev }] = await Promise.all([
      supabase
        .from('cabinet_clients')
        .select(`id, nom_entreprise, secteur_activite, statut, type_compte, pays, honoraires_mensuel, frais_oraforme, created_at, cabinet_taches(statut), cabinet_messages(lu, expediteur), cabinet_documents(statut)`)
        .eq('cabinet_tenant_id', tid)
        .order('nom_entreprise', { ascending: true }),
      supabase
        .from('cabinet_declarations_agenda')
        .select('*, cabinet_clients(id, nom_entreprise)')
        .eq('cabinet_tenant_id', tid)
        .in('statut', ['a_faire', 'en_cours', 'retard'])
        .order('date_limite', { ascending: true })
        .limit(20),
      supabase
        .from('oraforme_revenue')
        .select('mois, montant')
        .eq('cabinet_tenant_id', tid)
        .eq('annee', new Date().getFullYear()),
    ])

    const clients = (cl ?? []) as Client[]
    setClients(clients)
    setDeclarations((decl ?? []) as unknown as Declaration[])
    setKpis({
      total:           clients.length,
      actifs:          clients.filter(c => c.statut === 'actif').length,
      prospects:       clients.filter(c => c.statut === 'prospect').length,
      suspendus:       clients.filter(c => c.statut === 'suspendu').length,
      revenue_mois:    clients.filter(c => c.statut === 'actif').reduce((s, c) => s + (c.frais_oraforme ?? 5000), 0),
      honoraires_mois: clients.filter(c => c.statut === 'actif').reduce((s, c) => s + (c.honoraires_mensuel ?? 0), 0),
      msgs_non_lus:    clients.reduce((s, c) => s + c.cabinet_messages.filter(m => !m.lu && m.expediteur === 'client').length, 0),
      taches_urgentes: clients.reduce((s, c) => s + c.cabinet_taches.filter(t => t.statut !== 'termine' && t.statut !== 'annule').length, 0),
    })
    const rows = rev ?? []
    setRevenueData({
      par_mois: Array.from({ length: 12 }, (_, i) => ({ mois: i+1, montant: rows.filter(r => r.mois === i+1).reduce((s, r) => s + (r.montant ?? 5000), 0) })),
      total_annee: rows.reduce((s, r) => s + (r.montant ?? 5000), 0),
    })
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen gap-2 text-[#94A3B8]">
      <Loader2 size={20} className="animate-spin" /> Chargement...
    </div>
  )

  const TABS = [
    { id: 'overview'     as const, label: 'Vue globale',    icon: BarChart3 },
    { id: 'clients'      as const, label: `Clients (${kpis?.total ?? 0})`, icon: Users },
    { id: 'declarations' as const, label: `Déclarations (${declarations.length})`, icon: Calendar },
  ]

  const urgentes = declarations.filter(d => {
    const j = Math.ceil((new Date(d.date_limite).getTime() - Date.now()) / 86400000)
    return j <= 7
  })

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header sticky */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center shadow-sm">
                <Building2 size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-[15px] font-black text-[#0F172A]">Cabinet Comptable</h1>
                <p className="text-[11px] text-[#64748B]">{tenant?.nomEntreprise ?? ''} · Mode Expert</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
                <RefreshCw size={13} />
              </button>
              <Link href="/dashboard/cabinet/clients/nouveau"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
                <Plus size={13} /> Nouveau client
              </Link>
            </div>
          </div>
          <div className="flex gap-0.5 overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-amber-100 text-amber-700' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}>
                  <Icon size={12} /> {t.label}
                  {t.id === 'declarations' && urgentes.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{urgentes.length}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Vue globale ── */}
        {tab === 'overview' && (
          <div className="space-y-6">

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Clients actifs',   val: kpis?.actifs ?? 0,                        icon: Users,         color: '#16A34A', sub: `+ ${kpis?.prospects ?? 0} prospects` },
                { label: 'Revenue Oraforme', val: `${fmt(kpis?.revenue_mois ?? 0)} FCFA`,   icon: DollarSign,    color: '#F59E0B', sub: '/mois' },
                { label: 'CA Honoraires',    val: `${fmt(kpis?.honoraires_mois ?? 0)} FCFA`, icon: TrendingUp,   color: '#2563EB', sub: '/mois' },
                { label: 'Décl. urgentes',   val: urgentes.length,                           icon: AlertTriangle, color: '#DC2626', sub: '≤ 7 jours' },
              ].map(k => {
                const Icon = k.icon
                return (
                  <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: k.color + '18' }}>
                        <Icon size={13} style={{ color: k.color }} />
                      </div>
                      <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{k.label}</p>
                    </div>
                    <p className="text-[18px] font-black tabular-nums" style={{ color: k.color }}>{k.val}</p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">{k.sub}</p>
                  </div>
                )
              })}
            </div>

            {/* Alertes */}
            {((kpis?.msgs_non_lus ?? 0) > 0 || (kpis?.taches_urgentes ?? 0) > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(kpis?.msgs_non_lus ?? 0) > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl">
                    <MessageSquare size={15} className="text-blue-600" />
                    <div>
                      <p className="text-[13px] font-bold text-blue-800">{kpis?.msgs_non_lus} message{(kpis?.msgs_non_lus ?? 0) > 1 ? 's' : ''} non lu{(kpis?.msgs_non_lus ?? 0) > 1 ? 's' : ''}</p>
                      <p className="text-[11px] text-blue-600">Nouveaux messages clients</p>
                    </div>
                  </div>
                )}
                {(kpis?.taches_urgentes ?? 0) > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
                    <Clock size={15} className="text-amber-600" />
                    <div>
                      <p className="text-[13px] font-bold text-amber-800">{kpis?.taches_urgentes} tâche{(kpis?.taches_urgentes ?? 0) > 1 ? 's' : ''} en cours</p>
                      <p className="text-[11px] text-amber-600">Sur vos dossiers actifs</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
                <p className="text-[13px] font-black text-[#0F172A] mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-amber-500" /> Portefeuille clients
                </p>
                <DonutChart actifs={kpis?.actifs ?? 0} prospects={kpis?.prospects ?? 0} suspendus={kpis?.suspendus ?? 0} />
                <div className="mt-4 space-y-2">
                  {Object.entries(
                    clients.reduce<Record<string, number>>((acc, c) => {
                      const s = c.secteur_activite ?? 'Non défini'
                      acc[s] = (acc[s] ?? 0) + 1; return acc
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, n]) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (n / Math.max(kpis?.total ?? 1, 1)) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] font-semibold text-[#94A3B8] w-28 text-right truncate">{s} ({n})</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2">
                    <TrendingUp size={14} className="text-amber-500" /> Revenue {new Date().getFullYear()}
                  </p>
                  <p className="text-[13px] font-black text-amber-600">{fmt(revenueData?.total_annee ?? 0)} F</p>
                </div>
                {revenueData && <RevenueBar par_mois={revenueData.par_mois} />}
                <div className="mt-3 flex items-center justify-between text-[11px] border-t border-[#F1F5F9] pt-3">
                  <span className="text-[#64748B]">Potentiel mensuel ({kpis?.actifs ?? 0} clients)</span>
                  <span className="font-bold text-[#0F172A]">{fmt((kpis?.actifs ?? 0) * 5000)} FCFA</span>
                </div>
              </div>
            </div>

            {/* Déclarations urgentes top 6 */}
            {declarations.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
                  <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2">
                    <AlertTriangle size={13} className="text-red-500" /> Déclarations urgentes
                  </p>
                  <button onClick={() => setTab('declarations')} className="text-[12px] text-amber-600 font-semibold hover:underline flex items-center gap-0.5">
                    Tout voir <ChevronRight size={12} />
                  </button>
                </div>
                <div className="divide-y divide-[#F8FAFC]">
                  {declarations.slice(0, 6).map(d => {
                    const u = urgenceColor(d.date_limite)
                    return (
                      <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFC]">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: u.bg }}>
                            <Calendar size={11} style={{ color: u.text }} />
                          </div>
                          <div>
                            <p className="text-[12px] font-bold text-[#0F172A]">{TYPE_DECL_LABELS[d.type_declaration] ?? d.type_declaration}
                              {d.periode_mois ? ` · ${String(d.periode_mois).padStart(2,'0')}/${d.periode_annee}` : ` ${d.periode_annee}`}
                            </p>
                            <p className="text-[10px] text-[#64748B]">{d.cabinet_clients?.nom_entreprise ?? '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: u.bg, color: u.text }}>{u.label}</span>
                          <span className="text-[10px] text-[#94A3B8] hidden sm:block">{fmtDate(d.date_limite)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Accès rapides */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: '/dashboard/cabinet/clients/nouveau', label: 'Nouveau client',  icon: Plus,        color: '#F59E0B' },
                { href: '/dashboard/cabinet/clients',          label: 'Mes clients',    icon: Users,       color: '#2563EB' },
                { href: '/dashboard/cabinet/clients',          label: 'Documents GED',  icon: FileText,    color: '#7C3AED' },
                { href: '/dashboard/cabinet/clients',          label: 'Tâches',         icon: CheckCircle, color: '#16A34A' },
              ].map(a => {
                const Icon = a.icon
                return (
                  <Link key={a.href + a.label} href={a.href}
                    className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 flex flex-col items-center gap-2 hover:border-amber-300 hover:shadow-md transition-all group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ background: a.color + '18' }}>
                      <Icon size={16} style={{ color: a.color }} />
                    </div>
                    <p className="text-[11px] font-bold text-[#475569] text-center">{a.label}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Clients ── */}
        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#64748B]">{clients.length} clients · {kpis?.actifs ?? 0} actifs</p>
              <Link href="/dashboard/cabinet/clients"
                className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-white">
                Liste complète <ChevronRight size={13} />
              </Link>
            </div>

            {clients.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
                <Building2 size={40} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="font-black text-[#0F172A] mb-1">Aucun client</p>
                <Link href="/dashboard/cabinet/clients/nouveau"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 mt-3">
                  <Plus size={13} /> Créer un client
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map(c => {
                  const sc = STATUT_COLORS[c.statut] ?? '#94A3B8'
                  const tc = TYPE_COMPTE_COLORS[c.type_compte ?? 'comptable'] ?? '#2563EB'
                  const nbTaches = c.cabinet_taches.filter(t => t.statut !== 'termine' && t.statut !== 'annule').length
                  const nbMsgs   = c.cabinet_messages.filter(m => !m.lu && m.expediteur === 'client').length
                  const nbDocs   = c.cabinet_documents.filter(d => d.statut === 'finalise' || d.statut === 'envoye_client').length
                  return (
                    <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl text-white font-black text-[13px] flex items-center justify-center shrink-0"
                            style={{ background: `linear-gradient(135deg, ${tc}cc, ${tc})` }}>
                            {c.nom_entreprise.slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[13px] font-black text-[#0F172A] line-clamp-1">{c.nom_entreprise}</p>
                            <p className="text-[10px] text-[#64748B]">{c.secteur_activite ?? '—'}{c.pays ? ` · ${c.pays}` : ''}</p>
                          </div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0" style={{ background: sc + '18', color: sc }}>{c.statut}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: tc + '18', color: tc }}>{c.type_compte ?? 'comptable'}</span>
                        <span className="text-[10px] text-[#94A3B8]">{fmt(c.honoraires_mensuel ?? 0)} F/mois</span>
                      </div>
                      <div className="flex items-center gap-3 mb-3 text-[11px]">
                        {nbTaches > 0 && <span className="text-amber-600 font-bold">{nbTaches} tâche{nbTaches > 1 ? 's' : ''}</span>}
                        {nbMsgs > 0  && <span className="text-blue-600 font-bold">{nbMsgs} msg</span>}
                        <span className="text-[#94A3B8]">{nbDocs} docs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/cabinet/clients/${c.id}`}
                          className="flex-1 py-1.5 text-center text-[11px] font-bold rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]">
                          Dossier
                        </Link>
                        <EnterClientButton clientId={c.id} clientName={c.nom_entreprise} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Déclarations ── */}
        {tab === 'declarations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#64748B]">{declarations.length} déclarations en attente</p>
            </div>

            {/* Générer agenda */}
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-amber-800 flex items-center gap-2"><Sparkles size={13} /> Générer l'agenda fiscal {new Date().getFullYear()}</p>
                <p className="text-[11px] text-amber-700">TVA, CNSS, IS, Patente, Bilan pour tous vos clients — automatique</p>
              </div>
              <button onClick={async () => {
                const res = await fetch('/api/cabinet/declarations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'generer_agenda', annee: new Date().getFullYear() }),
                })
                if (res.ok) load()
              }}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 flex items-center gap-1.5 shrink-0">
                <Calendar size={13} /> Générer
              </button>
            </div>

            {declarations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
                <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
                <p className="font-black text-[#0F172A]">Toutes les déclarations sont à jour !</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {['Type','Client','Période','Échéance','Urgence'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F8FAFC]">
                      {declarations.map(d => {
                        const u = urgenceColor(d.date_limite)
                        return (
                          <tr key={d.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3 font-bold text-[13px] text-[#0F172A]">{TYPE_DECL_LABELS[d.type_declaration] ?? d.type_declaration}</td>
                            <td className="px-4 py-3">
                              {d.cabinet_clients ? (
                                <Link href={`/dashboard/cabinet/clients/${d.cabinet_clients.id}`} className="text-[12px] text-amber-600 hover:underline font-semibold">{d.cabinet_clients.nom_entreprise}</Link>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-[#64748B]">{d.periode_mois ? `${String(d.periode_mois).padStart(2,'0')}/${d.periode_annee}` : d.periode_annee}</td>
                            <td className="px-4 py-3 text-[12px] font-semibold text-[#0F172A]">{fmtDate(d.date_limite)}</td>
                            <td className="px-4 py-3">
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: u.bg, color: u.text }}>{u.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
