'use client'

/**
 * Comptes Tiers OHADA — Clients, Fournisseurs, Partenaires
 * Soldes, mouvements et gestion des tiers
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import { Users, Plus, Search, Download, ChevronDown, ChevronRight, X, Save, TrendingUp, TrendingDown } from 'lucide-react'

interface Tier {
  id: string; tenant_id: string; type: 'client' | 'fournisseur' | 'partenaire'
  code: string; nom: string; prenom: string; raison_sociale: string
  siret: string; nif: string; rccm: string; email: string; telephone: string
  adresse: string; compte_ohada: string; compte_auxiliaire: string
  plafond_credit: number; delai_paiement: number; actif: boolean
}

interface Movement {
  id: string; date_operation: string; libelle: string
  debit_account: string; credit_account: string; montant: number; source: string
}

interface TierWithSolde extends Tier {
  total_debit: number; total_credit: number; solde: number; movements: Movement[]
}

const TYPES = [
  { id: 'all',         label: 'Tous les tiers',   color: '#64748B' },
  { id: 'client',      label: 'Clients',           color: '#2563EB' },
  { id: 'fournisseur', label: 'Fournisseurs',      color: '#D97706' },
  { id: 'partenaire',  label: 'Partenaires',       color: '#8B5CF6' },
]

const EMPTY_FORM: Partial<Tier> = {
  type: 'client', code: '', nom: '', prenom: '', raison_sociale: '',
  nif: '', rccm: '', email: '', telephone: '', adresse: '',
  compte_ohada: '411000', compte_auxiliaire: '', plafond_credit: 0, delai_paiement: 30, actif: true,
}

const TYPE_DEFAULT_ACCOUNT: Record<string, string> = {
  client: '411000', fournisseur: '401000', partenaire: '467000',
}

export default function TiersPage() {
  const { tenantId } = useTenant()
  const [tiers, setTiers]         = useState<Tier[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch]       = useState('')
  const [year, setYear]           = useState(new Date().getFullYear())
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState<Partial<Tier>>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [tiersRes, mvRes] = await Promise.all([
        supabase.from('tiers')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('actif', true)
          .order('type').order('nom'),
        supabase.from('journal_entries')
          .select('id, date_operation, libelle, debit_account, credit_account, montant, source')
          .eq('tenant_id', tenantId)
          .eq('fiscal_year', year),
      ])
      setTiers((tiersRes.data || []) as Tier[])
      setMovements((mvRes.data || []) as Movement[])
      setLoading(false)
    })()
  }, [tenantId, year])

  /* Attach soldes to tiers */
  const tiersWithSolde = useMemo<TierWithSolde[]>(() => {
    return tiers.map(t => {
      const account = t.compte_ohada || t.compte_auxiliaire
      if (!account) return { ...t, total_debit: 0, total_credit: 0, solde: 0, movements: [] }

      const mvs = movements.filter(m => m.debit_account === account || m.credit_account === account)
      const td = mvs.reduce((s, m) => s + (m.debit_account === account ? m.montant : 0), 0)
      const tc = mvs.reduce((s, m) => s + (m.credit_account === account ? m.montant : 0), 0)
      return { ...t, total_debit: td, total_credit: tc, solde: td - tc, movements: mvs }
    })
  }, [tiers, movements])

  /* Filtered */
  const filtered = useMemo(() => {
    return tiersWithSolde.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.nom.toLowerCase().includes(q) ||
          t.raison_sociale?.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.nif?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [tiersWithSolde, filterType, search])

  /* KPIs */
  const kpis = useMemo(() => {
    const clients     = tiersWithSolde.filter(t => t.type === 'client')
    const fournis     = tiersWithSolde.filter(t => t.type === 'fournisseur')
    const creancesClients  = clients.reduce((s, t) => s + Math.max(t.solde, 0), 0)
    const dettesPatrons    = fournis.reduce((s, t) => s + Math.max(-t.solde, 0), 0)
    return { clients: clients.length, fournis: fournis.length, creancesClients, dettesPatrons }
  }, [tiersWithSolde])

  async function save() {
    if (!tenantId || !form.nom && !form.raison_sociale) return
    setSaving(true)
    const payload = { ...form, tenant_id: tenantId }
    if (editId) {
      await supabase.from('tiers').update(payload).eq('id', editId).eq('tenant_id', tenantId)
    } else {
      await supabase.from('tiers').insert(payload)
    }
    setSaving(false); setModal(false); setForm(EMPTY_FORM); setEditId(null)
    // Refresh
    const { data } = await supabase.from('tiers').select('*').eq('tenant_id', tenantId).eq('actif', true).order('type').order('nom')
    setTiers((data || []) as Tier[])
  }

  function openEdit(t: Tier) {
    setForm(t); setEditId(t.id); setModal(true)
  }

  function exportCSV() {
    const rows = filtered.map(t => ({
      Type: t.type, Code: t.code,
      Nom: t.raison_sociale || `${t.nom} ${t.prenom}`.trim(),
      NIF: t.nif, RCCM: t.rccm, Email: t.email, Tél: t.telephone,
      'Compte OHADA': t.compte_ohada, 'Total Débit': t.total_debit,
      'Total Crédit': t.total_credit, Solde: t.solde,
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `tiers-${year}.csv`; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement Tiers…
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Users size={22} className="text-[#2563EB]" />
            Comptes Tiers
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Clients, fournisseurs & partenaires · OHADA</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold hover:bg-[#1D4ED8]">
            <Plus size={13} /> Nouveau tiers
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Clients actifs',      value: kpis.clients,          isMoney: false, color: '#2563EB' },
          { label: 'Fournisseurs actifs',  value: kpis.fournis,          isMoney: false, color: '#D97706' },
          { label: 'Créances clients',     value: kpis.creancesClients,  isMoney: true,  color: '#16A34A' },
          { label: 'Dettes fournisseurs',  value: kpis.dettesPatrons,    isMoney: true,  color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[18px] font-extrabold" style={{ color: k.color }}>
              {k.isMoney ? fmtFCFA(k.value as number) : k.value}
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1">
          {TYPES.map(t => (
            <button key={t.id}
              onClick={() => setFilterType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                filterType === t.id
                  ? 'text-white border-transparent'
                  : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
              style={filterType === t.id ? { background: t.color } : {}}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, code, NIF…"
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 text-center">
          <Users size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8]">Aucun tiers trouvé</p>
          <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModal(true) }}
            className="mt-3 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold">
            + Créer un tiers
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(t => {
            const isExp = expanded === t.id
            const typeColor = TYPES.find(x => x.id === t.type)?.color || '#64748B'
            const label = t.raison_sociale || `${t.nom} ${t.prenom}`.trim()
            const soldeAbs = Math.abs(t.solde)
            const isDebiteur = t.solde >= 0

            return (
              <div key={t.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8FAFC]"
                  onClick={() => setExpanded(isExp ? null : t.id)}>
                  <span className="text-[#94A3B8] w-4">
                    {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  {/* Type badge */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                    style={{ background: typeColor + '15', color: typeColor }}>
                    {t.type}
                  </span>
                  {/* Code */}
                  <span className="font-mono text-[11px] font-bold text-[#64748B] w-16 shrink-0">{t.code || '—'}</span>
                  {/* Name */}
                  <span className="flex-1 text-[12px] font-semibold text-[#0F172A] truncate">{label}</span>
                  {/* Account */}
                  <span className="font-mono text-[11px] text-[#64748B] hidden sm:block">{t.compte_ohada}</span>
                  {/* Mouvements */}
                  <span className="text-[11px] text-[#64748B] w-24 text-right hidden md:block">
                    {t.movements.length} mvt{t.movements.length !== 1 ? 's' : ''}
                  </span>
                  {/* Solde */}
                  <span className="text-[12px] font-extrabold w-28 text-right"
                    style={{ color: isDebiteur ? '#2563EB' : '#DC2626' }}>
                    {fmtFCFA(soldeAbs)}
                  </span>
                  <span className="text-[9px] font-bold w-6 text-center"
                    style={{ color: isDebiteur ? '#2563EB' : '#DC2626' }}>
                    {isDebiteur ? 'D' : 'C'}
                  </span>
                  <button onClick={e => { e.stopPropagation(); openEdit(t) }}
                    className="text-[11px] px-2 py-0.5 bg-[#F1F5F9] rounded text-[#64748B] hover:bg-[#E2E8F0] shrink-0">
                    Éditer
                  </button>
                </div>

                {/* Expanded detail */}
                {isExp && (
                  <div className="border-t border-[#F1F5F9]">
                    {/* Info panel */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#F8FAFC]">
                      {[
                        { label: 'NIF',          value: t.nif || '—' },
                        { label: 'RCCM',         value: t.rccm || '—' },
                        { label: 'Email',         value: t.email || '—' },
                        { label: 'Tél',           value: t.telephone || '—' },
                        { label: 'Délai paiement', value: `${t.delai_paiement} j` },
                        { label: 'Plafond crédit', value: t.plafond_credit ? fmtFCFA(t.plafond_credit) : '—' },
                        { label: 'Total débit',   value: fmtFCFA(t.total_debit) },
                        { label: 'Total crédit',  value: fmtFCFA(t.total_credit) },
                      ].map(f => (
                        <div key={f.label}>
                          <div className="text-[9px] text-[#94A3B8] uppercase font-bold">{f.label}</div>
                          <div className="text-[11px] font-semibold text-[#0F172A] mt-0.5 truncate">{f.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Movements */}
                    {t.movements.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead className="bg-white border-b border-[#E2E8F0]">
                            <tr>
                              {['Date','Libellé','Débit','Crédit','Source'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {t.movements.sort((a, b) => a.date_operation.localeCompare(b.date_operation)).map(m => (
                              <tr key={m.id} className="border-t border-[#F8FAFC] hover:bg-[#F8FAFC]">
                                <td className="px-3 py-1.5 text-[#64748B]">
                                  {new Date(m.date_operation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                </td>
                                <td className="px-3 py-1.5 font-medium text-[#0F172A] max-w-[200px] truncate">{m.libelle}</td>
                                <td className="px-3 py-1.5 text-right font-bold text-[#2563EB]">
                                  {m.debit_account === t.compte_ohada ? fmtFCFA(m.montant) : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-right font-bold text-[#16A34A]">
                                  {m.credit_account === t.compte_ohada ? fmtFCFA(m.montant) : '—'}
                                </td>
                                <td className="px-3 py-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-[9px] font-semibold uppercase">
                                    {m.source || '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Nouveau/Édition tiers */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                {editId ? 'Modifier le tiers' : 'Nouveau tiers'}
              </h2>
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); setEditId(null) }}
                className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Type</label>
                <div className="flex gap-2">
                  {['client','fournisseur','partenaire'].map(tp => (
                    <button key={tp}
                      onClick={() => setForm(f => ({
                        ...f, type: tp as Tier['type'],
                        compte_ohada: TYPE_DEFAULT_ACCOUNT[tp],
                      }))}
                      className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                        form.type === tp
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : 'bg-white border-[#E2E8F0] text-[#64748B]'
                      }`}>
                      {tp.charAt(0).toUpperCase() + tp.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'code',          label: 'Code',          type: 'text', placeholder: 'CLI-001' },
                  { key: 'raison_sociale', label: 'Raison sociale', type: 'text', placeholder: 'ACME SARL' },
                  { key: 'nom',           label: 'Nom',           type: 'text', placeholder: 'Dupont' },
                  { key: 'prenom',        label: 'Prénom',        type: 'text', placeholder: 'Jean' },
                  { key: 'nif',           label: 'NIF',           type: 'text', placeholder: '00000000A' },
                  { key: 'rccm',          label: 'RCCM',          type: 'text', placeholder: 'BZV-A-2024' },
                  { key: 'email',         label: 'Email',         type: 'email', placeholder: 'contact@...' },
                  { key: 'telephone',     label: 'Téléphone',     type: 'tel', placeholder: '+242...' },
                  { key: 'compte_ohada',  label: 'Compte OHADA',  type: 'text', placeholder: '411000' },
                  { key: 'compte_auxiliaire', label: 'Compte auxiliaire', type: 'text', placeholder: '411CLI001' },
                  { key: 'plafond_credit', label: 'Plafond crédit (FCFA)', type: 'number', placeholder: '0' },
                  { key: 'delai_paiement', label: 'Délai paiement (j)',    type: 'number', placeholder: '30' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      value={(form as Record<string, unknown>)[f.key] as string || ''}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value
                      }))}
                      placeholder={f.placeholder}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                ))}
              </div>

              {/* Adresse */}
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Adresse</label>
                <textarea value={form.adresse || ''} rows={2}
                  onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-none" />
              </div>

              {/* Actif */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.actif ?? true}
                  onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                  className="rounded" />
                <span className="text-[12px] font-semibold text-[#0F172A]">Tiers actif</span>
              </label>
            </div>

            <div className="px-6 pb-5 flex justify-end gap-2">
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); setEditId(null) }}
                className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">
                Annuler
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
