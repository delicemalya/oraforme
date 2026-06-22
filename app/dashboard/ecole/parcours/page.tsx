'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, FolderOpen, Check, X, Loader2, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

type NiveauParcours = 'Licence' | 'Master' | 'Doctorat' | 'BTS' | 'DUT' | 'Autre'

const NIVEAUX: { value: NiveauParcours; label: string; credits: number; semestres: number }[] = [
  { value: 'Licence',  label: 'Licence (Bac+3)',  credits: 180, semestres: 6  },
  { value: 'Master',   label: 'Master (Bac+5)',   credits: 120, semestres: 4  },
  { value: 'Doctorat', label: 'Doctorat (Bac+8)', credits: 180, semestres: 6  },
  { value: 'BTS',      label: 'BTS (Bac+2)',      credits: 120, semestres: 4  },
  { value: 'DUT',      label: 'DUT (Bac+2)',      credits: 120, semestres: 4  },
  { value: 'Autre',    label: 'Autre',             credits: 60,  semestres: 2  },
]

const NIVEAU_COLORS: Record<NiveauParcours, string> = {
  Licence:  '#2563EB',
  Master:   '#7C3AED',
  Doctorat: '#DC2626',
  BTS:      '#16A34A',
  DUT:      '#0891B2',
  Autre:    '#6B7280',
}

interface Departement { id: string; code: string; nom: string }

interface Parcours {
  id: string
  tenant_id: string
  departement_id: string | null
  code: string
  intitule: string
  niveau: NiveauParcours
  duree_semestres: number
  credits_requis: number
  description: string | null
  actif: boolean
  created_at: string
  departements_universite?: { code: string; nom: string } | null
}

const EMPTY_FORM = {
  code: '', intitule: '', niveau: 'Licence' as NiveauParcours,
  departement_id: '', duree_semestres: '6', credits_requis: '180', description: '',
}

