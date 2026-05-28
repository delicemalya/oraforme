'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  RefreshCw, Plus, Search, Download, Check, X, Loader2, Eye,
  Calendar, AlertCircle, Clock, CheckCircle2, Ban,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Remboursement {
  id: string
  tenant_id: string
  date_demande: string
  date_remboursement: string | null
  libelle: string
  montant: number
  montant_rembourse: number
  motif: string
  type: 'client' | 'fournisseur' | 'salarie' | 'autre'
  tiers: string
  mode_paiement: string
  compte_id: string | null
  statut: 'demandé' | 'en_cours' | 'remboursé' | 'rejeté' | 'partiel'
  reference: string
  notes: string
  created_at: string
}

const STATUT_COLORS: Record<string, string> = {
  demandé:   'bg-blue-50 text-blue-700 border border-blue-200',
  en_cours:  'bg-amber-50 text-amber-700 border border-amber-200',
  remboursé: 'bg-green-50 text-green-700 border border-green-200',
  rejeté:    'bg-red-50 text-red-700 border border-red-200',
  partiel:   'bg-orange-50 text-orange-700 border border-orange-200',
}

const STATUT_ICONS: Record<string, React.ElementType> = {
  demandé:   Clock,
  en_cours:  RefreshCw,
  remboursé: CheckCircle2,
  rejeté:    Ban,
  partiel:   AlertCircle,
}

const TYPES_REMB = [
  { value: 'client',      label: 'Remboursement client',      debit: '411000', credit: '521000' },
  { value: 'fournisseur', label: 'Avoir fournisseur',          debit: '521000', credit: '401000' },
  { value: 'salarie',     label: 'Remboursement salarié',      debit: '421000', credit: '521000' },
  { value: 'autre',       label: 'Autre remboursement',        debit: '478000', credit: '521000' },
]

const EMPTY_FORM = {
  date_demande: new Date().toISOString().slice(0, 10),
  libelle: '',
  montant: '',
  motif: '',
  type: 'client',
  tiers: '',
  mode_paiement: 'virement',
  reference: '',
  notes: '',
}

