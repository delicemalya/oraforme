'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, UsersRound, Check, X, Loader2, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Faculte { id: string; code: string; nom: string }

interface Departement {
  id: string
  tenant_id: string
  faculte_id: string | null
  code: string
  nom: string
  description: string | null
  actif: boolean
  created_at: string
  facultes?: { code: string; nom: string } | null
  nb_parcours?: number
}

const EMPTY_FORM = { code: '', nom: '', faculte_id: '', description: '' }

export default function DepartementsPage() {
  const { tenantId, sousType } = useTenant()

  const [departements, setDepartements] = useState<Departement[]>([])
  const [facultes,     setFacultes]     = useState<Faculte[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState<string | null>(null)
  const [filterFac,    setFilterFac]    = useState('')
  const [toast,        setToast]        = useState<{ ok: boolean; msg: string } | null>(null)
  const [form,         setForm]         = useState(EMPTY_FORM)

  function sf(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: depts }, { data: facs }] = await Promise.all([
      supabase
        .from('departements_universite')
        .select('*, facultes(code,nom), parcours_universite(count)')
        .eq('tenant_id', tenantId)
        .order('code'),
      supabase
        .from('facultes')
        .select('id,code,nom')
        .eq('tenant_id', tenantId)
        .eq('actif', true)
        .order('code'),
    ])
    const rows = (depts ?? []).map((d: Record<string, unknown>) => ({
      ...d,
      nb_parcours: Array.isArray(d.parcours_universite)
        ? (d.parcours_universite as { count: number }[])[0]?.count ?? 0
        : 0,
    })) as Departement[]
    setDepartements(rows)
    setFacultes((facs ?? []) as Faculte[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function openNew() { setEditId(null); setForm(EMPTY_FORM); setShowForm(true) }
  function openEdit(d: Departement) {
    setEditId(d.id)
    setForm({ code: d.code, nom: d.nom, faculte_id: d.faculte_id ?? '', description: d.description ?? '' })
    setShowForm(true)
  }

  async function save() {
    if (!tenantId || !form.code.trim() || !form.nom.trim()) return
    setSaving(true)
    const payload = {
      tenant_id:   tenantId,
      code:        form.code.trim().toUpperCase(),
      nom:         form.nom.trim(),
      faculte_id:  form.faculte_id || null,
      description: form.description.trim() || null,
    }
    const { error } = editId
      ? await supabase.from('departements_universite').update(payload).eq('id', editId).eq('tenant_id', tenantId)
      : await supabase.from('departements_universite').insert({ ...payload, actif: true })
    if (error) showToast(false, error.message)
    else { showToast(true, editId ? 'Département mis à jour.' : 'Département créé.'); setShowForm(false); load() }
    setSaving(false)
  }

  async function del(id: string, nom: string) {
    if (!confirm(`Supprimer le département "${nom}" ?`)) return
    const { error } = await supabase.from('departements_universite').delete().eq('id', id).eq('tenant_id', tenantId!)
    if (error) showToast(false, error.message)
    else { setDepartements(p => p.filter(d => d.id !== id)); showToast(true, 'Département supprimé.') }
  }

  const displayed = filterFac
    ? departements.filter(d => d.faculte_id === filterFac)
    : departements

  if (sousType && sousType !== 'universite') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <UsersRound size={40} style={{ color: 'var(--border)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Les départements académiques sont réservés aux établissements de type Université.
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Départements</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Départements académiques et leurs responsables, regroupés par faculté.
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#2563EB' }}>
          <Plus size={14} /> Nouveau département
        </button>
      </motion.div>

      {/* Filtre faculté */}
      {facultes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterFac('')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={!filterFac
              ? { background: '#2563EB', color: '#fff' }
              : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Toutes ({departements.length})
          </button>
          {facultes.map(f => (
            <button key={f.id} onClick={() => setFilterFac(f.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={filterFac === f.id
                ? { background: '#2563EB', color: '#fff' }
                : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {f.code} — {departements.filter(d => d.faculte_id === f.id).length}
            </button>
          ))}
        </div>
      )}

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
            {editId ? 'Modifier le département' : 'Nouveau département'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Code *</label>
              <input value={form.code} onChange={e => sf('code', e.target.value)} maxLength={10}
                placeholder="ex: INFO, MATH, DROIT"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Faculté</label>
              <select value={form.faculte_id} onChange={e => sf('faculte_id', e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50">
                <option value="">— Aucune faculté —</option>
                {facultes.map(f => (
                  <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Nom complet *</label>
              <input value={form.nom} onChange={e => sf('nom', e.target.value)}
                placeholder="ex: Département d'Informatique"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Description</label>
              <textarea value={form.description} onChange={e => sf('description', e.target.value)} rows={2}
                placeholder="Domaines de recherche, spécialités…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50 resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Annuler
            </button>
            <button onClick={save} disabled={saving || !form.code || !form.nom}
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
          <UsersRound size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucun département.{facultes.length === 0 ? ' Créez d\'abord une faculté.' : ' Créez le premier département.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((d, i) => (
            <motion.div key={d.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 cursor-pointer group"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
              onClick={() => openEdit(d)}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(37,99,235,0.08)' }}>
                  <UsersRound size={15} style={{ color: '#2563EB' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{d.code}</span>
                    {d.facultes && (
                      <span className="px-1.5 py-0.5 rounded text-xs"
                        style={{ background: 'rgba(37,99,235,0.06)', color: '#2563EB' }}>
                        {d.facultes.code}
                      </span>
                    )}
                  </div>
                  <p className="truncate" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{d.nom}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {d.nb_parcours ?? 0} parcours
                </span>
                <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity" />
                <button onClick={e => { e.stopPropagation(); del(d.id, d.nom) }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                  <Trash2 size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
