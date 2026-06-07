'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  Users, Plus, FolderOpen, FileText, CheckSquare,
  AlertTriangle, TrendingUp, DollarSign, Clock,
  ChevronRight, Building2, Calendar, BarChart3,
  RefreshCw, Loader2, Star, ArrowRight, Briefcase,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KpiData {
  clients_actifs: number
  clients_prospects: number
  honoraires_mois: number
  taches_en_cours: number
  taches_urgentes: number
  docs_en_attente: number
  messages_non_lus: number
  revenue_oraforme_mois: number
}

interface ClientRecent {
  id: string
  nom_entreprise: string
  secteur_activite: string | null
  ville: string | null
  statut: string
  honoraires_mensuel: number
  types_mission: string[]
  nb_taches?: number
  nb_docs?: number
  nb_msgs?: number
}

interface TacheUrgente {
  id: string
  titre: string
  priorite: string
  date_echeance: string | null
  statut: string
  cabinet_clients: { nom_entreprise: string } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA' }
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
function joursRestants(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}
function statutColor(s: string) {
  const m: Record<string, { bg: string; text: string }> = {
    actif:    { bg: '#F0FDF4', text: '#16A34A' },
    prospect: { bg: '#FFFBEB', text: '#F59E0B' },
    suspendu: { bg: '#FFF7ED', text: '#EA580C' },
    archive:  { bg: '#F8FAFC', text: '#64748B' },
    resilie:  { bg: '#FEF2F2', text: '#DC2626' },
  }
  return m[s] ?? m.actif
}
function prioriteColor(p: string) {
  const m: Record<string, string> = { basse: '#64748B', normale: '#2563EB', haute: '#F59E0B', urgente: '#DC2626' }
  return m[p] ?? '#64748B'
}

// ── Composants ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[22px] font-black text-[#0F172A]">{value}</p>
      {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CabinetDashboardPage() {
  const { tenant } = useTenantContext()
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [clients, setClients] = useState<ClientRecent[]>([])
  const [tachesUrgentes, setTachesUrgentes] = useState<TacheUrgente[]>([])
  const [loading, setLoading] = useState(true)

  const tid = tenant?.tenantId

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const now = new Date()
    const mois = now.getMonth() + 1
    const annee = now.getFullYear()
    const debutMois = new Date(annee, mois - 1, 1).toISOString().split('T')[0]
    const finMois   = new Date(annee, mois, 0).toISOString().split('T')[0]

    const [
      { data: cls },
      { data: taches },
      { data: docs },
      { data: msgs },
      { data: facs },
      { data: rev },
    ] = await Promise.all([
      supabase.from('cabinet_clients').select('id,nom_entreprise,secteur_activite,ville,statut,honoraires_mensuel,types_mission').eq('cabinet_tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('cabinet_taches').select('id,titre,priorite,date_echeance,statut,client_id,cabinet_clients(nom_entreprise)').eq('cabinet_tenant_id', tid).neq('statut','termine').neq('statut','annule').order('date_echeance', { ascending: true }).limit(20),
      supabase.from('cabinet_documents').select('id,client_id,statut').eq('cabinet_tenant_id', tid),
      supabase.from('cabinet_messages').select('id,client_id,lu').eq('cabinet_tenant_id', tid),
      supabase.from('cabinet_factures_honoraires').select('montant_ttc,statut,date_facture').eq('cabinet_tenant_id', tid).eq('statut','payee').gte('date_facture', debutMois).lte('date_facture', finMois),
      supabase.from('oraforme_revenue').select('montant').eq('cabinet_tenant_id', tid).eq('mois', mois).eq('annee', annee),
    ])

    const clsData   = (cls ?? []) as ClientRecent[]
    const tachData  = (taches ?? []) as unknown as TacheUrgente[]
    const docsData  = docs ?? []
    const msgsData  = msgs ?? []
    const facsData  = facs ?? []
    const revData   = rev ?? []

    // Enrichir clients avec compteurs
    const enriched = clsData.map(c => ({
      ...c,
      nb_taches: tachData.filter(t => (t as unknown as {client_id:string}).client_id === c.id).length,
      nb_docs:   docsData.filter(d => d.client_id === c.id).length,
      nb_msgs:   msgsData.filter(m => (m as {client_id:string;lu:boolean}).client_id === c.id && !(m as {lu:boolean}).lu).length,
    }))

    setClients(enriched)
    setTachesUrgentes(tachData.filter(t => t.priorite === 'urgente' || t.priorite === 'haute').slice(0, 8))

    setKpis({
      clients_actifs:   clsData.filter(c => c.statut === 'actif').length,
      clients_prospects: clsData.filter(c => c.statut === 'prospect').length,
      honoraires_mois:  facsData.reduce((s, f) => s + (f.montant_ttc ?? 0), 0),
      taches_en_cours:  tachData.filter(t => t.statut === 'en_cours').length,
      taches_urgentes:  tachData.filter(t => t.priorite === 'urgente').length,
      docs_en_attente:  docsData.filter(d => d.statut === 'brouillon' || d.statut === 'en_cours').length,
      messages_non_lus: msgsData.filter(m => !(m as {lu:boolean}).lu).length,
      revenue_oraforme_mois: revData.reduce((s, r) => s + (r.montant ?? 0), 0),
    })

    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const nbClients = clients.length
  const nbActifs  = clients.filter(c => c.statut === 'actif').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* ── Header ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-200">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-black text-[#0F172A]">Cabinet Comptable</h1>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-wide">CABINET</span>
              </div>
              <p className="text-[12px] text-[#64748B]">{nbActifs} client{nbActifs > 1 ? 's' : ''} actif{nbActifs > 1 ? 's' : ''} · portefeuille géré</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B] hover:bg-[#F8FAFC]">
              <RefreshCw size={13} />
            </button>
            <Link href="/dashboard/cabinet/clients" className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC]">
              <Users size={14} /> Mes clients
            </Link>
            <Link href="/dashboard/cabinet/clients/nouveau" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B] text-white text-[13px] font-bold hover:bg-amber-600 shadow-sm transition-colors">
              <Plus size={14} /> Nouveau client
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── KPIs ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-[#E2E8F0]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Clients actifs"    value={kpis?.clients_actifs ?? 0}   sub={`${kpis?.clients_prospects ?? 0} prospects`}  color="#16A34A" icon={Users} />
            <KpiCard label="Honoraires ce mois" value={kpis ? fmt(kpis.honoraires_mois) : '0 FCFA'} sub="Factures payées"             color="#F59E0B" icon={DollarSign} />
            <KpiCard label="Tâches en cours"   value={kpis?.taches_en_cours ?? 0}  sub={`${kpis?.taches_urgentes ?? 0} urgentes`}      color="#2563EB" icon={CheckSquare} />
            <KpiCard label="Docs en attente"   value={kpis?.docs_en_attente ?? 0}  sub={`${kpis?.messages_non_lus ?? 0} msgs non lus`} color="#7C3AED" icon={FileText} />
            <KpiCard label="Total clients"      value={nbClients}                   sub="dans le portefeuille"                          color="#0EA5E9" icon={Building2} />
            <KpiCard label="Revenue Oraforme"  value={kpis ? fmt(kpis.revenue_oraforme_mois) : '0 FCFA'} sub="5 000 FCFA/client actif" color="#DC2626" icon={Star} />
            <KpiCard label="Projets actifs"    value="—" sub="Voir onglet projets"  color="#64748B" icon={FolderOpen} />
            <KpiCard label="Taux facturation"  value={nbActifs > 0 ? `${Math.round((kpis?.clients_actifs ?? 0) * 100 / Math.max(nbClients, 1))}%` : '—'} sub="clients facturés"  color="#16A34A" icon={BarChart3} />
          </div>
        )}