export default function RemboursementsPage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : 'fr-FR'
  const [rows, setRows]           = useState<Remboursement[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [search, setSearch]       = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatut, setFilterStatut] = useState('all')
  const [selected, setSelected]   = useState<Remboursement | null>(null)
  const [remboursing, setRemboursing] = useState<string | null>(null)
  const [montantPartiel, setMontantPartiel] = useState('')

  const totalDemande   = rows.filter(r => r.statut !== 'rejeté').reduce((s, r) => s + r.montant, 0)
  const totalRembourse = rows.filter(r => r.statut === 'remboursé' || r.statut === 'partiel').reduce((s, r) => s + r.montant_rembourse, 0)
  const totalEnAttente = rows.filter(r => r.statut === 'demandé' || r.statut === 'en_cours').reduce((s, r) => s + r.montant, 0)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('remboursements')
        .select('*').eq('tenant_id', tenantId)
        .order('date_demande', { ascending: false }).limit(200)
      if (error?.code !== '42P01') setRows(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function saveDemande() {
    if (!tenantId || !form.montant || !form.libelle || !form.tiers) return
    setSaving(true)
    try {
      const { error } = await supabase.from('remboursements').insert({
        tenant_id: tenantId,
        date_demande: form.date_demande,
        libelle: form.libelle,
        montant: parseInt(form.montant),
        montant_rembourse: 0,
        motif: form.motif,
        type: form.type,
        tiers: form.tiers,
        mode_paiement: form.mode_paiement,
        reference: form.reference,
        notes: form.notes,
        statut: 'demandé',
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

  async function executeRemboursement(r: Remboursement, montant?: number) {
    if (!tenantId) return
    const montantEffectif = montant ?? r.montant
    const newMontantRembourse = r.montant_rembourse + montantEffectif
    const newStatut = newMontantRembourse >= r.montant ? 'remboursé' : 'partiel'
    const typeConfig = TYPES_REMB.find(t => t.value === r.type)

    try {
      await supabase.from('remboursements').update({
        statut: newStatut,
        montant_rembourse: newMontantRembourse,
        date_remboursement: new Date().toISOString().slice(0, 10),
      }).eq('id', r.id)

      await writeComptaEntry({
        tenantId,
        date: new Date().toISOString().slice(0, 10),
        libelle: `Remb. ${r.tiers} — ${r.libelle}`,
        type: 'depense',
        montant: montantEffectif,
        categorie: r.type,
        debitAccount: typeConfig?.debit ?? '478000',
        creditAccount: typeConfig?.credit ?? '521000',
        source: 'remboursement',
        sourceId: r.id,
      })

      setRemboursing(null)
      setMontantPartiel('')
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function rejeter(r: Remboursement) {
    if (!tenantId) return
    await supabase.from('remboursements').update({ statut: 'rejeté' }).eq('id', r.id)
    await load()
  }

  const filtered = rows.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false
    if (filterStatut !== 'all' && r.statut !== filterStatut) return false
    const q = search.toLowerCase()
    if (q && !r.libelle.toLowerCase().includes(q) && !r.tiers.toLowerCase().includes(q)) return false
    return true
  })

  function exportCSV() {
    const lines = ['Date,Libellé,Tiers,Type,Montant demandé,Montant remboursé,Statut']
    filtered.forEach(r => {
      lines.push([r.date_demande, `"${r.libelle}"`, `"${r.tiers}"`,
        TYPES_REMB.find(t => t.value === r.type)?.label ?? r.type,
        r.montant, r.montant_rembourse, r.statut].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `remboursements_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <RefreshCw size={20} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.rembours.title')}</h1>
            <p className="text-xs text-[#64748B]">{t('treso.rembours.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
            <Download size={14} /> Exporter
          </button>
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowModal(true) }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 rounded-xl hover:bg-orange-700 shadow-sm">
            <Plus size={14} /> {t('treso.rembours.new')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] mb-2">Total demandé</div>
          <div className="text-xl font-bold text-[#0F172A]">{fmtFCFA(totalDemande)}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] mb-2">En attente de remboursement</div>
          <div className="text-xl font-bold text-amber-600">{fmtFCFA(totalEnAttente)}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] mb-2">Remboursé</div>
          <div className="text-xl font-bold text-green-600">{fmtFCFA(totalRembourse)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('treso.rembours.searchPlh')}
            className="pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
          <option value="all">Tous types</option>
          {TYPES_REMB.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
          <option value="all">Tous statuts</option>
          {Object.keys(STATUT_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <span className="text-sm font-semibold">{filtered.length} demande{filtered.length > 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#0891B2]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
            <RefreshCw size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{t('treso.rembours.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {[t('treso.rembours.colDate'), t('treso.rembours.colBenef'), 'Type', t('treso.rembours.colMontant'), t('treso.rembours.colMotif'), t('treso.rembours.colStatut'), 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const StatusIcon = STATUT_ICONS[r.statut] ?? Clock
                  const pct = r.montant > 0 ? Math.round((r.montant_rembourse / r.montant) * 100) : 0
                  return (
                    <tr key={r.id} className={`border-t border-[#F1F5F9] hover:bg-[#F8FAFC] ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{new Date(r.date_demande).toLocaleDateString(intlLocale)}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-[#0F172A]">{r.libelle}</div>
                        <div className="text-[10px] text-[#94A3B8]">{r.tiers}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-lg font-medium">
                          {TYPES_REMB.find(t => t.value === r.type)?.label ?? r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold">{fmtFCFA(r.montant)}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-green-600">{fmtFCFA(r.montant_rembourse)}</div>
                        {r.montant > 0 && (
                          <div className="w-20 h-1.5 bg-[#E2E8F0] rounded-full mt-1">
                            <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${STATUT_COLORS[r.statut] ?? ''}`}>
                          <StatusIcon size={10} />
                          {r.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(r.statut === 'demandé' || r.statut === 'en_cours' || r.statut === 'partiel') && (
                            <>
                              <button onClick={() => executeRemboursement(r)}
                                className="px-2 py-1 text-[10px] font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                                {t('common.approve')}
                              </button>
                              <button onClick={() => rejeter(r)}
                                className="px-2 py-1 text-[10px] font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                                {t('common.reject')}
                              </button>
                            </>
                          )}
                          <button onClick={() => setSelected(r)} className="p-1 hover:bg-[#F1F5F9] rounded-lg">
                            <Eye size={13} className="text-[#94A3B8]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Détail remboursement</h3>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            {[
              ['Date demande', new Date(selected.date_demande).toLocaleDateString(intlLocale)],
              ['Libellé', selected.libelle],
              ['Tiers', selected.tiers],
              ['Type', TYPES_REMB.find(t => t.value === selected.type)?.label ?? selected.type],
              ['Montant demandé', fmtFCFA(selected.montant)],
              ['Montant remboursé', fmtFCFA(selected.montant_rembourse)],
              ['Mode de paiement', selected.mode_paiement],
              ['Motif', selected.motif || '—'],
              ['Référence', selected.reference || '—'],
              ['Statut', selected.statut],
              ['Notes', selected.notes || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-[#64748B]">{k}</span>
                <span className="text-[#0F172A] font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Nouvelle demande de remboursement</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Libellé *</label>
                <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Date demande</label>
                <input type="date" value={form.date_demande} onChange={e => setForm(f => ({ ...f, date_demande: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Montant (FCFA) *</label>
                <input type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  {TYPES_REMB.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Tiers *</label>
                <input value={form.tiers} onChange={e => setForm(f => ({ ...f, tiers: e.target.value }))}
                  placeholder="Nom du tiers"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Mode de paiement</label>
                <select value={form.mode_paiement} onChange={e => setForm(f => ({ ...f, mode_paiement: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  <option value="virement">Virement</option>
                  <option value="espece">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="mobile">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Référence</label>
                <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Motif</label>
                <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  rows={2} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2] resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={saveDemande} disabled={saving || !form.montant || !form.libelle || !form.tiers}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-orange-600 rounded-xl hover:bg-orange-700 disabled:opacity-50">
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
