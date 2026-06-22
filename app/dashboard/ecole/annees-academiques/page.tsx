'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, CalendarClock, Check, X, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

type Statut = 'a_venir' | 'en_cours' | 'cloturee'
type Session = 'normale' | 'rattrapage' | 'exceptionnelle'

interface AnneeAcademique {
  id: string
  tenant_id: string
  libelle: string
  annee_debut: number
  annee_fin: number
  statut: Statut
  session_active: Session
  date_debut: string | null
  date_fin: string | null
  created_at: string
}

const STATUT_CFG: Record<Statut, { label: string; color: string; bg: string }> = {
  a_venir:  { label: 'À venir',   color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
  en_cours: { label: 'En cours',  color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
  cloturee: { label: 'Clôturée',  color: '#6B7280', bg: 'rgba(107,114,128,0.08)' },
}

const SESSION_CFG: Record<Session, string> = {
  normale:        'Normale',
  rattrapage:     'Rattrapage',
  exceptionnelle: 'Exceptionnelle',
}

const EMPTY_FORM = {
  annee_debut: String(new Date().getFullYear()),
  statut: 'en_cours' as Statut,
  session_active: 'normale' as Session,
  date_debut: '',
  date_fin: '',
}

export default function AnneesAcademiquesPage() {
  const { tenantId, sousType } = useTenant()

  const [annees,   setAnnees]   = useState<AnneeAcademique[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [toast,    setToast]    = useState<{ ok: boolean; msg: string } | null>(null)
  const [form,     setForm]     = useState(EMPTY_FORM)

  function sf(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Libellé auto depuis annee_debut
  function getLibelle(debut: string) {
    const d = parseInt(debut)
    return isNaN(d) ? '' : `${d}-${d + 1}`
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('annees_academiques')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('annee_debut', { ascending: false })
    setAnnees((data ?? []) as AnneeAcademique[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function openNew() { setEditId(null); setForm(EMPTY_FORM); setShowForm(true) }
  function openEdit(a: AnneeAcademique) {
    setEditId(a.id)
    setForm({
      annee_debut:    String(a.annee_debut),
      statut:         a.statut,
      session_active: a.session_active,
      date_debut:     a.date_debut ?? '',
      date_fin:       a.date_fin   ?? '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!tenantId || !form.annee_debut) return
    const debut = parseInt(form.annee_debut)
    if (isNaN(debut)) return
    setSaving(true)
    const payload = {
      tenant_id:      tenantId,
      libelle:        getLibelle(form.annee_debut),
      annee_debut:    debut,
      annee_fin:      debut + 1,
      statut:         form.statut,
      session_active: form.session_active,
      date_debut:     form.date_debut || null,
      date_fin:       form.date_fin   || null,
    }
    const { error } = editId
      ? await supabase.from('annees_academiques').update(payload).eq('id', editId).eq('tenant_id', tenantId)
      : await supabase.from('annees_academiques').insert(payload)
    if (error) showToast(false, error.message)
    else { showToast(true, editId ? 'Année mise à jour.' : 'Année créée.'); setShowForm(false); load() }
    setSaving(false)
  }

  async function del(id: string, libelle: string) {
    if (!confirm(`Supprimer l'année "${libelle}" ?`)) return
    const { error } = await supabase.from('annees_academiques').delete().eq('id', id).eq('tenant_id', tenantId!)
    if (error) showToast(false, error.message)
    else { setAnnees(p => p.filter(a => a.id !== id)); showToast(true, 'Année supprimée.') }
  }

  if (sousType && sousType !== 'universite') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CalendarClock size={40} style={{ color: 'var(--border)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Les années académiques sont réservées aux établissements de type Université.
        </p>
      </div>
    )
  }

  const active = annees.find(a => a.statut === 'en_cours')

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Années Académiques</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Calendrier universitaire, sessions et statuts.
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#2563EB' }}>
          <Plus size={14} /> Nouvelle année
        </button>
      </motion.div>

      {/* Active banner */}
      {active && (
        <div className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.2)' }}>
          <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
              Année en cours : {active.libelle}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
              Session : {SESSION_CFG[active.session_active]}
            </span>
          </div>
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
            {editId ? 'Modifier l\'année' : 'Nouvelle année académique'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Année de début *</label>
              <input value={form.annee_debut} onChange={e => sf('annee_debut', e.target.value)}
                type="number" min={2000} max={2040}
                placeholder="ex: 2024"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
              {form.annee_debut && !isNaN(parseInt(form.annee_debut)) && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Libellé : {getLibelle(form.annee_debut)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Statut</label>
              <select value={form.statut} onChange={e => sf('statut', e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50">
                {Object.entries(STATUT_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Session active</label>
              <select value={form.session_active} onChange={e => sf('session_active', e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50">
                {Object.entries(SESSION_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Date début</label>
              <input type="date" value={form.date_debut} onChange={e => sf('date_debut', e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Date fin</label>
              <input type="date" value={form.date_fin} onChange={e => sf('date_fin', e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]/50" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Annuler
            </button>
            <button onClick={save} disabled={saving || !form.annee_debut}
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
      ) : annees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}>
          <CalendarClock size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucune année académique. Créez l'année universitaire en cours.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {annees.map((a, i) => {
            const sc = STATUT_CFG[a.statut]
            return (
              <motion.div key={a.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 cursor-pointer group"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
                onClick={() => openEdit(a)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: sc.bg }}>
                    <CalendarClock size={16} style={{ color: sc.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{a.libelle}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      <span className="px-2 py-0.5 rounded text-xs"
                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                        {SESSION_CFG[a.session_active]}
                      </span>
                    </div>
                    {(a.date_debut || a.date_fin) && (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {a.date_debut ? new Date(a.date_debut).toLocaleDateString('fr-FR') : '—'}
                        {' → '}
                        {a.date_fin ? new Date(a.date_fin).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); del(a.id, a.libelle) }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                  <Trash2 size={13} />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
