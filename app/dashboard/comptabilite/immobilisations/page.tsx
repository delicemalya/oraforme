'use client'

/**
 * Immobilisations & Amortissements OHADA
 * Suivi des actifs fixes, dotations annuelles, valeurs nettes
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import { Building2, Plus, Download, ChevronDown, ChevronRight, X, Save, AlertTriangle } from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

interface Immobilisation {
  id: string; tenant_id: string
  libelle: string; reference: string; categorie: string
  compte_ohada: string; compte_amort: string
  valeur_acquisition: number; date_acquisition: string
  duree_amort: number; methode_amort: 'lineaire' | 'degressif'
  valeur_residuelle: number; statut: 'actif' | 'cede' | 'reforme'
  fournisseur: string; notes: string
}

interface Amortissement {
  id: string; immobilisation_id: string; exercice: number
  dotation: number; cumul_amort: number; valeur_nette: number
}

const CATEGORIES = [
  { id: 'terrain',        label: 'Terrains',              compte: '221000', compte_amort: '' },
  { id: 'construction',   label: 'Constructions',         compte: '231000', compte_amort: '281300' },
  { id: 'materiel',       label: 'Matériel industriel',   compte: '241000', compte_amort: '284100' },
  { id: 'transport',      label: 'Matériel de transport', compte: '243000', compte_amort: '284300' },
  { id: 'informatique',   label: 'Matériel informatique', compte: '244000', compte_amort: '284400' },
  { id: 'mobilier',       label: 'Mobilier de bureau',    compte: '245000', compte_amort: '284500' },
  { id: 'logiciel',       label: 'Logiciels',             compte: '212000', compte_amort: '282100' },
  { id: 'autre',          label: 'Autres immobilisations', compte: '249000', compte_amort: '284900' },
]

const EMPTY_FORM: Partial<Immobilisation> = {
  categorie: 'materiel', methode_amort: 'lineaire', duree_amort: 5,
  valeur_residuelle: 0, statut: 'actif',
}

export default function ImmobilisationsPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [immobs, setImmobs]     = useState<Immobilisation[]>([])
  const [amorts, setAmorts]     = useState<Amortissement[]>([])
  const [loading, setLoading]   = useState(true)
  const [filterCat, setFilterCat] = useState('all')
  const [filterStat, setFilterStat] = useState('actif')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState<Partial<Immobilisation>>(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const currentYear             = new Date().getFullYear()

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [iR, aR] = await Promise.all([
        supabase.from('immobilisations').select('*').eq('tenant_id', tenantId).order('date_acquisition', { ascending: false }),
        supabase.from('amortissements').select('*').eq('tenant_id', tenantId),
      ])
      if (iR.error?.code !== '42P01') setImmobs((iR.data || []) as Immobilisation[])
      if (aR.error?.code !== '42P01') setAmorts((aR.data || []) as Amortissement[])
      setLoading(false)
    })()
  }, [tenantId])

  /* Compute plan amortissement for each immo */
  const immobsWithAmort = useMemo(() => {
    return immobs.map(imm => {
      const base        = imm.valeur_acquisition - imm.valeur_residuelle
      const dotation    = imm.methode_amort === 'lineaire' && imm.duree_amort > 0
        ? base / imm.duree_amort : 0
      const cumul       = amorts
        .filter(a => a.immobilisation_id === imm.id)
        .reduce((s, a) => s + a.dotation, 0)
      const valeur_nette = imm.valeur_acquisition - cumul
      const annees_restantes = imm.duree_amort - amorts.filter(a => a.immobilisation_id === imm.id).length
      return { ...imm, dotation_annuelle: dotation, cumul_amorti: cumul, valeur_nette, annees_restantes }
    })
  }, [immobs, amorts])

  const filtered = useMemo(() => {
    return immobsWithAmort.filter(i => {
      if (filterCat !== 'all' && i.categorie !== filterCat) return false
      if (filterStat !== 'all' && i.statut !== filterStat) return false
      return true
    })
  }, [immobsWithAmort, filterCat, filterStat])

  /* KPIs */
  const kpis = useMemo(() => {
    const actifs = immobsWithAmort.filter(i => i.statut === 'actif')
    return {
      count:         actifs.length,
      valBrute:      actifs.reduce((s, i) => s + i.valeur_acquisition, 0),
      cumAmort:      actifs.reduce((s, i) => s + i.cumul_amorti, 0),
      valNette:      actifs.reduce((s, i) => s + i.valeur_nette, 0),
      dotationAnnuelle: actifs.reduce((s, i) => s + i.dotation_annuelle, 0),
    }
  }, [immobsWithAmort])

  async function save() {
    if (!tenantId || !form.libelle) return
    setSaving(true)
    const cat = CATEGORIES.find(c => c.id === form.categorie)
    const payload = {
      ...form,
      tenant_id: tenantId,
      compte_ohada:  form.compte_ohada  || cat?.compte  || '',
      compte_amort:  form.compte_amort  || cat?.compte_amort || '',
    }
    if (editId) {
      await supabase.from('immobilisations').update(payload).eq('id', editId).eq('tenant_id', tenantId)
    } else {
      await supabase.from('immobilisations').insert(payload)
    }
    setSaving(false); setModal(false); setForm(EMPTY_FORM); setEditId(null)
    const { data } = await supabase.from('immobilisations').select('*').eq('tenant_id', tenantId).order('date_acquisition', { ascending: false })
    setImmobs((data || []) as Immobilisation[])
  }

  async function dotationAnnuelle(imm: typeof filtered[0]) {
    if (!tenantId) return
    const exercice = currentYear
    const existing = amorts.find(a => a.immobilisation_id === imm.id && a.exercice === exercice)
    if (existing) { alert(`Dotation ${exercice} déjà enregistrée`); return }
    const cumul = imm.cumul_amorti + imm.dotation_annuelle
    const vn    = imm.valeur_acquisition - cumul
    await supabase.from('amortissements').insert({
      immobilisation_id: imm.id, tenant_id: tenantId,
      exercice, dotation: imm.dotation_annuelle, cumul_amort: cumul, valeur_nette: vn,
    })
    const { data } = await supabase.from('amortissements').select('*').eq('tenant_id', tenantId)
    setAmorts((data || []) as Amortissement[])
  }

  function exportCSV() {
    const rows = filtered.map(i => ({
      Libellé: i.libelle, Référence: i.reference, Catégorie: i.categorie,
      'Valeur acquisition': i.valeur_acquisition, 'Date acquisition': i.date_acquisition,
      'Durée amort. (ans)': i.duree_amort, Méthode: i.methode_amort,
      'Cumul amorti': i.cumul_amorti, 'Valeur nette': i.valeur_nette,
      'Dotation annuelle': i.dotation_annuelle,
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `immobilisations.csv`; a.click()
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
            <Building2 size={22} className="text-[#2563EB]" />
            {t('compta.immob.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">{t('compta.immob.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> {t('common.export')} CSV
          </button>
          <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold hover:bg-[#1D4ED8]">
            <Plus size={13} /> {t('compta.immob.newAsset')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Actifs en service', value: kpis.count,          isMoney: false, color: '#2563EB' },
          { label: 'Valeur brute',       value: kpis.valBrute,       isMoney: true,  color: '#0F172A' },
          { label: 'Amort. cumulés',     value: kpis.cumAmort,       isMoney: true,  color: '#DC2626' },
          { label: 'Valeur nette',       value: kpis.valNette,       isMoney: true,  color: '#16A34A' },
          { label: 'Dotation annuelle',  value: kpis.dotationAnnuelle, isMoney: true, color: '#D97706' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[16px] font-extrabold" style={{ color: k.color }}>
              {k.isMoney ? fmtFCFA(k.value as number) : k.value}
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] bg-white focus:outline-none">
          <option value="all">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filterStat} onChange={e => setFilterStat(e.target.value)}
          className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] bg-white focus:outline-none">
          <option value="all">Tous statuts</option>
          <option value="actif">En service</option>
          <option value="cede">Cédé</option>
          <option value="reforme">Réformé</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 text-center">
          <Building2 size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8]">{t('compta.immob.empty')}</p>
          <button onClick={() => { setForm(EMPTY_FORM); setModal(true) }}
            className="mt-3 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold">
            + Ajouter une immobilisation
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(imm => {
            const isExp   = expanded === imm.id
            const tauxAmort = imm.valeur_acquisition > 0 ? (imm.cumul_amorti / imm.valeur_acquisition) * 100 : 0
            const isAlmostFull = tauxAmort >= 80
            const catLabel = CATEGORIES.find(c => c.id === imm.categorie)?.label || imm.categorie
            return (
              <div key={imm.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8FAFC]"
                  onClick={() => setExpanded(isExp ? null : imm.id)}>
                  <span className="text-[#94A3B8] w-4">
                    {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  {isAlmostFull && <AlertTriangle size={13} className="text-[#D97706] shrink-0" />}
                  <span className="flex-1 text-[12px] font-semibold text-[#0F172A] truncate">{imm.libelle}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] font-semibold hidden sm:block">{catLabel}</span>
                  <span className="font-mono text-[10px] text-[#64748B] hidden md:block">{imm.compte_ohada}</span>
                  <span className="text-[11px] text-[#64748B] w-28 text-right hidden md:block">{fmtFCFA(imm.valeur_acquisition)}</span>
                  <span className="text-[11px] text-[#DC2626] w-24 text-right hidden md:block">-{fmtFCFA(imm.cumul_amorti)}</span>
                  <span className="text-[12px] font-extrabold text-[#16A34A] w-28 text-right">{fmtFCFA(imm.valeur_nette)}</span>
                  <button onClick={e => { e.stopPropagation(); setForm(imm); setEditId(imm.id); setModal(true) }}
                    className="text-[11px] px-2 py-0.5 bg-[#F1F5F9] rounded text-[#64748B] hover:bg-[#E2E8F0] shrink-0">
                    Éditer
                  </button>
                </div>

                {/* Progress bar */}
                <div className="px-4 pb-2">
                  <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(tauxAmort, 100)}%`, background: isAlmostFull ? '#D97706' : '#2563EB' }} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-[#94A3B8]">Taux amorti: {tauxAmort.toFixed(1)}%</span>
                    <span className="text-[9px] text-[#94A3B8]">{imm.annees_restantes} an{imm.annees_restantes > 1 ? 's' : ''} restant</span>
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-[#F1F5F9] p-4 space-y-4">
                    {/* Detail info */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {[
                        { label: 'Référence',       value: imm.reference || '—' },
                        { label: "Date d'acquisition", value: imm.date_acquisition ? new Date(imm.date_acquisition).toLocaleDateString('fr-FR') : '—' },
                        { label: 'Durée amort.',    value: `${imm.duree_amort} ans` },
                        { label: 'Méthode',         value: imm.methode_amort === 'lineaire' ? 'Linéaire' : 'Dégressif' },
                        { label: 'Dotation/an',     value: fmtFCFA(imm.dotation_annuelle) },
                        { label: 'Val. résiduelle', value: fmtFCFA(imm.valeur_residuelle) },
                        { label: 'Cpte immob.',     value: imm.compte_ohada },
                        { label: 'Cpte amort.',     value: imm.compte_amort },
                        { label: 'Fournisseur',     value: imm.fournisseur || '—' },
                        { label: 'Statut',          value: imm.statut },
                      ].map(f => (
                        <div key={f.label}>
                          <div className="text-[9px] text-[#94A3B8] uppercase font-bold">{f.label}</div>
                          <div className="text-[11px] font-semibold text-[#0F172A] mt-0.5">{f.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Amortissements history */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-[#0F172A]">Plan d'amortissement</span>
                        <button
                          onClick={() => dotationAnnuelle(imm)}
                          className="text-[11px] px-3 py-1 bg-[#2563EB] text-white rounded-lg font-semibold">
                          + Enregistrer dotation {currentYear}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="bg-[#F8FAFC]">
                              {['Exercice','Dotation','Cumul amorti','Valeur nette'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {amorts.filter(a => a.immobilisation_id === imm.id)
                              .sort((a, b) => a.exercice - b.exercice)
                              .map(a => (
                                <tr key={a.id} className="border-t border-[#F8FAFC]">
                                  <td className="px-3 py-1.5 font-bold text-[#0F172A]">{a.exercice}</td>
                                  <td className="px-3 py-1.5 text-[#DC2626]">{fmtFCFA(a.dotation)}</td>
                                  <td className="px-3 py-1.5 text-[#D97706]">{fmtFCFA(a.cumul_amort)}</td>
                                  <td className="px-3 py-1.5 font-bold text-[#16A34A]">{fmtFCFA(a.valeur_nette)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                {editId ? 'Modifier l\'immobilisation' : 'Nouvelle immobilisation'}
              </h2>
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); setEditId(null) }}
                className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Catégorie */}
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Catégorie</label>
                <select value={form.categorie || 'materiel'}
                  onChange={e => {
                    const cat = CATEGORIES.find(c => c.id === e.target.value)
                    setForm(f => ({ ...f, categorie: e.target.value, compte_ohada: cat?.compte || '', compte_amort: cat?.compte_amort || '' }))
                  }}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'libelle',       label: 'Libellé *',                type: 'text',   placeholder: 'Ordinateur portable Dell' },
                  { key: 'reference',     label: 'Référence',                type: 'text',   placeholder: 'IMM-2025-001' },
                  { key: 'date_acquisition', label: "Date d'acquisition *",  type: 'date',   placeholder: '' },
                  { key: 'fournisseur',   label: 'Fournisseur',              type: 'text',   placeholder: 'Dell Congo' },
                  { key: 'valeur_acquisition', label: 'Valeur acquisition (FCFA)', type: 'number', placeholder: '0' },
                  { key: 'valeur_residuelle',  label: 'Valeur résiduelle (FCFA)',  type: 'number', placeholder: '0' },
                  { key: 'duree_amort',   label: 'Durée amortissement (ans)', type: 'number', placeholder: '5' },
                  { key: 'compte_ohada',  label: 'Compte immobilisation',    type: 'text',   placeholder: '241000' },
                  { key: 'compte_amort',  label: "Compte amortissement",     type: 'text',   placeholder: '284100' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                    <input type={f.type}
                      value={(form as Record<string, unknown>)[f.key] as string || ''}
                      onChange={e => setForm(prev => ({
                        ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                      }))}
                      placeholder={f.placeholder}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">Méthode amortissement</label>
                  <select value={form.methode_amort || 'lineaire'}
                    onChange={e => setForm(f => ({ ...f, methode_amort: e.target.value as 'lineaire' | 'degressif' }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                    <option value="lineaire">Linéaire</option>
                    <option value="degressif">Dégressif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">Statut</label>
                  <select value={form.statut || 'actif'}
                    onChange={e => setForm(f => ({ ...f, statut: e.target.value as Immobilisation['statut'] }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                    <option value="actif">En service</option>
                    <option value="cede">Cédé</option>
                    <option value="reforme">Réformé</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5 flex justify-end gap-2">
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); setEditId(null) }}
                className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">
                {t('common.cancel')}
              </button>
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
