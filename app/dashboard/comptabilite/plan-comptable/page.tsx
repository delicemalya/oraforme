'use client'

/**
 * Plan Comptable OHADA — Visualisation et personnalisation
 * Classes 1-9, recherche intelligente, ajout de comptes custom
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { OHADA_ACCOUNTS } from '@/lib/accounting-engine'
import { List, Search, Plus, Download, X, CheckCircle2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

interface PlanCompte {
  id?: string; numero: string; intitule: string
  classe: number; type_compte: string; sens_normal: 'debit' | 'credit'
  est_actif: boolean; est_systeme: boolean; notes?: string
  tenant_id?: string
}

const CLASSES_LABELS: Record<number, string> = {
  1: 'Classe 1 — Comptes de Capitaux',
  2: 'Classe 2 — Comptes d\'Immobilisations',
  3: 'Classe 3 — Comptes de Stocks',
  4: 'Classe 4 — Comptes de Tiers',
  5: 'Classe 5 — Comptes de Trésorerie',
  6: 'Classe 6 — Comptes de Charges',
  7: 'Classe 7 — Comptes de Produits',
  8: 'Classe 8 — Comptes Spéciaux',
  9: 'Classe 9 — Comptabilité Analytique',
}

const TYPE_OPTIONS = ['actif','passif','charge','produit','tresorerie','capitaux','stock','tiers']
const TYPE_COLORS: Record<string, string> = {
  actif: '#2563EB', passif: '#16A34A', charge: '#DC2626', produit: '#16A34A',
  tresorerie: '#0891B2', capitaux: '#8B5CF6', stock: '#D97706', tiers: '#64748B',
}

const EMPTY_FORM: { numero: string; intitule: string; classe: number; type_compte: string; sens_normal: 'debit' | 'credit'; notes: string } = {
  numero: '', intitule: '', classe: 1, type_compte: 'actif',
  sens_normal: 'debit', notes: '',
}

export default function PlanComptablePage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [customComptes, setCustomComptes] = useState<PlanCompte[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filterClasse, setFilterClasse]   = useState('all')
  const [showForm, setShowForm]           = useState(false)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [saving, setSaving]               = useState(false)
  const [saveOk, setSaveOk]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  /* Load custom comptes from DB */
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(false)
      const { data } = await supabase
        .from('plan_comptable')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('numero')
        .limit(200)
      setCustomComptes((data || []) as PlanCompte[])
      setLoading(false)
    })()
  }, [tenantId])

  /* Merge standard OHADA + custom */
  const allComptes = useMemo<PlanCompte[]>(() => {
    const standard: PlanCompte[] = OHADA_ACCOUNTS.map(a => ({
      numero: String(a.number),
      intitule: a.name,
      classe: Math.floor(Number(a.number) / 100000),
      type_compte: a.type,
      sens_normal: (a.sens ?? 'debit') as 'debit' | 'credit',
      est_actif: true,
      est_systeme: true,
    }))

    /* Merge: custom overrides standard if same numero */
    const customMap = new Map(customComptes.map(c => [c.numero, c]))
    const merged = standard.map(s => customMap.has(s.numero) ? { ...s, ...customMap.get(s.numero)! } : s)
    const newCustom = customComptes.filter(c => !standard.find(s => s.numero === c.numero))
    return [...merged, ...newCustom].sort((a, b) => a.numero.localeCompare(b.numero))
  }, [customComptes])

  /* Filtered */
  const filtered = useMemo(() => {
    return allComptes.filter(c => {
      if (filterClasse !== 'all' && String(c.classe) !== filterClasse) return false
      if (search) {
        const q = search.toLowerCase()
        return c.numero.includes(q) || c.intitule.toLowerCase().includes(q)
      }
      return true
    })
  }, [allComptes, search, filterClasse])

  /* Save new compte */
  async function handleSave() {
    if (!tenantId || !form.numero.trim() || !form.intitule.trim()) {
      setError('Numéro et intitulé obligatoires')
      return
    }
    setSaving(true); setError(null)

    const classe = Math.floor(Number(form.numero) / 100000) || form.classe

    const { error: err } = await supabase.from('plan_comptable').upsert({
      tenant_id: tenantId,
      numero: form.numero.trim(),
      intitule: form.intitule.trim(),
      classe,
      type_compte: form.type_compte,
      sens_normal: form.sens_normal,
      est_actif: true,
      est_systeme: false,
      notes: form.notes.trim() || null,
    }, { onConflict: 'tenant_id,numero' })

    if (err) { setError(err.message); setSaving(false); return }

    const { data } = await supabase.from('plan_comptable').select('*').eq('tenant_id', tenantId).order('numero').limit(200)
    setCustomComptes((data || []) as PlanCompte[])
    setSaveOk(true)
    setTimeout(() => { setSaveOk(false); setShowForm(false); setForm(EMPTY_FORM) }, 1200)
    setSaving(false)
  }

  /* Toggle active/inactive */
  async function toggleActif(compte: PlanCompte) {
    if (compte.est_systeme) return // can't disable system accounts
    const newVal = !compte.est_actif
    await supabase.from('plan_comptable').upsert({
      tenant_id: tenantId,
      numero: compte.numero,
      intitule: compte.intitule,
      classe: compte.classe,
      type_compte: compte.type_compte,
      sens_normal: compte.sens_normal,
      est_actif: newVal,
      est_systeme: false,
    }, { onConflict: 'tenant_id,numero' })
    setCustomComptes(prev => prev.map(c => c.numero === compte.numero ? { ...c, est_actif: newVal } : c))
  }

  /* CSV */
  function exportCSV() {
    const rows = filtered.map(c => ({
      Numéro: c.numero, Intitulé: c.intitule, Classe: c.classe,
      Type: c.type_compte, Sens: c.sens_normal, Actif: c.est_actif ? 'Oui' : 'Non',
    }))
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'plan-comptable-ohada.csv'; a.click()
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
            <List size={22} className="text-[#2563EB]" />
            {t('compta.plan.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.plan.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> {t('common.export')} CSV
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-lg">
            <Plus size={13} /> {t('compta.plan.addClass')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total comptes', value: allComptes.length, color: '#2563EB' },
          { label: 'Comptes actifs', value: allComptes.filter(c => c.est_actif).length, color: '#16A34A' },
          { label: 'Comptes custom', value: customComptes.length, color: '#D97706' },
          { label: 'Classes OHADA', value: 9, color: '#8B5CF6' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
            <div className="text-[24px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#64748B]">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('compta.plan.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
        </div>
        <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)}
          className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none">
          <option value="all">{t('compta.plan.allClasses')}</option>
          {Object.entries(CLASSES_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A]">Ajouter / modifier un compte</h2>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Numéro *</label>
                  <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                    placeholder="ex: 621100"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Sens normal</label>
                  <select value={form.sens_normal} onChange={e => setForm(f => ({ ...f, sens_normal: e.target.value as 'debit'|'credit' }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                    <option value="debit">Débiteur</option>
                    <option value="credit">Créditeur</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Intitulé *</label>
                <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))}
                  placeholder="Libellé du compte"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Type de compte</label>
                <select value={form.type_compte} onChange={e => setForm(f => ({ ...f, type_compte: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optionnel"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
              </div>
              {error  && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}
              {saveOk && <p className="text-[12px] text-[#16A34A] bg-[#DCFCE7] px-3 py-2 rounded-lg flex items-center gap-1"><CheckCircle2 size={13} /> Compte enregistré !</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {t('common.save')}
                </button>
                <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                  className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#64748B]">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table grouped by class */}
      <div className="space-y-2">
        {Object.entries(CLASSES_LABELS).map(([cl, clLabel]) => {
          const clNum = Number(cl)
          const clLines = filtered.filter(c => c.classe === clNum)
          if (clLines.length === 0 && filterClasse !== 'all') return null
          return (
            <div key={cl} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EFF6FF] border-b border-[#E2E8F0] flex items-center justify-between">
                <p className="text-[12px] font-bold text-[#2563EB]">{clLabel}</p>
                <span className="text-[10px] text-[#94A3B8]">{clLines.length} compte{clLines.length > 1 ? 's' : ''}</span>
              </div>
              {clLines.length === 0 ? (
                <p className="px-4 py-2 text-[11px] text-[#94A3B8]">{t('compta.plan.empty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {clLines.map(c => (
                        <tr key={c.numero} className={`border-b border-[#F8FAFC] hover:bg-[#F8FAFC] ${!c.est_actif ? 'opacity-40' : ''}`}>
                          <td className="px-4 py-2 font-mono font-bold text-[#2563EB] w-24">{c.numero}</td>
                          <td className="px-4 py-2 text-[#0F172A] font-medium">{c.intitule}</td>
                          <td className="px-4 py-2 hidden sm:table-cell">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                  style={{ background: (TYPE_COLORS[c.type_compte] || '#64748B') + '18', color: TYPE_COLORS[c.type_compte] || '#64748B' }}>
                              {c.type_compte}
                            </span>
                          </td>
                          <td className="px-4 py-2 hidden md:table-cell">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              c.sens_normal === 'debit' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-[#F0FDF4] text-[#16A34A]'
                            }`}>
                              {c.sens_normal === 'debit' ? 'Débiteur' : 'Créditeur'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {c.est_systeme ? (
                              <span className="text-[9px] text-[#94A3B8] font-semibold uppercase">OHADA</span>
                            ) : (
                              <button onClick={() => toggleActif(c)} className="text-[#64748B] hover:text-[#0F172A]">
                                {c.est_actif
                                  ? <ToggleRight size={16} className="text-[#16A34A]" />
                                  : <ToggleLeft size={16} />}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
