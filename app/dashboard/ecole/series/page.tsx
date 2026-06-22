'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, RefreshCw, Layers, Check, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SerieLycee {
  id: string
  tenant_id: string
  code: string
  libelle: string
  description: string | null
  actif: boolean
  created_at: string
}

// ── Séries standard Congo (pré-chargées si vide) ──────────────────────────────

const SERIES_STANDARD = [
  { code: 'A',  libelle: 'Série A — Lettres & Sciences Humaines',         description: 'Philosophie, Histoire-Géo, Littérature' },
  { code: 'B',  libelle: 'Série B — Sciences Économiques & Sociales',     description: 'Économie, Gestion, Sciences Sociales' },
  { code: 'C',  libelle: 'Série C — Mathématiques & Sciences Physiques',  description: 'Maths, Physique-Chimie' },
  { code: 'D',  libelle: 'Série D — Sciences Naturelles',                 description: 'Biologie, SVT, Chimie' },
  { code: 'E',  libelle: 'Série E — Mathématiques & Technique',           description: 'Maths, Technologie, Sciences Techniques' },
  { code: 'G',  libelle: 'Série G — Gestion & Comptabilité',              description: 'Comptabilité, Secrétariat, Commerce' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function SeriesLyceePage() {
  const { tenantId, sousType } = useTenant()

  const [series,   setSeries]   = useState<SerieLycee[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [toast,    setToast]    = useState<{ ok: boolean; msg: string } | null>(null)

  const [form, setForm] = useState({ code: '', libelle: '', description: '' })

  function sf(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('series_lycee')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('code')
    setSeries(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function seedSeries() {
    if (!tenantId) return
    setSaving(true)
    const rows = SERIES_STANDARD.map(s => ({ ...s, tenant_id: tenantId, actif: true }))
    const { error } = await supabase.from('series_lycee').upsert(rows, { onConflict: 'tenant_id,code' })
    if (error) showToast(false, 'Erreur lors du chargement des séries standard.')
    else { showToast(true, 'Séries standard chargées.'); load() }
    setSaving(false)
  }

  async function addSerie() {
    if (!tenantId || !form.code.trim() || !form.libelle.trim()) return
    setSaving(true)
    const { error } = await supabase.from('series_lycee').insert({
      tenant_id: tenantId,
      code:        form.code.trim().toUpperCase(),
      libelle:     form.libelle.trim(),
      description: form.description.trim() || null,
      actif:       true,
    })
    if (error) showToast(false, error.message)
    else { showToast(true, 'Série ajoutée.'); setShowForm(false); setForm({ code: '', libelle: '', description: '' }); load() }
    setSaving(false)
  }

  async function toggleActif(id: string, actif: boolean) {
    await supabase.from('series_lycee').update({ actif: !actif }).eq('id', id).eq('tenant_id', tenantId!)
    setSeries(prev => prev.map(s => s.id === id ? { ...s, actif: !actif } : s))
  }

  async function del(id: string) {
    if (!confirm('Supprimer cette série ?')) return
    await supabase.from('series_lycee').delete().eq('id', id).eq('tenant_id', tenantId!)
    setSeries(prev => prev.filter(s => s.id !== id))
    showToast(true, 'Série supprimée.')
  }

  if (sousType && sousType !== 'lycee' && sousType !== 'universite') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Layers size={40} style={{ color: 'var(--border)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Les séries et options sont réservées aux établissements de niveau Lycée.
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            Séries & Options
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Séries du baccalauréat, coefficients et options pour le Lycée.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {series.length === 0 && !loading && (
            <button onClick={seedSeries} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.25)' }}>
              <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
              Charger séries standard
            </button>
          )}
          <button onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: '#DC2626' }}>
            <Plus size={14} />
            Nouvelle série
          </button>
        </div>
      </motion.div>

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
            Nouvelle série
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Code *</label>
              <input value={form.code} onChange={e => sf('code', e.target.value)} maxLength={5}
                placeholder="ex: A, B, C, D…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:border-[#DC2626]/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Libellé *</label>
              <input value={form.libelle} onChange={e => sf('libelle', e.target.value)}
                placeholder="ex: Série C — Mathématiques & Sciences Physiques"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#DC2626]/50" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Description</label>
              <input value={form.description} onChange={e => sf('description', e.target.value)}
                placeholder="Matières principales…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#DC2626]/50" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Annuler
            </button>
            <button onClick={addSerie} disabled={saving || !form.code || !form.libelle}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Enregistrer
            </button>
          </div>
        </motion.div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : series.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}>
          <Layers size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucune série. Chargez les séries standard ou créez une série personnalisée.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {series.map((s, i) => (
            <motion.div key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border p-4"
              style={{ background: 'var(--card-bg)', borderColor: s.actif ? 'var(--border)' : 'rgba(220,38,38,0.2)', opacity: s.actif ? 1 : 0.6 }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#DC262618' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#DC2626' }}>{s.code}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.libelle}</p>
                    {s.description && (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{s.description}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t"
                style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => toggleActif(s.id, s.actif)}
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: s.actif ? '#16A34A' : 'var(--text-secondary)' }}>
                  {s.actif
                    ? <ToggleRight size={16} style={{ color: '#16A34A' }} />
                    : <ToggleLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                  }
                  {s.actif ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => del(s.id)}
                  className="p-1.5 rounded-lg transition-colors"
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
