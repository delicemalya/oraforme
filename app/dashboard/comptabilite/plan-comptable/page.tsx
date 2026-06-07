'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { COMPTES_PLATS, TYPE_COLORS, CLASSES_NOMS, type CompteFlat, type TypeCompte } from '@/lib/syscohada/plan-comptable'
import { List, Search, Plus, Download, X, CheckCircle2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

interface PlanCompte {
  id?: string; numero: string; intitule: string
  classe: number; type_compte: string; sens_normal: 'debit' | 'credit'
  est_actif: boolean; est_systeme: boolean; notes?: string
  tenant_id?: string
}

const TYPE_OPTIONS: TypeCompte[] = ['actif','passif','mixte','charge','produit','charge_hao','produit_hao','analytique']

const EMPTY_FORM = {
  numero: '', intitule: '', classe: 1, type_compte: 'actif' as TypeCompte,
  sens_normal: 'debit' as 'debit' | 'credit', notes: '',
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

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('plan_comptable')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('numero')
        .limit(500)
      setCustomComptes((data || []) as PlanCompte[])
      setLoading(false)
    })()
  }, [tenantId])

  // Merge SYSCOHADA standard + custom comptes du tenant
  const allComptes = useMemo<PlanCompte[]>(() => {
    const standard: PlanCompte[] = COMPTES_PLATS.map(c => ({
      numero:      c.numero,
      intitule:    c.nom,
      classe:      c.classe,
      type_compte: c.type,
      sens_normal: c.soldeNormal,
      est_actif:   true,
      est_systeme: true,
    }))
    const customMap = new Map(customComptes.map(c => [c.numero, c]))
    const merged = standard.map(s =>
      customMap.has(s.numero) ? { ...s, ...customMap.get(s.numero)! } : s
    )
    const newCustom = customComptes.filter(c => !standard.find(s => s.numero === c.numero))
    return [...merged, ...newCustom].sort((a, b) =>
      a.numero.localeCompare(b.numero, undefined, { numeric: true })
    )
  }, [customComptes])

  const filtered = useMemo(() => allComptes.filter(c => {
    if (filterClasse !== 'all' && String(c.classe) !== filterClasse) return false
    if (search) {
      const q = search.toLowerCase()
      return c.numero.includes(q) || c.intitule.toLowerCase().includes(q)
    }
    return true
  }), [allComptes, search, filterClasse])

  async function handleSave() {
    if (!tenantId || !form.numero.trim() || !form.intitule.trim()) {
      setError('Numéro et intitulé obligatoires')
      return
    }
    setSaving(true); setError(null)
    const classe = parseInt(form.numero[0]) || form.classe
    const { error: err } = await supabase.from('plan_comptable').upsert({
      tenant_id:   tenantId,
      numero:      form.numero.trim(),
      intitule:    form.intitule.trim(),
      classe,
      type_compte: form.type_compte,
      sens_normal: form.sens_normal,
      est_actif:   true,
      est_systeme: false,
      notes:       form.notes.trim() || null,
    }, { onConflict: 'tenant_id,numero' })
    if (err) { setError(err.message); setSaving(false); return }
    const { data } = await supabase.from('plan_comptable').select('*')
      .eq('tenant_id', tenantId).order('numero').limit(500)
    setCustomComptes((data || []) as PlanCompte[])
    setSaveOk(true)
    setTimeout(() => { setSaveOk(false); setShowForm(false); setForm(EMPTY_FORM) }, 1200)
    setSaving(false)
  }

  async function toggleActif(compte: PlanCompte) {
    if (compte.est_systeme) return
    const newVal = !compte.est_actif
    await supabase.from('plan_comptable').upsert({
      tenant_id: tenantId, numero: compte.numero, intitule: compte.intitule,
      classe: compte.classe, type_compte: compte.type_compte, sens_normal: compte.sens_normal,
      est_actif: newVal, est_systeme: false,
    }, { onConflict: 'tenant_id,numero' })
    setCustomComptes(prev => prev.map(c => c.numero === compte.numero ? { ...c, est_actif: newVal } : c))
  }

  function exportCSV() {
    const rows = filtered.map(c => ({
      Numéro: c.numero, Intitulé: c.intitule, Classe: c.classe,
      Type: c.type_compte, Sens: c.sens_normal, Actif: c.est_actif ? 'Oui' : 'Non',
    }))
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'plan-comptable-syscohada.csv'; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement…
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <List size={22} className="text-[#2563EB]" />
            Plan Comptable SYSCOHADA
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Système Comptable OHADA révisé 2017 · Classes 1–9
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-lg">
            <Plus size={13} /> Ajouter un compte
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total comptes', value: allComptes.length,                          color: '#2563EB' },
          { label: 'Comptes actifs', value: allComptes.filter(c => c.est_actif).length, color: '#16A34A' },
          { label: 'Comptes custom', value: customComptes.length,                      color: '#F59E0B' },
          { label: 'Classes SYSCOHADA', value: 9,                                      color: '#8B5CF6' },
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
            placeholder="Rechercher par numéro ou intitulé…"
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
        </div>
        <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)}
          className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none">
          <option value="all">Toutes les classes</option>
          {Object.entries(CLASSES_NOMS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Modal création compte */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A]">Ajouter / modifier un compte</h2>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
                <X size={18} className="text-[#94A3B8]" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Numéro *</label>
                  <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                    placeholder="ex: 6611"
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
                <select value={form.type_compte} onChange={e => setForm(f => ({ ...f, type_compte: e.target.value as TypeCompte }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                  {TYPE_OPTIONS.map(tp => (
                    <option key={tp} value={tp}>{TYPE_COLORS[tp].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optionnel"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
              </div>
              {error  && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}
              {saveOk && (
                <p className="text-[12px] text-[#16A34A] bg-[#DCFCE7] px-3 py-2 rounded-lg flex items-center gap-1">
                  <CheckCircle2 size={13} /> Compte enregistré !
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Enregistrer
                </button>
                <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                  className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#64748B]">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table groupée par classe */}
      <div className="space-y-2">
        {Object.entries(CLASSES_NOMS).map(([cl, clLabel]) => {
          const clNum = Number(cl)
          const clLines = filtered.filter(c => c.classe === clNum)
          if (clLines.length === 0 && filterClasse !== 'all') return null
          return (
            <div key={cl} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EFF6FF] border-b border-[#E2E8F0] flex items-center justify-between">
                <p className="text-[12px] font-bold text-[#2563EB]">{clLabel}</p>
                <span className="text-[10px] text-[#94A3B8]">
                  {clLines.length} compte{clLines.length > 1 ? 's' : ''}
                </span>
              </div>
              {clLines.length === 0 ? (
                <p className="px-4 py-2 text-[11px] text-[#94A3B8]">Aucun compte dans cette classe</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {clLines.map(c => {
                        const typeInfo = TYPE_COLORS[c.type_compte as TypeCompte]
                        return (
                          <tr key={c.numero}
                            className={`border-b border-[#F8FAFC] hover:bg-[#F8FAFC] ${!c.est_actif ? 'opacity-40' : ''}`}>
                            <td className="px-4 py-2 font-mono font-bold text-[#2563EB] w-20">{c.numero}</td>
                            <td className="px-4 py-2 text-[#0F172A] font-medium">{c.intitule}</td>
                            <td className="px-4 py-2 hidden sm:table-cell">
                              {typeInfo && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                  style={{ background: typeInfo.bg, color: typeInfo.color }}>
                                  {typeInfo.label}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 hidden md:table-cell">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                c.sens_normal === 'debit'
                                  ? 'bg-[#EFF6FF] text-[#2563EB]'
                                  : 'bg-[#F0FDF4] text-[#16A34A]'
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
                        )
                      })}
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
