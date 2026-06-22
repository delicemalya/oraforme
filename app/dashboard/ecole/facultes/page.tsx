'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Building2, Check, X, Loader2, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Faculte {
  id: string
  tenant_id: string
  code: string
  nom: string
  acronyme: string | null
  description: string | null
  actif: boolean
  created_at: string
  nb_departements?: number
}

const EMPTY_FORM = { code: '', nom: '', acronyme: '', description: '' }

export default function FacultesPage() {
  const { tenantId, sousType } = useTenant()

  const [facultes,  setFacultes]  = useState<Faculte[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [toast,     setToast]     = useState<{ ok: boolean; msg: string } | null>(null)
  const [form,      setForm]      = useState(EMPTY_FORM)

  function sf(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('facultes')
      .select('*, departements_universite(count)')
      .eq('tenant_id', tenantId)
      .order('code')
    // Flatten count
    const rows = (data ?? []).map((f: Record<string, unknown>) => ({
      ...f,
      nb_departements: Array.isArray(f.departements_universite)
        ? (f.departements_universite as { count: number }[])[0]?.count ?? 0
        : 0,
    })) as Faculte[]
    setFacultes(rows)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(f: Faculte) {
    setEditId(f.id)
    setForm({ code: f.code, nom: f.nom, acronyme: f.acronyme ?? '', description: f.description ?? '' })
    setShowForm(true)
  }

  async function save() {
    if (!tenantId || !form.code.trim() || !form.nom.trim()) return
    setSaving(true)
    const payload = {
      tenant_id:   tenantId,
      code:        form.code.trim().toUpperCase(),
      nom:         form.nom.trim(),
      acronyme:    form.acronyme.trim() || null,
      description: form.description.trim() || null,
    }
    const { error } = editId
      ? await supabase.from('facultes').update(payload).eq('id', editId).eq('tenant_id', tenantId)
      : await supabase.from('facultes').insert({ ...payload, actif: true })
    if (error) showToast(false, error.message)
    else { showToast(true, editId ? 'Faculté mise à jour.' : 'Faculté créée.'); setShowForm(false); load() }
    setSaving(false)
  }

  async function del(id: string, nom: string) {
    if (!confirm(`Supprimer la faculté "${nom}" ?\nTous ses départements seront détachés.`)) return
    const { error } = await supabase.from('facultes').delete().eq('id', id).eq('tenant_id', tenantId!)
    if (error) showToast(false, error.message)
    else { setFacultes(p => p.filter(f => f.id !== id)); showToast(true, 'Faculté supprimée.') }
  }

  if (sousType && sousType !== 'universite') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Building2 size={40} style={{ color: 'var(--border)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Les facultés sont réservées aux établissements de type Université.
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Facultés</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            UFR, instituts et écoles composantes de l'université.
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#2563EB' }}>
          <Plus size={14} /> Nouvelle faculté
        </button>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Facultés', value: facultes.length },
          { label: 'Actives',  value: facultes.filter(f => f.actif).length },
          { label: 'Départements (total)', value: facultes.reduce((s, f) => s + (f.nb_departements ?? 0), 0) },
        ].map(k => (
          <div key={k.label} className="rounded-xl border p-4"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{k.value}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{k.label}</p>
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
          style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            {editId ? 'Modifier la faculté' : 'Nouvelle faculté'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Code *</label>
              <input value={form.code} onChange={e => sf('code', e.target.value)} maxLength={10}
                placeholder="ex: FST, FDD, FMSS"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Acronyme</label>
              <input value={form.acronyme} onChange={e => sf('acronyme', e.target.value)} maxLength={20}
                placeholder="ex: UFR-ST"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Nom complet *</label>
              <input value={form.nom} onChange={e => sf('nom', e.target.value)}
                placeholder="ex: Faculté des Sciences et Techniques"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Description</label>
              <textarea value={form.description} onChange={e => sf('description', e.target.value)} rows={2}
                placeholder="Domaines de formation, spécialités…"
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
      ) : facultes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}>
          <Building2 size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucune faculté. Créez la première faculté de votre université.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {facultes.map((f, i) => (
            <motion.div key={f.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 cursor-pointer group"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
              onClick={() => openEdit(f)}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(37,99,235,0.1)' }}>
                  <Building2 size={16} style={{ color: '#2563EB' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{f.code}</span>
                    {f.acronyme && (
                      <span className="px-1.5 py-0.5 rounded text-xs"
                        style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB' }}>{f.acronyme}</span>
                    )}
                    {!f.actif && (
                      <span className="px-1.5 py-0.5 rounded text-xs"
                        style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>Inactive</span>
                    )}
                  </div>
                  <p className="truncate" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{f.nom}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {f.nb_departements ?? 0} dép.
                </span>
                <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity" />
                <button onClick={e => { e.stopPropagation(); del(f.id, f.nom) }}
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
