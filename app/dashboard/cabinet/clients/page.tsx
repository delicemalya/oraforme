'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  Users, Plus, Search, Building2, Phone, Mail,
  ChevronRight, RefreshCw, Loader2,
  DollarSign,
  TrendingUp, AlertCircle, Star, MoreVertical, X,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CabinetClient {
  id: string
  nom_entreprise: string
  forme_juridique: string | null
  secteur_activite: string | null
  pays: string | null
  ville: string | null
  telephone: string | null
  email: string | null
  niu: string | null
  contact_nom: string | null
  contact_prenom: string | null
  contact_email: string | null
  honoraires_mensuel: number
  devise_honoraires: string
  types_mission: string[]
  statut: string
  acces_actif: boolean
  frais_oraforme: number
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
function statutCfg(s: string) {
  const m: Record<string, { label: string; bg: string; text: string }> = {
    actif:    { label: 'Actif',    bg: '#F0FDF4', text: '#16A34A' },
    prospect: { label: 'Prospect', bg: '#FFFBEB', text: '#F59E0B' },
    suspendu: { label: 'Suspendu', bg: '#FFF7ED', text: '#EA580C' },
    archive:  { label: 'Archivé', bg: '#F8FAFC', text: '#64748B' },
    resilie:  { label: 'Résilié',  bg: '#FEF2F2', text: '#DC2626' },
  }
  return m[s] ?? m.actif
}

const SECTEURS = ['Tous', 'BTP', 'Commerce', 'Restaurant', 'École', 'Santé', 'Transport', 'Agriculture', 'Industrie', 'Services', 'Autre']
const STATUTS  = ['Tous', 'actif', 'prospect', 'suspendu', 'archive', 'resilie']
const TYPES_MISSION_LABELS: Record<string, string> = {
  comptabilite: 'Comptabilité',
  paie_rh: 'Paie & RH',
  tva: 'Décl. TVA',
  cnss: 'Décl. CNSS',
  patente: 'Patente',
  is: 'Décl. IS',
  audit: 'Audit',
  conseil: 'Conseil fiscal',
  formation: 'Formation',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CabinetClientsPage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const [clients, setClients] = useState<CabinetClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('Tous')
  const [filterSecteur, setFilterSecteur] = useState('Tous')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  const tid = tenant?.tenantId

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const { data } = await supabase
      .from('cabinet_clients')
      .select('*')
      .eq('cabinet_tenant_id', tid)
      .order('created_at', { ascending: false })
    setClients((data ?? []) as CabinetClient[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  async function changerStatut(id: string, statut: string) {
    if (!tid) return
    await supabase.from('cabinet_clients').update({ statut }).eq('id', id).eq('cabinet_tenant_id', tid)
    setActionMenu(null)
    load()
  }

  async function supprimerClient(id: string) {
    if (!tid || !confirm('Supprimer ce client ? Cette action est irréversible.')) return
    await supabase.from('cabinet_clients').delete().eq('id', id).eq('cabinet_tenant_id', tid)
    load()
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.nom_entreprise.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.niu?.toLowerCase().includes(q) || c.contact_nom?.toLowerCase().includes(q)
    const matchS = filterStatut === 'Tous' || c.statut === filterStatut
    const matchSec = filterSecteur === 'Tous' || c.secteur_activite === filterSecteur
    return matchQ && matchS && matchSec
  })

  const nbActifs    = clients.filter(c => c.statut === 'actif').length
  const nbProspects = clients.filter(c => c.statut === 'prospect').length
  const honorairesTotaux = clients.filter(c => c.statut === 'actif').reduce((s, c) => s + c.honoraires_mensuel, 0)
  const revenuOraforme   = clients.filter(c => c.statut === 'actif').reduce((s, c) => s + c.frais_oraforme, 0)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/cabinet" className="text-[#64748B] hover:text-[#0F172A] transition-colors">
              ← Cabinet
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Users size={16} className="text-amber-600" />
              <h1 className="text-[16px] font-bold text-[#0F172A]">Mes clients</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
              <RefreshCw size={13} />
            </button>
            <Link href="/dashboard/cabinet/clients/nouveau"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B] text-white text-[13px] font-bold hover:bg-amber-600 shadow-sm">
              <Plus size={14} /> Nouveau client
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* KPI résumé */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Clients actifs',   value: nbActifs,            color: '#16A34A', icon: Users },
            { label: 'Prospects',        value: nbProspects,         color: '#F59E0B', icon: TrendingUp },
            { label: 'Honoraires/mois',  value: fmt(honorairesTotaux), color: '#2563EB', icon: DollarSign },
            { label: 'Revenue Oraforme', value: fmt(revenuOraforme), color: '#DC2626', icon: Star },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: k.color + '18' }}>
                    <Icon size={12} style={{ color: k.color }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{k.label}</span>
                </div>
                <p className="text-[18px] font-black text-[#0F172A]">{k.value}</p>
              </div>
            )
          })}
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher nom, email, NIU..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
            {STATUTS.map(s => <option key={s} value={s}>{s === 'Tous' ? `Tous (${clients.length})` : s}</option>)}
          </select>
          <select value={filterSecteur} onChange={e => setFilterSecteur(e.target.value)}
            className="px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
            {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {(['cards', 'table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${view === v ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                {v === 'cards' ? 'Cards' : 'Tableau'}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Building2 size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucun client trouvé</p>
            <Link href="/dashboard/cabinet/clients/nouveau" className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B] text-white text-[13px] font-bold hover:bg-amber-600">
              <Plus size={14} /> Ajouter un client
            </Link>
          </div>
        ) : view === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => {
              const cfg = statutCfg(c.statut)
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden hover:border-amber-300 hover:shadow-md transition-all group">
                  {/* Top bar couleur statut */}
                  <div className="h-1.5" style={{ background: cfg.text }} />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black text-[14px] flex items-center justify-center shrink-0">
                          {c.nom_entreprise.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/dashboard/cabinet/clients/${c.id}`} className="font-bold text-[13px] text-[#0F172A] hover:text-amber-700 line-clamp-1 group-hover:text-amber-700">{c.nom_entreprise}</Link>
                          <p className="text-[11px] text-[#64748B]">{c.forme_juridique ?? ''}{c.secteur_activite ? ` · ${c.secteur_activite}` : ''}</p>
                        </div>
                      </div>
                      <div className="relative">
                        <button onClick={() => setActionMenu(actionMenu === c.id ? null : c.id)}
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
                          <MoreVertical size={14} />
                        </button>
                        {actionMenu === c.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-[#E2E8F0] py-1 min-w-[160px]">
                            <Link href={`/dashboard/cabinet/clients/${c.id}`} className="flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#F8FAFC]" onClick={() => setActionMenu(null)}>
                              <Building2 size={12} /> Ouvrir
                            </Link>
                            <button onClick={() => changerStatut(c.id, c.statut === 'actif' ? 'suspendu' : 'actif')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#F8FAFC] text-left">
                              <AlertCircle size={12} /> {c.statut === 'actif' ? 'Suspendre' : 'Réactiver'}
                            </button>
                            <button onClick={() => supprimerClient(c.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50 text-left">
                              <X size={12} /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="space-y-1 mb-3">
                      {c.email && <p className="text-[11px] flex items-center gap-1.5 text-[#475569]"><Mail size={10} className="text-[#94A3B8]" />{c.email}</p>}
                      {c.telephone && <p className="text-[11px] flex items-center gap-1.5 text-[#475569]"><Phone size={10} className="text-[#94A3B8]" />{c.telephone}</p>}
                      {c.ville && <p className="text-[11px] flex items-center gap-1.5 text-[#475569]"><Building2 size={10} className="text-[#94A3B8]" />{c.ville}</p>}
                    </div>

                    {/* Missions */}
                    {c.types_mission.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {c.types_mission.slice(0, 3).map(m => (
                          <span key={m} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded">
                            {TYPES_MISSION_LABELS[m] ?? m}
                          </span>
                        ))}
                        {c.types_mission.length > 3 && <span className="px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] text-[10px] rounded">+{c.types_mission.length - 3}</span>}
                      </div>
                    )}

                    {/* Honoraires + Statut */}
                    <div className="flex items-center justify-between">
                      <div>
                        {c.honoraires_mensuel > 0 && (
                          <p className="text-[12px] font-black text-[#0F172A]">{fmt(c.honoraires_mensuel)}<span className="text-[10px] font-normal text-[#64748B]">/mois</span></p>
                        )}
                        <p className="text-[10px] text-[#94A3B8]">depuis {fmtDate(c.created_at)}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <Link href={`/dashboard/cabinet/clients/${c.id}`}
                    className="flex items-center justify-between px-4 py-2.5 border-t border-[#F1F5F9] bg-[#F8FAFC] hover:bg-amber-50 transition-colors">
                    <span className="text-[11px] font-semibold text-[#64748B] group-hover:text-amber-700">Ouvrir l'espace client</span>
                    <ChevronRight size={13} className="text-[#CBD5E1] group-hover:text-amber-500" />
                  </Link>
                </div>
              )
            })}
          </div>
        ) : (
          // Vue tableau
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Entreprise','Secteur / Ville','Contact','Missions','Honoraires','Statut',''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filtered.map(c => {
                    const cfg = statutCfg(c.statut)
                    return (
                      <tr key={c.id} className="hover:bg-[#FFFBEB] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                              {c.nom_entreprise.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-[13px] text-[#0F172A]">{c.nom_entreprise}</p>
                              {c.niu && <p className="text-[10px] text-[#94A3B8]">NIU: {c.niu}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[12px] text-[#0F172A]">{c.secteur_activite ?? '—'}</p>
                          {c.ville && <p className="text-[11px] text-[#64748B]">{c.ville}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {c.contact_nom && <p className="text-[12px] text-[#0F172A]">{c.contact_prenom} {c.contact_nom}</p>}
                          {c.contact_email && <p className="text-[11px] text-[#64748B]">{c.contact_email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(c.types_mission ?? []).slice(0, 2).map(m => (
                              <span key={m} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded">{TYPES_MISSION_LABELS[m] ?? m}</span>
                            ))}
                            {(c.types_mission ?? []).length > 2 && <span className="text-[10px] text-[#64748B]">+{c.types_mission.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[13px] text-[#0F172A]">{c.honoraires_mensuel > 0 ? fmt(c.honoraires_mensuel) : '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/cabinet/clients/${c.id}`}
                            className="flex items-center gap-1 text-[11px] text-amber-600 hover:underline font-semibold">
                            Ouvrir <ChevronRight size={11} />
                          </Link>
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
    </div>
  )
}
