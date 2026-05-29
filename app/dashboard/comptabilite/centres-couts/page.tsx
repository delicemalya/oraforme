'use client'

/**
 * Centres de Coûts OHADA
 * Analytique par département/projet — Charges et Produits ventilés
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import { Layers, Plus, Download, ChevronDown, ChevronRight, X, Save } from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

interface CentreCout {
  id: string; tenant_id: string
  code: string; libelle: string; type: 'departement' | 'projet' | 'activite' | 'autre'
  responsable: string; budget: number; actif: boolean; description: string
}

interface Movement {
  id: string; date_operation: string; libelle: string
  debit_account: string; credit_account: string; montant: number
  centre_cout: string; source: string
}

const TYPES = [
  { id: 'departement', label: 'Département', color: '#2563EB' },
  { id: 'projet',      label: 'Projet',      color: '#16A34A' },
  { id: 'activite',    label: 'Activité',    color: '#8B5CF6' },
  { id: 'autre',       label: 'Autre',       color: '#D97706' },
]

const EMPTY_FORM: Partial<CentreCout> = {
  type: 'departement', budget: 0, actif: true, code: '', libelle: '', responsable: '', description: '',
}

const YEARS = [2024, 2025, 2026, 2027]

export default function CentresCoutsPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [centres, setCentres]   = useState<CentreCout[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading]   = useState(true)
  const [year, setYear]         = useState(new Date().getFullYear())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState<Partial<CentreCout>>(EMPTY_FORM)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [ccR, mvR] = await Promise.all([
        supabase.from('centres_couts').select('*').eq('tenant_id', tenantId).order('code').limit(200),
        supabase.from('journal_entries')
          .select('id, date_operation, libelle, debit_account, credit_account, montant, centre_cout, source')
          .eq('tenant_id', tenantId)
          .eq('fiscal_year', year).limit(200),
      ])
      if (ccR.error?.code !== '42P01') setCentres((ccR.data || []) as CentreCout[])
      setMovements((mvR.data || []) as Movement[])
      setLoading(false)
    })()
  }, [tenantId, year])

  /* Attach analytics to each centre */
  const centresWithData = useMemo(() => {
    return centres.map(c => {
      const mvs = movements.filter(m => m.centre_cout === c.code)
      const charges  = mvs.filter(m => m.debit_account?.startsWith('6')).reduce((s, m) => s + m.montant, 0)
      const produits = mvs.filter(m => m.credit_account?.startsWith('7')).reduce((s, m) => s + m.montant, 0)
      const resultat = produits - charges
      const consomme = c.budget > 0 ? (charges / c.budget) * 100 : 0
      return { ...c, charges, produits, resultat, consomme, nb_mvts: mvs.length, movements: mvs }
    })
  }, [centres, movements])

  /* Movements without centre */
  const mvsSansCentre = useMemo(() => {
    return movements.filter(m => !m.centre_cout || !centres.find(c => c.code === m.centre_cout))
  }, [movements, centres])

  /* KPIs */
  const kpis = useMemo(() => ({
    nb:         centres.filter(c => c.actif).length,
    budgetTotal: centres.reduce((s, c) => s + c.budget, 0),
    chargesTotal: centresWithData.reduce((s, c) => s + c.charges, 0),
    produitsTotal: centresWithData.reduce((s, c) => s + c.produits, 0),
  }), [centres, centresWithData])

  async function save() {
    if (!tenantId || !form.libelle) return
    setSaving(true)
    const payload = { ...form, tenant_id: tenantId }
    if (editId) {
      await supabase.from('centres_couts').update(payload).eq('id', editId).eq('tenant_id', tenantId)
    } else {
      await supabase.from('centres_couts').insert(payload)
    }
    setSaving(false); setModal(false); setForm(EMPTY_FORM); setEditId(null)
    const { data } = await supabase.from('centres_couts').select('*').eq('tenant_id', tenantId).order('code').limit(200)
    setCentres((data || []) as CentreCout[])
  }

  function exportCSV() {
    const rows = centresWithData.map(c => ({
      Code: c.code, Libellé: c.libelle, Type: c.type, Responsable: c.responsable,
      Budget: c.budget, Charges: c.charges, Produits: c.produits, Résultat: c.resultat,
      'Consommé (%)': c.consomme.toFixed(1),
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `centres-couts-${year}.csv`; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      {t('common.loading')}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Layers size={22} className="text-[#2563EB]" />
            {t('compta.cc.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">{t('compta.cc.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> {t('common.export')} CSV
          </button>
          <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold">
            <Plus size={13} /> {t('compta.cc.newCenter')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Centres actifs',  value: kpis.nb,            isMoney: false, color: '#2563EB' },
          { label: 'Budget total',    value: kpis.budgetTotal,   isMoney: true,  color: '#8B5CF6' },
          { label: 'Charges totales', value: kpis.chargesTotal,  isMoney: true,  color: '#DC2626' },
          { label: 'Produits totaux', value: kpis.produitsTotal, isMoney: true,  color: '#16A34A' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[18px] font-extrabold" style={{ color: k.color }}>
              {k.isMoney ? fmtFCFA(k.value as number) : k.value}
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Centres list */}
      {centresWithData.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 text-center">
          <Layers size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8]">{t('compta.cc.empty')}</p>
          <button onClick={() => { setForm(EMPTY_FORM); setModal(true) }}
            className="mt-3 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold">
            + Créer un centre de coût
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {centresWithData.map(c => {
            const isExp   = expanded === c.id
            const typeInfo = TYPES.find(t => t.id === c.type) || TYPES[3]
            const isOver  = c.budget > 0 && c.consomme > 100
            return (
              <div key={c.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8FAFC]"
                  onClick={() => setExpanded(isExp ? null : c.id)}>
                  <span className="text-[#94A3B8] w-4">
                    {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: typeInfo.color + '15', color: typeInfo.color }}>
                    {typeInfo.label}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#64748B] w-20 shrink-0">{c.code}</span>
                  <span className="flex-1 text-[12px] font-semibold text-[#0F172A] truncate">{c.libelle}</span>
                  {c.responsable && (
                    <span className="text-[11px] text-[#94A3B8] hidden sm:block">{c.responsable}</span>
                  )}
                  <span className="text-[11px] text-[#DC2626] font-bold w-28 text-right hidden md:block">{fmtFCFA(c.charges)}</span>
                  <span className={`text-[12px] font-extrabold w-28 text-right ${c.resultat >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    {fmtFCFA(Math.abs(c.resultat))}
                  </span>
                  <button onClick={e => { e.stopPropagation(); setForm(c); setEditId(c.id); setModal(true) }}
                    className="text-[11px] px-2 py-0.5 bg-[#F1F5F9] rounded text-[#64748B] hover:bg-[#E2E8F0] shrink-0">
                    Éditer
                  </button>
                </div>

                {/* Budget progress */}
                {c.budget > 0 && (
                  <div className="px-4 pb-2">
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(c.consomme, 100)}%`, background: isOver ? '#DC2626' : '#2563EB' }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] text-[#94A3B8]">Budget consommé: {c.consomme.toFixed(1)}%</span>
                      <span className="text-[9px] text-[#94A3B8]">{fmtFCFA(c.charges)} / {fmtFCFA(c.budget)}</span>
                    </div>
                  </div>
                )}

                {/* Movements detail */}
                {isExp && (
                  <div className="border-t border-[#F1F5F9]">
                    <div className="grid grid-cols-3 gap-3 p-4 bg-[#F8FAFC]">
                      {[
                        { label: 'Charges',    value: fmtFCFA(c.charges),  color: '#DC2626' },
                        { label: 'Produits',   value: fmtFCFA(c.produits), color: '#16A34A' },
                        { label: 'Résultat',   value: fmtFCFA(Math.abs(c.resultat)), color: c.resultat >= 0 ? '#16A34A' : '#DC2626' },
                      ].map(f => (
                        <div key={f.label} className="text-center">
                          <div className="text-[14px] font-extrabold" style={{ color: f.color }}>{f.value}</div>
                          <div className="text-[10px] text-[#94A3B8]">{f.label}</div>
                        </div>
                      ))}
                    </div>
                    {c.movements.length > 0 && (
                      <div className="overflow-x-auto max-h-48">
                        <table className="w-full text-[11px]">
                          <thead className="bg-white border-b border-[#E2E8F0] sticky top-0">
                            <tr>
                              {['Date','Libellé','Débit','Crédit','Source'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {c.movements.map(m => (
                              <tr key={m.id} className="border-t border-[#F8FAFC] hover:bg-[#F8FAFC]">
                                <td className="px-3 py-1.5 text-[#64748B]">
                                  {new Date(m.date_operation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                </td>
                                <td className="px-3 py-1.5 font-medium text-[#0F172A] max-w-[180px] truncate">{m.libelle}</td>
                                <td className="px-3 py-1.5 text-right text-[#2563EB] font-bold">
                                  {m.debit_account?.startsWith('6') ? fmtFCFA(m.montant) : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-right text-[#16A34A] font-bold">
                                  {m.credit_account?.startsWith('7') ? fmtFCFA(m.montant) : '—'}
                                </td>
                                <td className="px-3 py-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-[9px] font-semibold">{m.source || '—'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {c.movements.length === 0 && (
                      <div className="text-center py-8 text-[#94A3B8] text-[12px]">
                        Aucun mouvement sur ce centre pour l'exercice {year}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Mouvements non affectés */}
      {mvsSansCentre.length > 0 && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4">
          <p className="text-[12px] font-bold text-[#D97706]">
            ⚠ {mvsSansCentre.length} mouvement{mvsSansCentre.length > 1 ? 's' : ''} non affecté{mvsSansCentre.length > 1 ? 's' : ''} à un centre de coût
          </p>
          <p className="text-[11px] text-[#D97706] mt-0.5">
            Ajoutez le champ <code className="bg-[#FEF9F0] px-1 rounded">centre_cout</code> dans vos écritures comptables pour un suivi analytique complet.
          </p>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#0F172A]">
                {editId ? 'Modifier le centre' : 'Nouveau centre de coût'}
              </h2>
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); setEditId(null) }}
                className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              {/* Type */}
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Type</label>
                <div className="flex gap-2">
                  {TYPES.map(t => (
                    <button key={t.id}
                      onClick={() => setForm(f => ({ ...f, type: t.id as CentreCout['type'] }))}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                      style={form.type === t.id
                        ? { background: t.color, color: 'white', borderColor: t.color }
                        : { background: 'white', borderColor: '#E2E8F0', color: '#64748B' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'code',        label: 'Code',        type: 'text',   placeholder: 'DIR-001' },
                  { key: 'libelle',     label: 'Libellé *',   type: 'text',   placeholder: 'Direction Générale' },
                  { key: 'responsable', label: 'Responsable', type: 'text',   placeholder: 'Jean Dupont' },
                  { key: 'budget',      label: 'Budget (FCFA)', type: 'number', placeholder: '0' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                    <input type={f.type}
                      value={(form as Record<string, unknown>)[f.key] as string || ''}
                      onChange={e => setForm(prev => ({
                        ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                      }))}
                      placeholder={f.placeholder}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Description</label>
                <textarea rows={2} value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.actif ?? true}
                  onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))} className="rounded" />
                <span className="text-[12px] font-semibold text-[#0F172A]">Centre actif</span>
              </label>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); setEditId(null) }}
                className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
