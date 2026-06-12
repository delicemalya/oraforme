'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  Users, Plus, Search, Phone, Mail, Building2, TrendingUp,
  Target, Activity, ChevronRight, X, Edit3, Trash2,
  DollarSign, AlertTriangle, CheckCircle, Clock, BarChart3,
  ArrowRight, Star, MessageSquare, PhoneCall, Calendar,
  FileText, Briefcase, ShieldAlert, Loader2, RefreshCw,
} from 'lucide-react'
import MIAAContextButton from '@/components/miaa/MIAAContextButton'

// ── Types ────────────────────────────────────────────────────────────────────

type ClientStatut = 'actif' | 'prospect' | 'inactif' | 'bloque'
type OppEtape = 'prospection' | 'qualification' | 'proposition' | 'negociation' | 'gagne' | 'perdu'
type ActiviteType = 'appel' | 'email' | 'reunion' | 'note' | 'devis_envoye' | 'relance' | 'visite'

interface Client {
  id: string
  nom: string
  email?: string | null
  telephone?: string | null
  entreprise?: string | null
  secteur?: string | null
  ville?: string | null
  statut: ClientStatut
  type?: string
  score_risque?: number
  ca_total?: number
  impaye_total?: number
  nb_factures?: number
  nb_impayes?: number
  notes?: string | null
  niu?: string | null
  created_at: string
  tags?: string[]
}

interface Opportunite {
  id: string
  client_id?: string | null
  titre: string
  montant_estime: number
  probabilite: number
  etape: OppEtape
  date_cloture_prevue?: string | null
  notes?: string | null
  created_at: string
  clients?: { nom: string; entreprise?: string | null } | null
}

interface Activite {
  id: string
  client_id?: string | null
  opportunite_id?: string | null
  type: ActiviteType
  titre: string
  description?: string | null
  date_activite: string
  fait: boolean
  created_at: string
  clients?: { nom: string } | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const ETAPES: { id: OppEtape; label: string; color: string; bg: string }[] = [
  { id: 'prospection',   label: 'Prospection',   color: '#64748B', bg: '#F1F5F9' },
  { id: 'qualification', label: 'Qualification', color: '#2563EB', bg: '#EFF6FF' },
  { id: 'proposition',  label: 'Proposition',   color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'negociation',  label: 'Négociation',   color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'gagne',        label: 'Gagné',          color: '#16A34A', bg: '#F0FDF4' },
  { id: 'perdu',        label: 'Perdu',          color: '#DC2626', bg: '#FEF2F2' },
]

const ACT_ICONS: Record<ActiviteType, React.ElementType> = {
  appel: PhoneCall, email: Mail, reunion: Calendar, note: MessageSquare,
  devis_envoye: FileText, relance: AlertTriangle, visite: Briefcase,
}

const ACT_COLORS: Record<ActiviteType, string> = {
  appel: '#2563EB', email: '#7C3AED', reunion: '#F59E0B', note: '#64748B',
  devis_envoye: '#16A34A', relance: '#DC2626', visite: '#0EA5E9',
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function scoreColor(s?: number) {
  if (!s) return '#64748B'
  if (s >= 70) return '#16A34A'
  if (s >= 40) return '#F59E0B'
  return '#DC2626'
}
function scoreLabel(s?: number) {
  if (!s) return 'N/A'
  if (s >= 70) return 'Bon'
  if (s >= 40) return 'Moyen'
  return 'Risqué'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score?: number }) {
  const c = scoreColor(score)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: c + '18', color: c }}>
      <ShieldAlert size={10} /> {score ?? 'N/A'} — {scoreLabel(score)}
    </span>
  )
}

