'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, RefreshCw, BookOpen, Check, X, Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UE {
  id: string
  tenant_id: string
  code: string
  intitule: string
  credits: number
  semestre: number
  annee: number
  parcours: 'Licence' | 'Master' | 'Doctorat' | 'BTS' | 'DUT' | 'Autre'
  obligatoire: boolean
  coefficient: number
  description: string | null
  created_at: string
}

type Parcours = UE['parcours']

const PARCOURS_OPTIONS: Parcours[] = ['Licence', 'Master', 'Doctorat', 'BTS', 'DUT', 'Autre']

const PARCOURS_COLORS: Record<Parcours, string> = {
  Licence:  '#DC2626',
  Master:   '#7C3AED',
  Doctorat: '#0F172A',
  BTS:      '#2563EB',
  DUT:      '#0891B2',
  Autre:    '#64748B',
}

const EMPTY_FORM = {
  code: '', intitule: '', credits: 6, semestre: 1, annee: 1,
  parcours: 'Licence' as Parcours, obligatoire: true, coefficient: 1, description: '',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function UnitesEnseignementPage() {
  const { tenantId, sousType } = useTenant()

  const [ues,      setUes]      = useState<UE[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [toast,    setToast]    = useState<{ ok: boolean; msg: string } | null>(null)
  const [search,   setSearch]   = useState('')
  const [filterParcours, setFilterParcours] = useState<Parcours | 'tous'>('tous')

  const [form, setForm] = useState(EMPTY_FORM)

  function sf<K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('unites_enseignement')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('parcours').order('annee').order('semestre').order('code')
    setUes(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function addUE() {
    if (!tenantId || !form.code.trim() || !form.intitule.trim()) return
    setSaving(true)
    const { error } = await supabase.from('unites_enseignement').insert({
      tenant_id:   tenantId,
      code:        form.code.trim().toUpperCase(),
      intitule:    form.intitule.trim(),
      credits:     form.credits,
      semestre:    form.semestre,
      annee:       form.annee,
      parcours:    form.parcours,
      obligatoire: form.obligatoire,
      coefficient: form.coefficient,
      description: form.description.trim() || null,
    })
    if (error) showToast(false, error.message)
    else { showToast(true, 'UE créée.'); setShowForm(false); setForm(EMPTY_FORM); load() }
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('Supprimer cette UE ?')) return
    await supabase.from('unites_enseignement').delete().eq('id', id).eq('tenant_id', tenantId!)
    setUes(prev => prev.filter(u => u.id !== id))
    showToast(true, 'UE supprimée.')
  }

  if (sousType && sousType !== 'universite') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <BookOpen size={40} style={{ color: 'var(--border)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Les Unités d&apos;Enseignement sont réservées aux établissements universitaires.
        </p>
      </div>
    )
  }

  const filtered = ues.filter(u => {
    const matchParcours = filterParcours === 'tous' || u.parcours === filterParcours
    const q = search.toLowerCase()
    return matchParcours && (!q || (u.code + ' ' + u.intitule).toLowerCase().includes(q))
  })

  const grouped = filtered.reduce<Record<string, UE[]>>((acc, u) => {
    const key = `${u.parcours} — Année ${u.annee} — Semestre ${u.semestre}`
    if (!acc[key]) acc[key] = []
    acc[key].push(u)
    return acc
  }, {})

  const totalCredits = (parc: Parcours) => ues.filter(u => u.parcours === parc).reduce((s, u) => s + u.credits, 0)

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            Unités d&apos;Enseignement
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            UE, crédits ECTS et parcours LMD — Licence, Master, Doctorat.
          </p>
        </div>
        <button onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#DC2626' }}>
          <Plus size={14} />
          Nouvelle UE
        </button>
      </motion.div>

      {/* Résumé crédits par parcours */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(['Licence', 'Master', 'Doctorat'] as Parcours[]).map(p => (
          <div key={p} className="rounded-xl border p-4"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {p}
            </p>
            <p style={{ fontSize: 28, fontWeight: 800, color: PARCOURS_COLORS[p], lineHeight: 1 }}>
              {totalCredits(p)}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              crédits ECTS · {ues.filter(u => u.parcours === p).length} UE
            </p>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
          toast.ok ? 'bg-[#16A34A]/10 border-[#16A34A]/25 text-[#16A34A]' : 'bg-[#DC2626]/10 border-[#DC2626]/25 text-[#DC2626]'
        }`}>
          {toast.ok ? <Check size={14} /> : <X size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl border"
          style={{ background: 'var(--card-bg)', borderColor: '#DC2626', borderWidth: 1.5 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Nouvelle Unité d&apos;Enseignement
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Code UE *</label>
              <input value={form.code} onChange={e => sf('code', e.target.value)} maxLength={12}
                placeholder="ex: INF201"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:border-[#DC2626]/50" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Intitulé *</label>
              <input value={form.intitule} onChange={e => sf('intitule', e.target.value)}
                placeholder="ex: Algorithmique et Structures de Données"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#DC2626]/50" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Parcours</label>
              <select value={form.parcours} onChange={e => sf('parcours', e.target.value as Parcours)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none">
                {PARCOURS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Année</label>
              <select value={form.annee} onChange={e => sf('annee', parseInt(e.target.value))}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none">
                {[1,2,3,4,5,6,7,8].map(a => <option key={a} value={a}>Année {a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Semestre</label>
              <select value={form.semestre} onChange={e => sf('semestre', parseInt(e.target.value))}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(s => <option key={s} value={s}>S{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Crédits ECTS</label>
              <input type="number" min={1} max={30} value={form.credits}
                onChange={e => sf('credits', parseInt(e.target.value) || 1)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Coefficient</label>
              <input type="number" min={0.5} max={10} step={0.5} value={form.coefficient}
                onChange={e => sf('coefficient', parseFloat(e.target.value) || 1)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Type</label>
              <button type="button"
                onClick={() => sf('obligatoire', !form.obligatoire)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {form.obligatoire ? 'Obligatoire' : 'Optionnelle'}
                <div className={`w-4 h-4 rounded-full border-2 ${form.obligatoire ? 'bg-[#DC2626] border-[#DC2626]' : 'border-[#64748B]'}`} />
              </button>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Description</label>
              <input value={form.description} onChange={e => sf('description', e.target.value)}
                placeholder="Contenu, objectifs…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Annuler
            </button>
            <button onClick={addUE} disabled={saving || !form.code || !form.intitule}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Créer l&apos;UE
            </button>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher code ou intitulé…"
            className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none" />
        </div>
        <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
          {(['tous', ...PARCOURS_OPTIONS] as const).map(p => (
            <button key={p} onClick={() => setFilterParcours(p)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: filterParcours === p ? (p === 'tous' ? '#0F172A' : PARCOURS_COLORS[p as Parcours]) : 'transparent',
                color: filterParcours === p ? '#FFFFFF' : 'var(--text-secondary)',
              }}>
              {p === 'tous' ? 'Tous' : p}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}>
          <BookOpen size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucune UE. Créez des unités d&apos;enseignement pour structurer votre parcours LMD.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([groupLabel, items]) => (
            <div key={groupLabel}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                {groupLabel}
                <span style={{ marginLeft: 8, fontWeight: 400 }}>
                  · {items.reduce((s, u) => s + u.credits, 0)} crédits · {items.length} UE
                </span>
              </p>
              <div className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Code', 'Intitulé', 'Crédits', 'Coeff.', 'Type', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left"
                            style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((u, i) => (
                        <tr key={u.id}
                          style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}
                          className="transition-colors"
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(220,38,38,0.03)'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                          <td className="px-4 py-3">
                            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: PARCOURS_COLORS[u.parcours] }}>
                              {u.code}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{u.intitule}</p>
                              {u.description && (
                                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{u.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span style={{ fontSize: 14, fontWeight: 700, color: PARCOURS_COLORS[u.parcours] }}>
                              {u.credits}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 2 }}>ECTS</span>
                          </td>
                          <td className="px-4 py-3" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            {u.coefficient}
                          </td>
                          <td className="px-4 py-3">
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: u.obligatoire ? 'rgba(220,38,38,0.1)' : 'rgba(100,116,139,0.1)',
                              color: u.obligatoire ? '#DC2626' : '#64748B',
                            }}>
                              {u.obligatoire ? 'Obligatoire' : 'Optionnelle'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => del(u.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
