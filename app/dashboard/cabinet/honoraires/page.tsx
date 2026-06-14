'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  DollarSign, Plus, Search, RefreshCw, Loader2, CheckCircle,
  Clock, AlertTriangle, ChevronRight, FileText, Send,
  TrendingUp, Users, Calendar, X, Check, Eye,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Facture {
  id:                string
  numero:            string
  client_id:         string
  client_nom:        string
  mois:              number | null
  annee:             number
  montant_ht:        number
  taux_tva:          number
  montant_tva:       number
  montant_ttc:       number
  statut:            'brouillon' | 'envoyee' | 'payee' | 'retard' | 'annulee'
  date_emission:     string
  date_echeance:     string | null
  date_paiement:     string | null
  notes:             string | null
  types_mission:     string[]
  created_at:        string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const STATUT_CFG: Record<Facture['statut'], { label: string; bg: string; text: string; icon: React.ComponentType<{ size: number }> }> = {
  brouillon: { label: 'Brouillon', bg: '#F8FAFC', text: '#64748B',  icon: FileText  },
  envoyee:   { label: 'Envoyée',   bg: '#EFF6FF', text: '#2563EB',  icon: Send      },
  payee:     { label: 'Payée',     bg: '#F0FDF4', text: '#16A34A',  icon: CheckCircle},
  retard:    { label: 'En retard', bg: '#FEF2F2', text: '#DC2626',  icon: AlertTriangle},
  annulee:   { label: 'Annulée',   bg: '#F8FAFC', text: '#94A3B8',  icon: X         },
}

const TYPES_MISSION_LABELS: Record<string, string> = {
  comptabilite: 'Comptabilité', paie_rh: 'Paie & RH', tva: 'TVA', cnss: 'CNSS',
  patente: 'Patente', is: 'IS', audit: 'Audit', conseil: 'Conseil',
}

// ── Modal création facture ─────────────────────────────────────────────────────

interface CabinetClient { id: string; nom_entreprise: string; honoraires_mensuel: number; types_mission: string[] }

function ModalFacture({
  clients, onClose, onSaved,
}: {
  clients: CabinetClient[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    client_id:     '',
    mois:          new Date().getMonth() + 1,
    annee:         new Date().getFullYear(),
    montant_ht:    '',
    taux_tva:      '18',
    date_echeance: '',
    notes:         '',
    types_mission: [] as string[],
  })
  const [saving, setSaving] = useState(false)

  const selectedClient = clients.find(c => c.id === form.client_id)
  const montantHt  = parseFloat(form.montant_ht) || 0
  const tauxTva    = parseFloat(form.taux_tva) / 100
  const montantTva = montantHt * tauxTva
  const montantTtc = montantHt + montantTva

  function selectClient(id: string) {
    const c = clients.find(c => c.id === id)
    setForm(f => ({
      ...f,
      client_id:     id,
      montant_ht:    c ? String(c.honoraires_mensuel) : '',
      types_mission: c ? c.types_mission : [],
    }))
  }

  async function handleSave(statut: 'brouillon' | 'envoyee') {
    if (!form.client_id || !form.montant_ht) return
    setSaving(true)
    const num = `HON-${form.annee}-${String(form.mois).padStart(2, '0')}-${Date.now().toString().slice(-4)}`
    await fetch('/api/cabinet/honoraires', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero:        num,
        client_id:     form.client_id,
        client_nom:    selectedClient?.nom_entreprise ?? '',
        mois:          form.mois,
        annee:         form.annee,
        montant_ht:    montantHt,
        taux_tva:      parseFloat(form.taux_tva),
        montant_tva:   montantTva,
        montant_ttc:   montantTtc,
        statut,
        date_echeance: form.date_echeance || null,
        notes:         form.notes || null,
        types_mission: form.types_mission,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px] text-[#0F172A]">Nouvelle facture d'honoraires</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Client */}
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Client *</label>
            <select value={form.client_id} onChange={e => selectClient(e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
              <option value="">Sélectionner un client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom_entreprise}</option>)}
            </select>
          </div>

          {/* Période */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Mois</label>
              <select value={form.mois} onChange={e => setForm(f => ({ ...f, mois: parseInt(e.target.value) }))}
                className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                {MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Année</label>
              <input type="number" value={form.annee} onChange={e => setForm(f => ({ ...f, annee: parseInt(e.target.value) }))}
                className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>

          {/* Montant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Montant HT (FCFA) *</label>
              <input type="number" value={form.montant_ht} onChange={e => setForm(f => ({ ...f, montant_ht: e.target.value }))}
                className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="150000" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">TVA (%)</label>
              <select value={form.taux_tva} onChange={e => setForm(f => ({ ...f, taux_tva: e.target.value }))}
                className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                <option value="0">Exonéré (0%)</option>
                <option value="18">TVA 18%</option>
                <option value="19.25">TVA 19.25% (Cameroun)</option>
              </select>
            </div>
          </div>

          {/* Totaux */}
          {montantHt > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-[12px] text-[#64748B]">
                <span>Montant HT</span><span className="font-bold">{fmt(montantHt)} FCFA</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#64748B]">
                <span>TVA ({form.taux_tva}%)</span><span className="font-bold">{fmt(montantTva)} FCFA</span>
              </div>
              <div className="flex justify-between text-[14px] font-black text-amber-800 pt-1 border-t border-amber-200">
                <span>Total TTC</span><span>{fmt(montantTtc)} FCFA</span>
              </div>
            </div>
          )}

          {/* Échéance */}
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Date d'échéance</label>
            <input type="date" value={form.date_echeance} onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))}
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>

          {/* Missions */}
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Types de mission</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPES_MISSION_LABELS).map(([k, v]) => (
                <button key={k} type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    types_mission: f.types_mission.includes(k) ? f.types_mission.filter(x => x !== k) : [...f.types_mission, k]
                  }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    form.types_mission.includes(k) ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-amber-300'
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              placeholder="Honoraires de tenue comptable — mai 2026..." />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={() => handleSave('brouillon')} disabled={!form.client_id || !form.montant_ht || saving}
              className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-bold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              <FileText size={13} /> Brouillon
            </button>
            <button onClick={() => handleSave('envoyee')} disabled={!form.client_id || !form.montant_ht || saving}
              className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Émettre
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function CabinetHonorairesPage() {
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [factures, setFactures]     = useState<Facture[]>([])
  const [clients,  setClients]      = useState<CabinetClient[]>([])
  const [loading,  setLoading]      = useState(true)
  const [search,   setSearch]       = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [showModal, setShowModal]   = useState(false)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [{ data: f }, { data: c }] = await Promise.all([
      supabase.from('cabinet_honoraires_factures').select('*').eq('cabinet_tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('cabinet_clients').select('id, nom_entreprise, honoraires_mensuel, types_mission').eq('cabinet_tenant_id', tid).eq('statut', 'actif'),
    ])
    setFactures((f ?? []) as Facture[])
    setClients((c ?? []) as CabinetClient[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  async function marquerPayee(id: string) {
    await supabase.from('cabinet_honoraires_factures')
      .update({ statut: 'payee', date_paiement: new Date().toISOString() })
      .eq('id', id).eq('cabinet_tenant_id', tid)
    load()
  }

  const filtered = factures.filter(f => {
    const q = search.toLowerCase()
    const matchQ = !q || f.client_nom.toLowerCase().includes(q) || f.numero.toLowerCase().includes(q)
    const matchS = filterStatut === 'tous' || f.statut === filterStatut
    return matchQ && matchS
  })

  // KPIs
  const now = new Date()
  const moisActuel = now.getMonth() + 1
  const anneeActuelle = now.getFullYear()
  const kpis = {
    totalEmis:    factures.filter(f => f.statut !== 'annulee').reduce((s, f) => s + f.montant_ttc, 0),
    encaisse:     factures.filter(f => f.statut === 'payee').reduce((s, f) => s + f.montant_ttc, 0),
    enAttente:    factures.filter(f => f.statut === 'envoyee').reduce((s, f) => s + f.montant_ttc, 0),
    enRetard:     factures.filter(f => f.statut === 'retard').reduce((s, f) => s + f.montant_ttc, 0),
    moisActuel:   factures.filter(f => f.mois === moisActuel && f.annee === anneeActuelle && f.statut !== 'annulee').reduce((s, f) => s + f.montant_ttc, 0),
  }

  // Graphique mensuel (12 mois)
  const revParMois = Array.from({ length: 12 }, (_, i) => ({
    mois: i + 1,
    montant: factures.filter(f => f.mois === i + 1 && f.annee === anneeActuelle && f.statut === 'payee').reduce((s, f) => s + f.montant_ttc, 0),
  }))
  const maxMois = Math.max(...revParMois.map(m => m.montant), 1)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/cabinet" className="text-[#64748B] hover:text-[#0F172A] text-[13px] flex items-center gap-1">
              ← Cabinet
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-amber-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Honoraires</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
              <RefreshCw size={13} />
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 shadow-sm">
              <Plus size={14} /> Nouvelle facture
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total émis',     value: `${fmt(kpis.totalEmis)} F`,   color: '#0F172A', sub: anneeActuelle.toString() },
            { label: 'Encaissé',       value: `${fmt(kpis.encaisse)} F`,    color: '#16A34A', sub: 'Payées' },
            { label: 'En attente',     value: `${fmt(kpis.enAttente)} F`,   color: '#2563EB', sub: 'Envoyées' },
            { label: 'En retard',      value: `${fmt(kpis.enRetard)} F`,    color: '#DC2626', sub: 'Impayées' },
            { label: `${MOIS[moisActuel-1]} ${anneeActuelle}`, value: `${fmt(kpis.moisActuel)} F`, color: '#F59E0B', sub: 'Mois actuel' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{k.label}</p>
              <p className="text-[16px] font-black tabular-nums" style={{ color: k.color }}>{k.value}</p>
              <p className="text-[10px] text-[#94A3B8]">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Graphique revenus mensuels */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2">
              <TrendingUp size={14} className="text-amber-500" /> Revenus encaissés {anneeActuelle}
            </p>
            <p className="text-[13px] font-black text-amber-600">{fmt(kpis.encaisse)} FCFA</p>
          </div>
          <div className="flex items-end gap-1 h-20">
            {revParMois.map((m, i) => {
              const h = Math.max(4, Math.round((m.montant / maxMois) * 80))
              const isNow = i + 1 === moisActuel
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-1" title={`${MOIS[i]}: ${fmt(m.montant)} F`}>
                  <div className="w-full rounded-t-lg transition-all"
                    style={{ height: h, background: isNow ? '#F59E0B' : m.montant > 0 ? '#FDE68A' : '#F1F5F9' }} />
                  <span className={`text-[8px] font-bold ${isNow ? 'text-amber-600' : 'text-[#CBD5E1]'}`}>{MOIS[i].slice(0,1)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher client, n° facture..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {(['tous', 'brouillon', 'envoyee', 'payee', 'retard'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatut(s)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all capitalize whitespace-nowrap ${filterStatut === s ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                {s === 'tous' ? `Tout (${factures.length})` : STATUT_CFG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Liste factures */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <DollarSign size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucune facture</p>
            <p className="text-[13px] text-[#64748B] mb-4">Créez votre première facture d'honoraires.</p>
            <button onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
              <Plus size={13} /> Nouvelle facture
            </button>
          </div>
        ) : (
          <>
            {/* Vue desktop tableau */}
            <div className="hidden sm:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {['N° Facture', 'Client', 'Période', 'Montant TTC', 'Échéance', 'Statut', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F8FAFC]">
                    {filtered.map(f => {
                      const sc = STATUT_CFG[f.statut]
                      const Icon = sc.icon
                      return (
                        <tr key={f.id} className="hover:bg-[#FFFBEB]">
                          <td className="px-4 py-3">
                            <p className="font-bold text-[13px] text-[#0F172A]">{f.numero}</p>
                            {f.types_mission.length > 0 && (
                              <p className="text-[10px] text-[#94A3B8]">{f.types_mission.map(m => TYPES_MISSION_LABELS[m] ?? m).join(', ')}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/cabinet/clients/${f.client_id}`}
                              className="text-[13px] font-semibold text-amber-700 hover:underline">{f.client_nom}</Link>
                          </td>
                          <td className="px-4 py-3 text-[12px] text-[#64748B]">
                            {f.mois ? `${MOIS[f.mois - 1]} ${f.annee}` : f.annee}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-black text-[14px] text-[#0F172A]">{fmt(f.montant_ttc)} <span className="text-[11px] font-normal text-[#94A3B8]">FCFA</span></p>
                            <p className="text-[10px] text-[#94A3B8]">HT: {fmt(f.montant_ht)}</p>
                          </td>
                          <td className="px-4 py-3 text-[12px] font-semibold text-[#0F172A]">
                            {fmtDate(f.date_echeance)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold w-fit"
                              style={{ background: sc.bg, color: sc.text }}>
                              <Icon size={10} /> {sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {f.statut === 'envoyee' && (
                              <button onClick={() => marquerPayee(f.id)}
                                className="flex items-center gap-1 text-[11px] font-bold text-green-700 hover:text-green-900 px-2 py-1 rounded-lg hover:bg-green-50">
                                <Check size={11} /> Marquer payée
                              </button>
                            )}
                            {f.statut === 'payee' && (
                              <span className="text-[11px] text-[#94A3B8]">{fmtDate(f.date_paiement)}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vue mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map(f => {
                const sc = STATUT_CFG[f.statut]
                const Icon = sc.icon
                return (
                  <div key={f.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-[13px] text-[#0F172A]">{f.numero}</p>
                        <Link href={`/dashboard/cabinet/clients/${f.client_id}`} className="text-[12px] text-amber-700 font-semibold">{f.client_nom}</Link>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: sc.bg, color: sc.text }}>
                        <Icon size={9} /> {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-[16px] text-[#0F172A]">{fmt(f.montant_ttc)} <span className="text-[11px] font-normal text-[#94A3B8]">FCFA</span></p>
                        <p className="text-[11px] text-[#64748B]">{f.mois ? `${MOIS[f.mois - 1]} ${f.annee}` : f.annee}</p>
                      </div>
                      {f.statut === 'envoyee' && (
                        <button onClick={() => marquerPayee(f.id)}
                          className="flex items-center gap-1 text-[11px] font-bold text-white bg-green-600 px-3 py-1.5 rounded-xl">
                          <Check size={11} /> Payée
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {showModal && <ModalFacture clients={clients} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </div>
  )
}