function StatutBadge({ statut }: { statut: ClientStatut }) {
  const map: Record<ClientStatut, { label: string; color: string }> = {
    actif:    { label: 'Client actif', color: '#16A34A' },
    prospect: { label: 'Prospect',     color: '#F59E0B' },
    inactif:  { label: 'Inactif',      color: '#64748B' },
    bloque:   { label: 'Bloqué',       color: '#DC2626' },
  }
  const { label, color } = map[statut] ?? map.actif
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: color + '18', color }}>
      {label}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const { fmt: _fmt } = useFmt()
  const fmt = (n?: number | null) => _fmt(n ?? 0)
  const { tenant } = useTenantContext()
  const [tab, setTab] = useState<'clients' | 'pipeline' | 'activites'>('clients')
  const [clients, setClients] = useState<Client[]>([])
  const [opps, setOpps] = useState<Opportunite[]>([])
  const [activites, setActivites] = useState<Activite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('tous')

  // Drawers / modals
  const [showNewClient, setShowNewClient] = useState(false)
  const [showNewOpp, setShowNewOpp] = useState(false)
  const [showNewAct, setShowNewAct] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientFactures, setClientFactures] = useState<{id:string;invoice_number:string;total:number;statut:string;date:string}[]>([])
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editingActivite, setEditingActivite] = useState<Activite | null>(null)

  // Forms
  const [clientForm, setClientForm] = useState({ nom: '', email: '', telephone: '', entreprise: '', secteur: '', ville: '', statut: 'actif' as ClientStatut, niu: '', notes: '' })
  const [oppForm, setOppForm] = useState({ titre: '', client_id: '', montant_estime: '', probabilite: '30', etape: 'qualification' as OppEtape, date_cloture_prevue: '', notes: '' })
  const [actForm, setActForm] = useState({ titre: '', type: 'note' as ActiviteType, client_id: '', description: '', date_activite: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  const tid = tenant?.tenantId

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    try {
      const [{ data: c }, { data: o }, { data: a }] = await Promise.all([
        supabase.from('clients').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }),
        supabase.from('crm_opportunites').select('*, clients(nom, entreprise)').eq('tenant_id', tid).order('created_at', { ascending: false }),
        supabase.from('crm_activites').select('*, clients(nom)').eq('tenant_id', tid).order('date_activite', { ascending: false }).limit(50),
      ])
      setClients((c ?? []) as Client[])
      setOpps((o ?? []) as unknown as Opportunite[])
      setActivites((a ?? []) as unknown as Activite[])
    } catch (err) {
      console.error('[CRM] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [tid])

  useEffect(() => { load() }, [load])

  async function loadClientDetail(c: Client) {
    setSelectedClient(c)
    if (!tid) return
    const { data } = await supabase.from('factures').select('id,invoice_number,total,statut,date')
      .eq('tenant_id', tid).eq('client_id', c.id).order('date', { ascending: false }).limit(10)
    setClientFactures((data ?? []) as typeof clientFactures)
  }

  async function createOpp(e: React.FormEvent) {
    e.preventDefault()
    if (!oppForm.titre.trim() || !tid) return
    setSaving(true)
    await supabase.from('crm_opportunites').insert({
      tenant_id: tid, titre: oppForm.titre.trim(),
      client_id: oppForm.client_id || null,
      montant_estime: Number(oppForm.montant_estime) || 0,
      probabilite: Number(oppForm.probabilite) || 20,
      etape: oppForm.etape,
      date_cloture_prevue: oppForm.date_cloture_prevue || null,
      notes: oppForm.notes || null,
    })
    setSaving(false)
    setShowNewOpp(false)
    setOppForm({ titre: '', client_id: '', montant_estime: '', probabilite: '30', etape: 'qualification', date_cloture_prevue: '', notes: '' })
    load()
  }

  async function moveOpp(id: string, etape: OppEtape) {
    if (!tid) return
    await supabase.from('crm_opportunites').update({ etape }).eq('id', id).eq('tenant_id', tid)
    setOpps(prev => prev.map(o => o.id === id ? { ...o, etape } : o))
  }

  async function deleteClient(id: string) {
    if (!tid || !confirm('Supprimer ce client ?')) return
    await supabase.from('clients').delete().eq('id', id).eq('tenant_id', tid)
    setSelectedClient(null)
    load()
  }

  function startEditClient(c: Client) {
    setEditingClient(c)
    setClientForm({ nom: c.nom, email: c.email ?? '', telephone: c.telephone ?? '', entreprise: c.entreprise ?? '', secteur: c.secteur ?? '', ville: c.ville ?? '', statut: c.statut, niu: c.niu ?? '', notes: c.notes ?? '' })
    setSelectedClient(null)
    setShowNewClient(true)
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault()
    if (!clientForm.nom.trim() || !tid) return
    setSaving(true)
    if (editingClient) {
      await supabase.from('clients').update({
        nom: clientForm.nom.trim(), email: clientForm.email || null,
        telephone: clientForm.telephone || null, entreprise: clientForm.entreprise || null,
        secteur: clientForm.secteur || null, ville: clientForm.ville || null,
        niu: clientForm.niu || null, notes: clientForm.notes || null,
        statut: clientForm.statut,
        type: clientForm.statut === 'prospect' ? 'prospect' : 'client',
      }).eq('id', editingClient.id).eq('tenant_id', tid)
    } else {
      await supabase.from('clients').insert({
        tenant_id: tid, nom: clientForm.nom.trim(),
        email: clientForm.email || null, telephone: clientForm.telephone || null,
        entreprise: clientForm.entreprise || null, secteur: clientForm.secteur || null,
        ville: clientForm.ville || null, niu: clientForm.niu || null,
        notes: clientForm.notes || null, statut: clientForm.statut,
        type: clientForm.statut === 'prospect' ? 'prospect' : 'client',
      })
    }
    setSaving(false)
    setShowNewClient(false)
    setEditingClient(null)
    setClientForm({ nom: '', email: '', telephone: '', entreprise: '', secteur: '', ville: '', statut: 'actif', niu: '', notes: '' })
    load()
  }

  async function deleteOpp(id: string) {
    if (!tid || !confirm('Supprimer cette opportunité ?')) return
    await supabase.from('crm_opportunites').delete().eq('id', id).eq('tenant_id', tid)
    setOpps(prev => prev.filter(o => o.id !== id))
  }

  function startEditActivite(a: Activite) {
    setEditingActivite(a)
    setActForm({ titre: a.titre, type: a.type, client_id: a.client_id ?? '', description: a.description ?? '', date_activite: a.date_activite.split('T')[0] })
    setShowNewAct(true)
  }

  async function saveActivite(e: React.FormEvent) {
    e.preventDefault()
    if (!actForm.titre.trim() || !tid) return
    setSaving(true)
    if (editingActivite) {
      await supabase.from('crm_activites').update({
        titre: actForm.titre.trim(), type: actForm.type,
        client_id: actForm.client_id || null,
        description: actForm.description || null,
        date_activite: actForm.date_activite,
      }).eq('id', editingActivite.id).eq('tenant_id', tid)
    } else {
      await supabase.from('crm_activites').insert({
        tenant_id: tid, titre: actForm.titre.trim(),
        type: actForm.type, client_id: actForm.client_id || null,
        description: actForm.description || null,
        date_activite: actForm.date_activite,
      })
    }
    setSaving(false)
    setShowNewAct(false)
    setEditingActivite(null)
    setActForm({ titre: '', type: 'note', client_id: '', description: '', date_activite: new Date().toISOString().split('T')[0] })
    load()
  }

  async function deleteActivite(id: string) {
    if (!tid || !confirm('Supprimer cette activité ?')) return
    await supabase.from('crm_activites').delete().eq('id', id).eq('tenant_id', tid)
    setActivites(prev => prev.filter(a => a.id !== id))
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const nbActifs    = clients.filter(c => c.statut === 'actif').length
  const nbProspects = clients.filter(c => c.statut === 'prospect').length
  const caTotal     = clients.reduce((s, c) => s + (c.ca_total ?? 0), 0)
  const pipelineCA  = opps.filter(o => !['gagne','perdu'].includes(o.etape))
    .reduce((s, o) => s + o.montant_estime * o.probabilite / 100, 0)

  const filteredClients = clients.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.nom.toLowerCase().includes(q) || c.entreprise?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.telephone?.includes(q)
    const matchStatut = filterStatut === 'tous' || c.statut === filterStatut
    return matchSearch && matchStatut
  })

  // ── Render ────────────────────────────────────────────────────────────────

  const kpis = [
    { label: 'Clients actifs', value: nbActifs, color: '#16A34A', icon: Users },
    { label: 'Prospects', value: nbProspects, color: '#F59E0B', icon: Target },
    { label: 'CA généré', value: fmt(caTotal), color: '#2563EB', icon: DollarSign },
    { label: 'Pipeline pondéré', value: fmt(pipelineCA), color: '#7C3AED', icon: TrendingUp },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* ── Header ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100">
              <Users size={18} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-[#0F172A]">CRM — Clients & Ventes</h1>
              <p className="text-[12px] text-[#64748B]">Relations commerciales, pipeline, activités</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <MIAAContextButton module="crm" />
            <button onClick={() => setShowNewAct(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors">
              <Activity size={14} /> Activité
            </button>
            <button onClick={() => setShowNewOpp(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 text-[13px] font-semibold text-purple-700 hover:bg-purple-50 transition-colors">
              <Target size={14} /> Opportunité
            </button>
            <button onClick={() => setShowNewClient(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F59E0B] text-white text-[13px] font-semibold hover:bg-amber-600 transition-colors shadow-sm">
              <Plus size={14} /> Nouveau client
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.color + '18' }}>
                    <Icon size={14} style={{ color: k.color }} />
                  </div>
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{k.label}</span>
                </div>
                <p className="text-[20px] font-black text-[#0F172A]">{k.value}</p>
              </div>
            )
          })}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 w-fit">
          {([['clients', Users, 'Clients & Prospects'], ['pipeline', BarChart3, 'Pipeline'], ['activites', Activity, 'Activités']] as [typeof tab, React.ElementType, string][]).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${tab === id ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Clients ── */}
        {tab === 'clients' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher nom, email, entreprise..."
                  className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
              </div>
              <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                className="px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                <option value="tous">Tous ({clients.length})</option>
                <option value="actif">Clients actifs ({nbActifs})</option>
                <option value="prospect">Prospects ({nbProspects})</option>
                <option value="inactif">Inactifs</option>
                <option value="bloque">Bloqués</option>
              </select>
              <button onClick={load} className="flex items-center gap-1.5 px-3 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B] hover:bg-[#F8FAFC]">
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-[#94A3B8]">
                  <Loader2 size={18} className="animate-spin" /> Chargement...
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={32} className="text-[#CBD5E1] mx-auto mb-3" />
                  <p className="text-[#64748B] font-semibold">Aucun client trouvé</p>
                  <button onClick={() => setShowNewClient(true)} className="mt-3 text-[13px] text-amber-600 hover:underline font-semibold">
                    + Ajouter un client
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {['Client / Entreprise','Contact','Statut','Score risque','CA généré','Impayés','Depuis'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                        ))}
                        <th className="px-4 py-3 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {filteredClients.map(c => (
                        <tr key={c.id} onClick={() => loadClientDetail(c)}
                          className="hover:bg-[#FFFBEB] cursor-pointer transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#0F172A] text-[13px]">{c.nom}</p>
                            {c.entreprise && <p className="text-[11px] text-[#64748B]">{c.entreprise}</p>}
                            {c.secteur && <p className="text-[10px] text-[#94A3B8]">{c.secteur}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {c.email && <p className="text-[12px] flex items-center gap-1 text-[#475569]"><Mail size={11} className="text-[#94A3B8]" />{c.email}</p>}
                              {c.telephone && <p className="text-[12px] flex items-center gap-1 text-[#475569]"><Phone size={11} className="text-[#94A3B8]" />{c.telephone}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3"><StatutBadge statut={c.statut} /></td>
                          <td className="px-4 py-3"><ScoreBadge score={c.score_risque} /></td>
                          <td className="px-4 py-3 font-semibold text-[13px] text-[#0F172A] tabular-nums">{fmt(c.ca_total)}</td>
                          <td className="px-4 py-3">
                            {(c.impaye_total ?? 0) > 0 ? (
                              <span className="text-[12px] font-bold text-red-600">{fmt(c.impaye_total)}</span>
                            ) : <span className="text-[12px] text-green-600 font-semibold">—</span>}
                          </td>
                          <td className="px-4 py-3 text-[12px] text-[#94A3B8]">{fmtDate(c.created_at)}</td>
                          <td className="px-4 py-3"><ChevronRight size={14} className="text-[#CBD5E1]" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Pipeline Kanban ── */}
        {tab === 'pipeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#64748B]">{opps.length} opportunités · pipeline pondéré {fmt(pipelineCA)}</p>
              <button onClick={() => setShowNewOpp(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 text-white text-[13px] font-semibold hover:bg-purple-700">
                <Plus size={14} /> Opportunité
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {ETAPES.map(etape => {
                const etapeOpps = opps.filter(o => o.etape === etape.id)
                const etapeCA = etapeOpps.reduce((s, o) => s + o.montant_estime, 0)
                return (
                  <div key={etape.id} className="rounded-xl border-2 p-3 min-h-[300px]"
                    style={{ background: etape.bg, borderColor: etape.color + '30' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[12px] font-bold" style={{ color: etape.color }}>{etape.label}</p>
                        <p className="text-[10px] text-[#64748B]">{etapeOpps.length} opp · {fmt(etapeCA)}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                        style={{ background: etape.color }}>
                        {etapeOpps.length}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {etapeOpps.map(opp => (
                        <div key={opp.id} className="bg-white rounded-lg p-2.5 shadow-sm border border-white/80">
                          <p className="text-[12px] font-bold text-[#0F172A] leading-tight mb-1">{opp.titre}</p>
                          {opp.clients && (
                            <p className="text-[10px] text-[#64748B] flex items-center gap-1">
                              <Building2 size={9} /> {opp.clients.nom}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[11px] font-black text-[#0F172A]">{fmt(opp.montant_estime)}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: etape.color + '20', color: etape.color }}>
                              {opp.probabilite}%
                            </span>
                          </div>
                          {opp.date_cloture_prevue && (
                            <p className="text-[10px] text-[#94A3B8] mt-1 flex items-center gap-1">
                              <Clock size={9} /> {fmtDate(opp.date_cloture_prevue)}
                            </p>
                          )}
                          {/* Move + delete buttons */}
                          <div className="flex gap-1 mt-2">
                            {ETAPES.filter(e => e.id !== etape.id).slice(0, 2).map(target => (
                              <button key={target.id} onClick={() => moveOpp(opp.id, target.id)}
                                className="flex-1 py-1 rounded text-[9px] font-bold transition-colors"
                                style={{ background: target.color + '15', color: target.color }}
                                title={`→ ${target.label}`}>
                                → {target.label.slice(0, 5)}
                              </button>
                            ))}
                            <button onClick={() => deleteOpp(opp.id)}
                              className="px-1.5 py-1 rounded text-[9px] font-bold transition-colors bg-red-50 text-red-500 hover:bg-red-100"
                              title="Supprimer">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Tab: Activités ── */}
        {tab === 'activites' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#64748B]">{activites.length} activités récentes</p>
              <button onClick={() => setShowNewAct(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0F172A] text-white text-[13px] font-semibold hover:bg-[#1E293B]">
                <Plus size={14} /> Activité
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
              {activites.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity size={32} className="text-[#CBD5E1] mx-auto mb-3" />
                  <p className="text-[#64748B] font-semibold">Aucune activité enregistrée</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {activites.map(a => {
                    const Icon = ACT_ICONS[a.type]
                    const color = ACT_COLORS[a.type]
                    return (
                      <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC]">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 shrink-0"
                          style={{ background: color + '15' }}>
                          <Icon size={14} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[13px] text-[#0F172A] truncate">{a.titre}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                              style={{ background: color + '15', color }}>{a.type}</span>
                          </div>
                          {a.clients && <p className="text-[11px] text-[#64748B]">{(a.clients as {nom:string}).nom}</p>}
                          {a.description && <p className="text-[12px] text-[#475569] mt-0.5 line-clamp-1">{a.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <p className="text-[11px] text-[#94A3B8]">{fmtDate(a.date_activite)}</p>
                          <button onClick={() => startEditActivite(a)}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-[#94A3B8] hover:text-amber-600 transition-colors">
                            <Edit3 size={12} />
                          </button>
                          <button onClick={() => deleteActivite(a.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-600 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Drawer: Client Detail ── */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedClient(null)}>
          <div className="flex-1 bg-black/30" />
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
              <div>
                <h2 className="font-bold text-[16px] text-[#0F172A]">{selectedClient.nom}</h2>
                {selectedClient.entreprise && <p className="text-[12px] text-[#64748B]">{selectedClient.entreprise}</p>}
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Score + statut */}
              <div className="flex gap-3">
                <ScoreBadge score={selectedClient.score_risque} />
                <StatutBadge statut={selectedClient.statut} />
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'CA total', value: fmt(selectedClient.ca_total), color: '#16A34A' },
                  { label: 'Impayés', value: fmt(selectedClient.impaye_total), color: (selectedClient.impaye_total ?? 0) > 0 ? '#DC2626' : '#16A34A' },
                  { label: 'Nb factures', value: String(selectedClient.nb_factures ?? 0), color: '#2563EB' },
                  { label: 'Nb impayés', value: String(selectedClient.nb_impayes ?? 0), color: (selectedClient.nb_impayes ?? 0) > 0 ? '#DC2626' : '#16A34A' },
                ].map(k => (
                  <div key={k.label} className="rounded-xl border border-[#E2E8F0] p-3">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{k.label}</p>
                    <p className="text-[18px] font-black" style={{ color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Infos */}
              <div className="rounded-xl border border-[#E2E8F0] p-3 space-y-2">
                {selectedClient.email && <p className="text-[13px] flex items-center gap-2"><Mail size={13} className="text-[#94A3B8]" />{selectedClient.email}</p>}
                {selectedClient.telephone && <p className="text-[13px] flex items-center gap-2"><Phone size={13} className="text-[#94A3B8]" />{selectedClient.telephone}</p>}
                {selectedClient.secteur && <p className="text-[13px] flex items-center gap-2"><Briefcase size={13} className="text-[#94A3B8]" />{selectedClient.secteur}</p>}
                {selectedClient.ville && <p className="text-[13px] flex items-center gap-2"><Building2 size={13} className="text-[#94A3B8]" />{selectedClient.ville}</p>}
                {selectedClient.niu && <p className="text-[13px] flex items-center gap-2"><FileText size={13} className="text-[#94A3B8]" />NIU: {selectedClient.niu}</p>}
              </div>

              {/* Historique factures */}
              <div>
                <h3 className="text-[13px] font-bold text-[#0F172A] mb-2 flex items-center gap-2">
                  <FileText size={14} /> Historique factures ({clientFactures.length})
                </h3>
                {clientFactures.length === 0 ? (
                  <p className="text-[12px] text-[#94A3B8] italic">Aucune facture liée à ce client</p>
                ) : (
                  <div className="space-y-1.5">
                    {clientFactures.map(f => {
                      const statColors: Record<string, string> = { payee: '#16A34A', brouillon: '#64748B', envoyee: '#2563EB', retard: '#DC2626', annulee: '#94A3B8' }
                      const c = statColors[f.statut] ?? '#64748B'
                      return (
                        <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC]">
                          <div>
                            <p className="text-[12px] font-semibold text-[#0F172A]">{f.invoice_number ?? 'Brouillon'}</p>
                            <p className="text-[10px] text-[#94A3B8]">{fmtDate(f.date)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-bold text-[#0F172A]">{fmt(f.total)}</p>
                            <span className="text-[10px] font-bold" style={{ color: c }}>{f.statut}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={() => startEditClient(selectedClient)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-amber-200 rounded-xl text-[13px] font-semibold text-amber-700 hover:bg-amber-50">
                  <Edit3 size={13} /> Modifier
                </button>
                <button onClick={() => { setActForm(p => ({...p, client_id: selectedClient.id})); setShowNewAct(true) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC]">
                  <Activity size={13} /> Activité
                </button>
                <button onClick={() => { setOppForm(p => ({...p, client_id: selectedClient.id})); setShowNewOpp(true) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-purple-200 rounded-xl text-[13px] font-semibold text-purple-700 hover:bg-purple-50">
                  <Target size={13} /> Opportunité
                </button>
                <button onClick={() => deleteClient(selectedClient.id)}
                  className="px-3 py-2.5 border border-red-200 rounded-xl text-[13px] font-semibold text-red-600 hover:bg-red-50">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nouveau client ── */}
      {showNewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-[#0F172A]">{editingClient ? 'Modifier le client' : 'Nouveau client / prospect'}</h2>
              <button onClick={() => { setShowNewClient(false); setEditingClient(null); setClientForm({ nom: '', email: '', telephone: '', entreprise: '', secteur: '', ville: '', statut: 'actif', niu: '', notes: '' }) }} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={saveClient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Nom complet *</label>
                  <input required value={clientForm.nom} onChange={e => setClientForm(p=>({...p,nom:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="Jean Dupont" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Entreprise</label>
                  <input value={clientForm.entreprise} onChange={e => setClientForm(p=>({...p,entreprise:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="SARL Exemple" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Secteur</label>
                  <input value={clientForm.secteur} onChange={e => setClientForm(p=>({...p,secteur:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="BTP, Commerce..." />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Email</label>
                  <input type="email" value={clientForm.email} onChange={e => setClientForm(p=>({...p,email:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="jean@email.com" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Téléphone</label>
                  <input value={clientForm.telephone} onChange={e => setClientForm(p=>({...p,telephone:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="+242 06..." />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Ville</label>
                  <input value={clientForm.ville} onChange={e => setClientForm(p=>({...p,ville:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="Brazzaville" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">NIU</label>
                  <input value={clientForm.niu} onChange={e => setClientForm(p=>({...p,niu:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="M1234567890" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Statut</label>
                  <select value={clientForm.statut} onChange={e => setClientForm(p=>({...p,statut:e.target.value as ClientStatut}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                    <option value="actif">Client actif</option>
                    <option value="prospect">Prospect</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Notes</label>
                  <textarea value={clientForm.notes} onChange={e => setClientForm(p=>({...p,notes:e.target.value}))} rows={2}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                    placeholder="Informations complémentaires..." />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowNewClient(false); setEditingClient(null); setClientForm({ nom: '', email: '', telephone: '', entreprise: '', secteur: '', ville: '', statut: 'actif', niu: '', notes: '' }) }}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-semibold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : editingClient ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Nouvelle opportunité ── */}
      {showNewOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-[#0F172A]">Nouvelle opportunité</h2>
              <button onClick={() => setShowNewOpp(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={createOpp} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Titre *</label>
                <input required value={oppForm.titre} onChange={e => setOppForm(p=>({...p,titre:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                  placeholder="Contrat maintenance 2026..." />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Client</label>
                <select value={oppForm.client_id} onChange={e => setOppForm(p=>({...p,client_id:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  <option value="">— Sélectionner un client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}{c.entreprise ? ` (${c.entreprise})` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Montant estimé</label>
                  <input type="number" value={oppForm.montant_estime} onChange={e => setOppForm(p=>({...p,montant_estime:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                    placeholder="0" min="0" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Probabilité (%)</label>
                  <input type="number" value={oppForm.probabilite} onChange={e => setOppForm(p=>({...p,probabilite:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                    min="0" max="100" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Étape</label>
                <select value={oppForm.etape} onChange={e => setOppForm(p=>({...p,etape:e.target.value as OppEtape}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  {ETAPES.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Date de clôture prévue</label>
                <input type="date" value={oppForm.date_cloture_prevue} onChange={e => setOppForm(p=>({...p,date_cloture_prevue:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewOpp(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-[13px] font-semibold hover:bg-purple-700 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Nouvelle activité ── */}
      {showNewAct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-[#0F172A]">{editingActivite ? 'Modifier l\'activité' : 'Nouvelle activité'}</h2>
              <button onClick={() => { setShowNewAct(false); setEditingActivite(null); setActForm({ titre: '', type: 'note', client_id: '', description: '', date_activite: new Date().toISOString().split('T')[0] }) }} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={saveActivite} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Type</label>
                <select value={actForm.type} onChange={e => setActForm(p=>({...p,type:e.target.value as ActiviteType}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white">
                  {Object.entries({ appel: 'Appel téléphonique', email: 'Email', reunion: 'Réunion', note: 'Note', devis_envoye: 'Devis envoyé', relance: 'Relance', visite: 'Visite' }).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Titre *</label>
                <input required value={actForm.titre} onChange={e => setActForm(p=>({...p,titre:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Appel de prospection..." />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Client</label>
                <select value={actForm.client_id} onChange={e => setActForm(p=>({...p,client_id:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white">
                  <option value="">— Sélectionner —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Date</label>
                <input type="date" value={actForm.date_activite} onChange={e => setActForm(p=>({...p,date_activite:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Description</label>
                <textarea value={actForm.description} onChange={e => setActForm(p=>({...p,description:e.target.value}))} rows={3}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                  placeholder="Détails de l'activité..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowNewAct(false); setEditingActivite(null); setActForm({ titre: '', type: 'note', client_id: '', description: '', date_activite: new Date().toISOString().split('T')[0] }) }}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-semibold hover:bg-[#1E293B] disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
