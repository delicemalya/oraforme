'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  Receipt, Plus, Download, Check, X, Loader2,
  Building2, CheckCircle2, Circle, AlertTriangle,
  Calendar, RefreshCw, BarChart3,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompteBancaire { id: string; intitule: string; banque: string; solde: number; numero_compte: string }

interface ReligneLigne {
  id: string
  tenant_id: string
  compte_id: string
  compte_label?: string
  date_operation: string
  libelle: string
  debit: number
  credit: number
  rapproche: boolean
  reference: string
  created_at: string
}

export default function RapprochmentsPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : 'fr-FR'
  const [banques, setBanques]       = useState<CompteBancaire[]>([])
  const [selectedBanque, setSelectedBanque] = useState<CompteBancaire | null>(null)
  const [lignes, setLignes]         = useState<ReligneLigne[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [soldeReleve, setSoldeReleve] = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [addForm, setAddForm]       = useState({
    date_operation: new Date().toISOString().slice(0, 10),
    libelle: '',
    debit: '',
    credit: '',
    reference: '',
  })

  const lignesRapp    = lignes.filter(l => l.rapproche)
  const lignesNonRapp = lignes.filter(l => !l.rapproche)

  const totalDebits  = lignesRapp.reduce((s, l) => s + l.debit, 0)
  const totalCredits = lignesRapp.reduce((s, l) => s + l.credit, 0)
  const soldeCompta  = (selectedBanque?.solde ?? 0)
  const soldeRelX    = parseFloat(soldeReleve || '0')
  const ecart        = soldeRelX - soldeCompta
  const pctRappro    = lignes.length > 0 ? Math.round((lignesRapp.length / lignes.length) * 100) : 0

  const loadBanques = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase.from('comptes_bancaires')
      .select('id,intitule,banque,solde,numero_compte')
      .eq('tenant_id', tenantId).eq('actif', true)
    setBanques(data ?? [])
    if (data && data.length > 0 && !selectedBanque) setSelectedBanque(data[0])
    setLoading(false)
  }, [tenantId, selectedBanque])

  const loadLignes = useCallback(async () => {
    if (!tenantId || !selectedBanque) return
    const { data, error } = await supabase.from('rapprochements_bancaires')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('compte_id', selectedBanque.id)
      .order('date_operation', { ascending: false })
      .limit(200)
    if (error?.code !== '42P01') {
      setLignes((data ?? []).map((l: ReligneLigne) => ({ ...l, compte_label: selectedBanque.intitule })))
    }
  }, [tenantId, selectedBanque])

  useEffect(() => { loadBanques() }, [loadBanques])
  useEffect(() => { if (selectedBanque) loadLignes() }, [loadLignes, selectedBanque])

  async function toggleRapproche(ligne: ReligneLigne) {
    await supabase.from('rapprochements_bancaires')
      .update({ rapproche: !ligne.rapproche })
      .eq('id', ligne.id)
    setLignes(prev => prev.map(l => l.id === ligne.id ? { ...l, rapproche: !l.rapproche } : l))
  }

  async function addLigne() {
    if (!tenantId || !selectedBanque || (!addForm.debit && !addForm.credit)) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('rapprochements_bancaires').insert({
        tenant_id: tenantId,
        compte_id: selectedBanque.id,
        date_operation: addForm.date_operation,
        libelle: addForm.libelle,
        debit: parseFloat(addForm.debit || '0'),
        credit: parseFloat(addForm.credit || '0'),
        reference: addForm.reference,
        rapproche: false,
      }).select('*').single()
      if (!error && data) {
        setLignes(prev => [{ ...data, compte_label: selectedBanque.intitule }, ...prev])
        setAddForm({ date_operation: new Date().toISOString().slice(0, 10), libelle: '', debit: '', credit: '', reference: '' })
        setShowAdd(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function exportCSV() {
    const lines = ['Date,Libellé,Débit,Crédit,Rapproché,Référence']
    lignes.forEach(l => {
      lines.push([l.date_operation, `"${l.libelle}"`, l.debit, l.credit, l.rapproche ? 'OUI' : 'NON', l.reference].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `rapprochement_${selectedBanque?.intitule}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
            <Receipt size={20} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.rapproch.title')}</h1>
            <p className="text-xs text-[#64748B]">{t('treso.rapproch.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={!selectedBanque}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] disabled:opacity-40">
            <Download size={14} /> Exporter
          </button>
          <button onClick={() => setShowAdd(true)} disabled={!selectedBanque}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-sm disabled:opacity-40">
            <Plus size={14} /> {t('treso.rapproch.import')}
          </button>
        </div>
      </div>

      {/* Bank selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          <div className="col-span-4 flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-[#0891B2]" /></div>
        ) : banques.length === 0 ? (
          <div className="col-span-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-xs text-amber-700">
            Aucun compte bancaire actif. Créez d'abord un compte dans l'onglet Banques.
          </div>
        ) : banques.map(b => (
          <button key={b.id} onClick={() => setSelectedBanque(b)}
            className={`bg-white border rounded-2xl p-4 text-left transition-all ${
              selectedBanque?.id === b.id ? 'border-[#0891B2] ring-1 ring-[#0891B2] bg-cyan-50' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
            }`}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={14} className="text-[#0891B2]" />
              <span className="text-[10px] font-semibold text-[#64748B]">{b.banque}</span>
            </div>
            <div className="text-xs font-bold text-[#0F172A]">{b.intitule}</div>
            <div className="text-sm font-bold text-[#0891B2] mt-1">{fmtFCFA(b.solde)}</div>
          </button>
        ))}
      </div>

      {selectedBanque && (
        <>
          {/* Reconciliation summary */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">État du rapprochement — {selectedBanque.intitule}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-xs text-[#64748B] mb-1">{t('treso.rapproch.soldeCompta')}</div>
                <div className="text-lg font-bold text-[#0F172A]">{fmtFCFA(soldeCompta)}</div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] mb-1">{t('treso.rapproch.soldeBanque')}</div>
                <input
                  type="number"
                  value={soldeReleve}
                  onChange={e => setSoldeReleve(e.target.value)}
                  placeholder="Saisir solde relevé"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0891B2]"
                />
              </div>
              <div>
                <div className="text-xs text-[#64748B] mb-1">{t('treso.rapproch.ecart')}</div>
                <div className={`text-lg font-bold ${Math.abs(ecart) < 100 ? 'text-green-600' : 'text-red-600'}`}>
                  {ecart >= 0 ? '+' : ''}{fmtFCFA(ecart)}
                </div>
                {Math.abs(ecart) < 100 && soldeReleve && (
                  <div className="flex items-center gap-1 text-[10px] text-green-600 mt-1">
                    <CheckCircle2 size={10} /> Rapproché
                  </div>
                )}
                {Math.abs(ecart) >= 100 && soldeReleve && (
                  <div className="flex items-center gap-1 text-[10px] text-red-600 mt-1">
                    <AlertTriangle size={10} /> Écart significatif
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-[#64748B] mb-1">Progression</div>
                <div className="text-lg font-bold text-[#0891B2]">{pctRappro}%</div>
                <div className="w-full h-2 bg-[#E2E8F0] rounded-full mt-1">
                  <div className="h-2 bg-[#0891B2] rounded-full transition-all" style={{ width: `${pctRappro}%` }} />
                </div>
                <div className="text-[10px] text-[#94A3B8] mt-0.5">{lignesRapp.length}/{lignes.length} lignes</div>
              </div>
            </div>
          </div>

          {/* Non-rapproché section */}
          {lignesNonRapp.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
                <Circle size={14} className="text-amber-500" />
                <span className="text-sm font-semibold text-[#0F172A]">{lignesNonRapp.length} ligne{lignesNonRapp.length > 1 ? 's' : ''} à rapprocher</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#FFFBEB]">
                    <tr>
                      {['', 'Date', 'Libellé', 'Débit', 'Crédit', 'Référence'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignesNonRapp.map((l, i) => (
                      <tr key={l.id} className={`border-t border-[#F1F5F9] hover:bg-[#FFFBEB] ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleRapproche(l)}
                            className="w-5 h-5 rounded-full border-2 border-amber-300 hover:border-[#0891B2] hover:bg-cyan-50 transition-colors flex items-center justify-center">
                            <Circle size={10} className="text-amber-300" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">{new Date(l.date_operation).toLocaleDateString(intlLocale)}</td>
                        <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">{l.libelle}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-red-600">{l.debit > 0 ? fmtFCFA(l.debit) : '—'}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-green-600">{l.credit > 0 ? fmtFCFA(l.credit) : '—'}</td>
                        <td className="px-4 py-3 text-[10px] text-[#94A3B8]">{l.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rapproché section */}
          {lignesRapp.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-sm font-semibold text-[#0F172A]">{lignesRapp.length} ligne{lignesRapp.length > 1 ? 's' : ''} rapprochée{lignesRapp.length > 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F0FDF4]">
                    <tr>
                      {['', 'Date', 'Libellé', 'Débit', 'Crédit', 'Référence'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignesRapp.map((l, i) => (
                      <tr key={l.id} className={`border-t border-[#F1F5F9] hover:bg-[#F0FDF4] opacity-75 ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleRapproche(l)}
                            className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors">
                            <Check size={10} className="text-white" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">{new Date(l.date_operation).toLocaleDateString(intlLocale)}</td>
                        <td className="px-4 py-3 text-xs font-medium text-[#0F172A] line-through opacity-60">{l.libelle}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-red-400">{l.debit > 0 ? fmtFCFA(l.debit) : '—'}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-green-400">{l.credit > 0 ? fmtFCFA(l.credit) : '—'}</td>
                        <td className="px-4 py-3 text-[10px] text-[#94A3B8]">{l.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F0FDF4] border-t border-[#E2E8F0]">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-xs font-bold text-[#0F172A]">Totaux rapprochés</td>
                      <td className="px-4 py-2 text-xs font-bold text-red-600">{fmtFCFA(totalDebits)}</td>
                      <td className="px-4 py-2 text-xs font-bold text-green-600">{fmtFCFA(totalCredits)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add line modal */}
      {showAdd && selectedBanque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Ajouter une ligne de relevé</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            <div className="text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl px-3 py-2">
              Compte: <strong>{selectedBanque.intitule}</strong> — {selectedBanque.banque}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">{t('common.date')}</label>
                <input type="date" value={addForm.date_operation}
                  onChange={e => setAddForm(f => ({ ...f, date_operation: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">{t('common.reference')}</label>
                <input value={addForm.reference}
                  onChange={e => setAddForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Libellé *</label>
                <input value={addForm.libelle}
                  onChange={e => setAddForm(f => ({ ...f, libelle: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Débit (sortie)</label>
                <input type="number" value={addForm.debit}
                  onChange={e => setAddForm(f => ({ ...f, debit: e.target.value, credit: '' }))}
                  placeholder="0"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Crédit (entrée)</label>
                <input type="number" value={addForm.credit}
                  onChange={e => setAddForm(f => ({ ...f, credit: e.target.value, debit: '' }))}
                  placeholder="0"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={addLigne} disabled={saving || !addForm.libelle || (!addForm.debit && !addForm.credit)}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
