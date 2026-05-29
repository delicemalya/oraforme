'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  TrendingUp, Plus, Download, Check, X, Loader2, Eye,
  ArrowUpCircle, ArrowDownCircle, Calendar, BarChart3,
  ChevronUp, ChevronDown, AlertTriangle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Prevision {
  id: string
  tenant_id: string
  periode: string         // YYYY-MM
  type: 'entree' | 'sortie'
  categorie: string
  libelle: string
  montant_prevu: number
  montant_reel: number
  statut: 'planifié' | 'partiel' | 'réalisé' | 'dépassé' | 'annulé'
  probabilite: number    // 0-100
  notes: string
  created_at: string
}

const CATEGORIES_ENTREE = ['Ventes', 'Prestations', 'Subventions', 'Remboursements reçus', 'Autres entrées']
const CATEGORIES_SORTIE = ['Salaires', 'Loyer', 'Fournisseurs', 'Impôts/Taxes', 'Assurances', 'Investissements', 'Frais généraux', 'Emprunts', 'Autres sorties']

const STATUT_COLORS: Record<string, string> = {
  planifié:  'bg-blue-50 text-blue-700',
  partiel:   'bg-amber-50 text-amber-700',
  réalisé:   'bg-green-50 text-green-700',
  dépassé:   'bg-red-50 text-red-700',
  annulé:    'bg-slate-50 text-slate-500',
}