        {/* ── Tâches urgentes ── */}
        {tachesUrgentes.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[14px] text-[#0F172A] flex items-center gap-2">
                <AlertTriangle size={15} className="text-[#DC2626]" /> Tâches prioritaires
              </h2>
              <Link href="/dashboard/cabinet/clients" className="text-[12px] text-amber-600 hover:underline font-semibold flex items-center gap-1">
                Tout voir <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {tachesUrgentes.map(t => {
                const j = joursRestants(t.date_echeance)
                const pc = prioriteColor(t.priorite)
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC]">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: pc }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0F172A] truncate">{t.titre}</p>
                      <p className="text-[11px] text-[#64748B]">{(t.cabinet_clients as {nom_entreprise:string} | null)?.nom_entreprise ?? '—'}</p>
                    </div>
                    {t.date_echeance && (
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-bold" style={{ color: j !== null && j < 0 ? '#DC2626' : j !== null && j <= 3 ? '#F59E0B' : '#64748B' }}>
                          {j !== null && j < 0 ? `J+${Math.abs(j)} retard` : j !== null && j === 0 ? "Aujourd'hui" : `J-${j}`}
                        </p>
                        <p className="text-[10px] text-[#94A3B8]">{fmtDate(t.date_echeance)}</p>
                      </div>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                      style={{ background: pc + '18', color: pc }}>{t.priorite}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Liste clients ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[15px] text-[#0F172A]">Portefeuille clients ({clients.length})</h2>
            <Link href="/dashboard/cabinet/clients" className="text-[13px] text-amber-600 hover:underline font-semibold flex items-center gap-1">
              Gérer <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-[#E2E8F0]" />)}
            </div>
          ) : clients.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-12 text-center">
              <Building2 size={40} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="font-bold text-[#0F172A]">Aucun client dans votre portefeuille</p>
              <p className="text-[13px] text-[#64748B] mt-1 mb-4">Ajoutez votre premier client pour commencer</p>
              <Link href="/dashboard/cabinet/clients/nouveau" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B] text-white text-[13px] font-bold hover:bg-amber-600">
                <Plus size={14} /> Ajouter un client
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.slice(0, 9).map(c => {
                const { bg, text } = statutColor(c.statut)
                return (
                  <Link key={c.id} href={`/dashboard/cabinet/clients/${c.id}`}
                    className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 hover:border-amber-300 hover:shadow-md transition-all group">
                    {/* Initiales + Nom */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black text-[14px] shrink-0">
                        {c.nom_entreprise.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[13px] text-[#0F172A] leading-tight truncate group-hover:text-amber-700">{c.nom_entreprise}</p>
                        <p className="text-[11px] text-[#64748B]">{c.secteur_activite ?? '—'}{c.ville ? ` · ${c.ville}` : ''}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0" style={{ background: bg, color: text }}>{c.statut}</span>
                    </div>

                    {/* Missions */}
                    {c.types_mission && c.types_mission.length > 0 && (
                      <p className="text-[11px] text-[#64748B] mb-2 truncate">
                        📋 {c.types_mission.slice(0, 3).join(' · ')}
                      </p>
                    )}

                    {/* Honoraires */}
                    {c.honoraires_mensuel > 0 && (
                      <p className="text-[12px] font-bold text-[#0F172A] mb-3">
                        💰 {fmt(c.honoraires_mensuel)}<span className="text-[10px] font-normal text-[#64748B]">/mois</span>
                      </p>
                    )}

                    {/* Compteurs */}
                    <div className="flex items-center gap-3 text-[11px] text-[#64748B] mb-3">
                      <span className="flex items-center gap-1"><CheckSquare size={10} /> {c.nb_taches ?? 0} tâches</span>
                      <span className="flex items-center gap-1"><FileText size={10} /> {c.nb_docs ?? 0} docs</span>
                      {(c.nb_msgs ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {c.nb_msgs} msgs</span>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#94A3B8]">Ouvrir l'espace client</span>
                      <ChevronRight size={14} className="text-[#CBD5E1] group-hover:text-amber-500 transition-colors" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Accès rapides ── */}
        <div>
          <h2 className="font-bold text-[14px] text-[#0F172A] mb-3">Accès rapides</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Tous les clients',  href: '/dashboard/cabinet/clients',         icon: Users,       color: '#F59E0B' },
              { label: 'Projets',           href: '/dashboard/cabinet/projets',          icon: FolderOpen,  color: '#2563EB' },
              { label: 'Calendrier fiscal', href: '/dashboard/fiscalite',                icon: Calendar,    color: '#7C3AED' },
              { label: 'Comptabilité',      href: '/dashboard/comptabilite',             icon: BarChart3,   color: '#16A34A' },
              { label: 'Facturation',       href: '/dashboard/facturation',              icon: FileText,    color: '#EA580C' },
              { label: 'Mon équipe',        href: '/dashboard/rh',                       icon: Briefcase,   color: '#64748B' },
            ].map(s => {
              const Icon = s.icon
              return (
                <Link key={s.href} href={s.href}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-3 flex flex-col items-center gap-2 hover:border-amber-300 hover:shadow-sm transition-all text-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + '18' }}>
                    <Icon size={15} style={{ color: s.color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-[#0F172A] leading-tight">{s.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