export default function ParcoursPage() {
  const { tenantId, sousType } = useTenant()

  const [parcours,     setParcours]     = useState<Parcours[]>([])
  const [departements, setDepartements] = useState<Departement[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState<string | null>(null)
  const [filterNiveau, setFilterNiveau] = useState<NiveauParcours | ''>('')
  const [toast,        setToast]        = useState<{ ok: boolean; msg: string } | null>(null)
  const [form,         setForm]         = useState(EMPTY_FORM)

  function sf(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Quand le niveau change, pré-remplir crédits/semestres par défaut
  function onNiveauChange(niveau: NiveauParcours) {
    const n = NIVEAUX.find(x => x.value === niveau)
    if (n && !editId) {
      setForm(p => ({ ...p, niveau, duree_semestres: String(n.semestres), credits_requis: String(n.credits) }))
    } else {
      setForm(p => ({ ...p, niveau }))
    }
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: parc }, { data: depts }] = await Promise.all([
      supabase
        .from('parcours_universite')
        .select('*, departements_universite(code,nom)')
        .eq('tenant_id', tenantId)
        .order('niveau')
        .order('code'),
      supabase
        .from('departements_universite')
        .select('id,code,nom')
        .eq('tenant_id', tenantId)
        .eq('actif', true)
        .order('code'),
    ])
    setParcours((parc ?? []) as Parcours[])
    setDepartements((depts ?? []) as Departement[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function openNew() { setEditId(null); setForm(EMPTY_FORM); setShowForm(true) }
  function openEdit(p: Parcours) {
    setEditId(p.id)
    setForm({
      code: p.code, intitule: p.intitule, niveau: p.niveau,
      departement_id: p.departement_id ?? '',
      duree_semestres: String(p.duree_semestres),
      credits_requis: String(p.credits_requis),
      description: p.description ?? '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!tenantId || !form.code.trim() || !form.intitule.trim()) return
    setSaving(true)
    const payload = {
      tenant_id:       tenantId,
      code:            form.code.trim().toUpperCase(),
      intitule:        form.intitule.trim(),
      niveau:          form.niveau,
      departement_id:  form.departement_id || null,
      duree_semestres: parseInt(form.duree_semestres) || 6,
      credits_requis:  parseInt(form.credits_requis) || 180,
      description:     form.description.trim() || null,
    }
    const { error } = editId
      ? await supabase.from('parcours_universite').update(payload).eq('id', editId).eq('tenant_id', tenantId)
      : await supabase.from('parcours_universite').insert({ ...payload, actif: true })
    if (error) showToast(false, error.message)
    else { showToast(true, editId ? 'Parcours mis à jour.' : 'Parcours créé.'); setShowForm(false); load() }
    setSaving(false)
  }

  async function del(id: string, intitule: string) {
    if (!confirm(`Supprimer le parcours "${intitule}" ?`)) return
    const { error } = await supabase.from('parcours_universite').delete().eq('id', id).eq('tenant_id', tenantId!)
    if (error) showToast(false, error.message)
    else { setParcours(p => p.filter(x => x.id !== id)); showToast(true, 'Parcours supprimé.') }
  }

  const displayed = filterNiveau ? parcours.filter(p => p.niveau === filterNiveau) : parcours

  // KPIs par niveau
  const kpis = NIVEAUX.map(n => ({ ...n, count: parcours.filter(p => p.niveau === n.value).length }))
    .filter(n => n.count > 0)

  if (sousType && sousType !== 'universite') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <FolderOpen size={40} style={{ color: 'var(--border)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Les parcours sont réservés aux établissements de type Université.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Parcours & Programmes</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Licences, Masters, Doctorats et autres programmes d'études.
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#2563EB' }}>
          <Plus size={14} /> Nouveau parcours
        </button>
      </motion.div>

      {/* KPIs niveaux */}
      {kpis.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {kpis.map(k => (
            <div key={k.value} className="flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: NIVEAU_COLORS[k.value] }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: NIVEAU_COLORS[k.value] }}>{k.value}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>× {k.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filtre niveau */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterNiveau('')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={!filterNiveau
            ? { background: '#2563EB', color: '#fff' }
            : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
          Tous ({parcours.length})
        </button>
        {NIVEAUX.map(n => {
          const cnt = parcours.filter(p => p.niveau === n.value).length
          if (cnt === 0) return null
          return (
            <button key={n.value} onClick={() => setFilterNiveau(n.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={filterNiveau === n.value
                ? { background: NIVEAU_COLORS[n.value], color: '#fff' }
                : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {n.value} ({cnt})
            </button>
          )
        })}
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
          style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            {editId ? 'Modifier le parcours' : 'Nouveau parcours'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Code *</label>
              <input value={form.code} onChange={e => sf('code', e.target.value)} maxLength={10}
                placeholder="ex: L-INFO, M-IA, D-MATH"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Niveau *</label>
              <select value={form.niveau} onChange={e => onNiveauChange(e.target.value as NiveauParcours)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50">
                {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Intitulé *</label>
              <input value={form.intitule} onChange={e => sf('intitule', e.target.value)}
                placeholder="ex: Licence Informatique — Génie Logiciel"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Département</label>
              <select value={form.departement_id} onChange={e => sf('departement_id', e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50">
                <option value="">— Aucun département —</option>
                {departements.map(d => (
                  <option key={d.id} value={d.id}>{d.code} — {d.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Durée (semestres)</label>
              <input value={form.duree_semestres} onChange={e => sf('duree_semestres', e.target.value)}
                type="number" min={1} max={16}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Crédits requis</label>
              <input value={form.credits_requis} onChange={e => sf('credits_requis', e.target.value)}
                type="number" min={1}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Description</label>
              <textarea value={form.description} onChange={e => sf('description', e.target.value)} rows={2}
                placeholder="Objectifs pédagogiques, débouchés…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50 resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Annuler
            </button>
            <button onClick={save} disabled={saving || !form.code || !form.intitule}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#2563EB' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {editId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </motion.div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}>
          <FolderOpen size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucun parcours. Créez le premier programme d'études.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((p, i) => {
            const color = NIVEAU_COLORS[p.niveau]
            return (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 cursor-pointer group"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
                onClick={() => openEdit(p)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 flex-shrink-0"
                    style={{ background: `${color}15` }}>
                    <FolderOpen size={15} style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.code}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ background: `${color}15`, color }}>
                        {p.niveau}
                      </span>
                      {p.departements_universite && (
                        <span className="px-1.5 py-0.5 rounded text-xs"
                          style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                          {p.departements_universite.code}
                        </span>
                      )}
                    </div>
                    <p className="truncate" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{p.intitule}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.duree_semestres} sem.</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.credits_requis} crédits</p>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button onClick={e => { e.stopPropagation(); del(p.id, p.intitule) }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