function getPeriodes(): string[] {
  const periods: string[] = []
  const now = new Date()
  for (let i = -1; i <= 11; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return periods
}

const CURRENT_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

const EMPTY_FORM = {
  periode: CURRENT_MONTH,
  type: 'sortie' as 'entree' | 'sortie',
  categorie: 'Fournisseurs',
  libelle: '',
  montant_prevu: '',
  probabilite: '80',
  notes: '',
}

export default function PrevisionsPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [rows, setRows]           = useState<Prevision[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [selectedPeriode, setSelectedPeriode] = useState(CURRENT_MONTH)
  const [filterType, setFilterType] = useState<'all' | 'entree' | 'sortie'>('all')
  const [actuals, setActuals]     = useState<{ entrees: number; sorties: number }>({ entrees: 0, sorties: 0 })

  const periodes = getPeriodes()

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('previsions_tresorerie')
        .select('*').eq('tenant_id', tenantId)
        .order('periode', { ascending: true }).limit(500)
      if (error?.code !== '42P01') setRows(data ?? [])

      // Load actuals for selected period
      const from = `${selectedPeriode}-01`
      const nextM = new Date(selectedPeriode + '-01')
      nextM.setMonth(nextM.getMonth() + 1)
      const to = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}-01`

      const { data: txs } = await supabase.from('transactions')
        .select('type, montant')
        .eq('tenant_id', tenantId)
        .gte('date', from).lt('date', to).limit(200)

      const entrees = (txs ?? []).filter(t => t.type === 'entree').reduce((s: number, t: { montant: number }) => s + t.montant, 0)
      const sorties = (txs ?? []).filter(t => t.type === 'sortie').reduce((s: number, t: { montant: number }) => s + t.montant, 0)
      setActuals({ entrees, sorties })
    } finally {
      setLoading(false)
    }
  }, [tenantId, selectedPeriode])

  useEffect(() => { load() }, [load])

  async function savePrevision() {
    if (!tenantId || !form.montant_prevu || !form.libelle) return
    setSaving(true)
    try {
      const { error } = await supabase.from('previsions_tresorerie').insert({
        tenant_id: tenantId,
        periode: form.periode,
        type: form.type,
        categorie: form.categorie,
        libelle: form.libelle,
        montant_prevu: parseInt(form.montant_prevu),
        montant_reel: 0,
        probabilite: parseInt(form.probabilite),
        statut: 'planifié',
        notes: form.notes,
      })
      if (error) throw error
      setForm({ ...EMPTY_FORM })
      setShowModal(false)
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  // Filter by selected period and type
  const periodRows = rows.filter(r => r.periode === selectedPeriode && (filterType === 'all' || r.type === filterType))
  const totalPrevuEntrees = rows.filter(r => r.periode === selectedPeriode && r.type === 'entree').reduce((s, r) => s + r.montant_prevu, 0)
  const totalPrevuSorties = rows.filter(r => r.periode === selectedPeriode && r.type === 'sortie').reduce((s, r) => s + r.montant_prevu, 0)
  const cashflowPrevu = totalPrevuEntrees - totalPrevuSorties
  const cashflowReel  = actuals.entrees - actuals.sorties
  const ecart = cashflowReel - cashflowPrevu

  // Monthly chart data (6 months)
  const monthlyData = periodes.slice(0, 6).map(p => {
    const entrees = rows.filter(r => r.periode === p && r.type === 'entree').reduce((s, r) => s + r.montant_prevu, 0)
    const sorties = rows.filter(r => r.periode === p && r.type === 'sortie').reduce((s, r) => s + r.montant_prevu, 0)
    return { periode: p, entrees, sorties, cashflow: entrees - sorties }
  })
  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.entrees, d.sorties)), 1)

  function exportCSV() {
    const lines = ['Période,Type,Catégorie,Libellé,Montant prévu,Probabilité,Statut']
    periodRows.forEach(r => {
      lines.push([r.periode, r.type, r.categorie, `"${r.libelle}"`, r.montant_prevu, r.probabilite + '%', r.statut].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `previsions_${selectedPeriode}.csv`
    a.click()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
            <TrendingUp size={20} className="text-cyan-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.previsions.title')}</h1>
            <p className="text-xs text-[#64748B]">{t('treso.previsions.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
            <Download size={14} /> Exporter
          </button>
          <button onClick={() => { setForm({ ...EMPTY_FORM, periode: selectedPeriode }); setShowModal(true) }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0891B2] rounded-xl hover:bg-[#0E7490] shadow-sm">
            <Plus size={14} /> {t('treso.previsions.generate')}
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
        <div className="flex gap-1 overflow-x-auto">
          {periodes.map(p => {
            const [y, m] = p.split('-')
            const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
            const hasPrev = rows.some(r => r.periode === p)
            return (
              <button key={p} onClick={() => setSelectedPeriode(p)}
                className={`flex flex-col items-center px-3 py-2 rounded-xl text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all ${
                  p === selectedPeriode ? 'bg-[#0891B2] text-white shadow-sm' :
                  p === CURRENT_MONTH ? 'bg-cyan-50 text-cyan-700' :
                  'text-[#64748B] hover:bg-[#F1F5F9]'
                }`}>
                {label}
                {hasPrev && <div className={`w-1 h-1 rounded-full mt-0.5 ${p === selectedPeriode ? 'bg-white' : 'bg-[#0891B2]'}`} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPIs for selected period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle size={14} className="text-green-500" />
            <span className="text-xs text-[#64748B]">{t('treso.previsions.kpi.entrees')}</span>
          </div>
          <div className="text-lg font-bold text-green-600">{fmtFCFA(totalPrevuEntrees)}</div>
          <div className="text-[10px] text-[#94A3B8] mt-1">Réel: {fmtFCFA(actuals.entrees)}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle size={14} className="text-red-500" />
            <span className="text-xs text-[#64748B]">{t('treso.previsions.kpi.sorties')}</span>
          </div>
          <div className="text-lg font-bold text-red-600">{fmtFCFA(totalPrevuSorties)}</div>
          <div className="text-[10px] text-[#94A3B8] mt-1">Réel: {fmtFCFA(actuals.sorties)}</div>
        </div>
        <div className={`bg-white border rounded-2xl p-4 ${cashflowPrevu >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className={cashflowPrevu >= 0 ? 'text-green-500' : 'text-red-500'} />
            <span className="text-xs text-[#64748B]">{t('treso.previsions.kpi.solde')}</span>
          </div>
          <div className={`text-lg font-bold ${cashflowPrevu >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {cashflowPrevu >= 0 ? '+' : ''}{fmtFCFA(cashflowPrevu)}
          </div>
        </div>
        <div className={`bg-white border rounded-2xl p-4 ${ecart >= 0 ? 'border-green-200' : 'border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {ecart >= 0 ? <ChevronUp size={14} className="text-green-500" /> : <ChevronDown size={14} className="text-amber-500" />}
            <span className="text-xs text-[#64748B]">Écart réel vs prévu</span>
          </div>
          <div className={`text-lg font-bold ${ecart >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
            {ecart >= 0 ? '+' : ''}{fmtFCFA(ecart)}
          </div>
        </div>
      </div>

      {/* Monthly chart */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#0F172A]">Cashflow prévisionnel — 6 mois</h3>
          <div className="flex items-center gap-4 text-[10px]">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span>Entrées</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span>Sorties</span></div>
          </div>
        </div>
        <div className="flex items-end gap-3 h-32">
          {monthlyData.map(d => {
            const [y, m] = d.periode.split('-')
            const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })
            const eH = Math.round((d.entrees / maxVal) * 100)
            const sH = Math.round((d.sorties / maxVal) * 100)
            return (
              <div key={d.periode} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-0.5 h-24 w-full">
                  <div className="flex-1 bg-green-400 rounded-t-sm opacity-80" style={{ height: `${eH}%` }} />
                  <div className="flex-1 bg-red-400 rounded-t-sm opacity-80" style={{ height: `${sH}%` }} />
                </div>
                <span className={`text-[9px] font-medium ${d.periode === selectedPeriode ? 'text-[#0891B2]' : 'text-[#94A3B8]'}`}>{label}</span>
                <span className={`text-[8px] font-bold ${d.cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {d.cashflow >= 0 ? '+' : ''}{(d.cashflow / 1000).toFixed(0)}k
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[{ value: 'all', label: 'Tout' }, { value: 'entree', label: '↑ Entrées' }, { value: 'sortie', label: '↓ Sorties' }].map(f => (
          <button key={f.value} onClick={() => setFilterType(f.value as 'all' | 'entree' | 'sortie')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              filterType === f.value ? 'bg-[#0891B2] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <span className="text-sm font-semibold">{periodRows.length} prévision{periodRows.length > 1 ? 's' : ''} — {selectedPeriode}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-[#0891B2]" /></div>
        ) : periodRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#94A3B8]">
            <TrendingUp size={28} className="mb-2 opacity-30" />
            <p className="text-sm">{t('treso.previsions.noData')}</p>
            <button onClick={() => { setForm({ ...EMPTY_FORM, periode: selectedPeriode }); setShowModal(true) }}
              className="mt-2 text-xs text-[#0891B2] hover:underline">Ajouter une prévision</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['Type', 'Catégorie', 'Libellé', 'Montant prévu', 'Proba.', 'Statut'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodRows.map((r, i) => (
                  <tr key={r.id} className={`border-t border-[#F1F5F9] hover:bg-[#F8FAFC] ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                        r.type === 'entree' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {r.type === 'entree' ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{r.categorie}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-[#0F172A]">{r.libelle}</div>
                      {r.notes && <div className="text-[10px] text-[#94A3B8]">{r.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${r.type === 'entree' ? 'text-green-600' : 'text-red-600'}`}>
                        {r.type === 'entree' ? '+' : '-'}{fmtFCFA(r.montant_prevu)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-[#E2E8F0] rounded-full">
                          <div className="h-1.5 bg-[#0891B2] rounded-full" style={{ width: `${r.probabilite}%` }} />
                        </div>
                        <span className="text-[10px] text-[#64748B]">{r.probabilite}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold ${STATUT_COLORS[r.statut] ?? ''}`}>
                        {r.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-xs font-bold text-[#0F172A]">Total période</td>
                  <td className="px-4 py-2">
                    <div className="text-xs font-bold text-green-600">+{fmtFCFA(totalPrevuEntrees)}</div>
                    <div className="text-xs font-bold text-red-600">-{fmtFCFA(totalPrevuSorties)}</div>
                  </td>
                  <td colSpan={2} className="px-4 py-2">
                    <span className={`text-sm font-bold ${cashflowPrevu >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Net: {cashflowPrevu >= 0 ? '+' : ''}{fmtFCFA(cashflowPrevu)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Ajouter une prévision</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Période</label>
                <select value={form.periode} onChange={e => setForm(f => ({ ...f, periode: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  {periodes.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({
                  ...f, type: e.target.value as 'entree' | 'sortie',
                  categorie: e.target.value === 'entree' ? CATEGORIES_ENTREE[0] : CATEGORIES_SORTIE[0]
                }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  <option value="entree">Entrée</option>
                  <option value="sortie">Sortie</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Catégorie</label>
                <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  {(form.type === 'entree' ? CATEGORIES_ENTREE : CATEGORIES_SORTIE).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Montant prévu (FCFA) *</label>
                <input type="number" value={form.montant_prevu} onChange={e => setForm(f => ({ ...f, montant_prevu: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Libellé *</label>
                <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Probabilité (%)</label>
                <input type="range" min="0" max="100" value={form.probabilite}
                  onChange={e => setForm(f => ({ ...f, probabilite: e.target.value }))}
                  className="w-full" />
                <div className="text-xs text-center text-[#0891B2] font-semibold">{form.probabilite}%</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={savePrevision} disabled={saving || !form.montant_prevu || !form.libelle}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#0891B2] rounded-xl hover:bg-[#0E7490] disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
