'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Users, Star, Bot, Upload, Plus, X, Check, ChevronDown,
  Mail, Phone, FileText, AlertCircle, Trash2, ExternalLink, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Types ────────────────────────────────────────────────────────────────────

interface Offre {
  id: string
  titre: string
  description: string
  criteres: {
    niveaux?: string[]
    experience?: number
    langues?: string[]
    mots_cles?: string[]
  }
  statut: string
  created_at: string
}

interface Candidat {
  id: string
  nom: string
  email: string
  telephone: string
  niveau_etudes: string
  annees_experience: number
  langues: string[]
  competences: string[]
  score: number
  resume_court: string
  points_forts: string[]
  points_faibles: string[]
  recommande: boolean
  statut: string
  offre_id: string | null
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return '#16A34A'
  if (s >= 50) return '#DC2626'
  return '#DC2626'
}

function ScoreGauge({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const c = scoreColor(score)
  const cx = size / 2
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#1a2d50" strokeWidth={size * 0.08} />
      <motion.circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={c} strokeWidth={size * 0.08}
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (score / 100) * circ }}
        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
        strokeLinecap="round"
        style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cx}px` }}
      />
      <text
        x={cx} y={cx + size * 0.075}
        textAnchor="middle"
        fill={c}
        fontSize={size * 0.22}
        fontWeight="bold"
        fontFamily="system-ui"
      >
        {score}
      </text>
    </svg>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const c = scoreColor(score)
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: c, backgroundColor: `${c}20` }}>
      {score}/100
    </span>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const { t } = useLocale()
  const map: Record<string, { label: string; color: string }> = {
    nouveau:   { label: 'Nouveau',   color: '#DC2626' },
    retenu:    { label: 'Retenu',    color: '#16A34A' },
    rejete:    { label: 'Rejeté',   color: '#DC2626' },
    entretien: { label: 'Entretien', color: '#DC2626' },
  }
  const s = map[statut] ?? map.nouveau
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: s.color, backgroundColor: `${s.color}20` }}>
      {s.label}
    </span>
  )
}

// ── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={e => { e.preventDefault(); !disabled && setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f && !disabled) onFile(f)
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
        drag ? 'border-[#DC2626] bg-[#DC2626]/5' :
        disabled ? 'border-[var(--border)] opacity-50 cursor-not-allowed' :
        'border-[var(--border)] hover:border-[#64748B] hover:bg-white/5/30'
      }`}
    >
      <Upload size={32} className={`mx-auto mb-3 ${drag ? 'text-[#DC2626]' : 'text-[var(--text-secondary)]'}`} />
      <p className="text-sm text-[var(--text-secondary)] font-medium">Glissez un CV ici</p>
      <p className="text-xs text-[var(--text-secondary)] mt-1">PDF ou DOCX — ou cliquez pour parcourir</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}

// ── Onglet 1 : Offres ────────────────────────────────────────────────────────

const NIVEAUX   = ['BAC', 'BTS', 'Licence', 'Master', 'Doctorat', 'BAC+5', 'BAC+8']
const EXPS      = [1, 2, 3, 5, 7, 10]
const LANGUES   = ['Français courant', 'Anglais courant', 'Bilingue FR/EN', 'Portugais', 'Arabe']
const MOTS_CLES = ['Comptabilité', 'Finance', 'IT', 'RH', 'Marketing', 'Juridique', 'Logistique', 'Commercial']

function TabOffres({ tenantId, offres, onRefresh }: {
  tenantId: string; offres: Offre[]; onRefresh: () => void
}) {
  const { t } = useLocale()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({
    titre: '', description: '',
    niveaux: [] as string[], experience: 0,
    langues: [] as string[], mots_cles: [] as string[],
  })

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  async function handleCreate() {
    if (!form.titre.trim()) return
    setSaving(true)
    await supabase.from('offres_emploi').insert({
      tenant_id: tenantId,
      titre: form.titre,
      description: form.description,
      criteres: {
        niveaux: form.niveaux,
        experience: form.experience,
        langues: form.langues,
        mots_cles: form.mots_cles,
      },
      statut: 'active',
    })
    setSaving(false)
    setShowForm(false)
    setForm({ titre: '', description: '', niveaux: [], experience: 0, langues: [], mots_cles: [] })
    onRefresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('offres_emploi').delete().eq('id', id)
    onRefresh()
  }

  const CheckGroup = ({ label, items, selected, onToggle }: {
    label: string; items: (string | number)[]; selected: (string | number)[]
    onToggle: (v: string | number) => void
  }) => (
    <div>
      <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map(item => {
          const sel = selected.includes(item)
          return (
            <button
              key={String(item)}
              onClick={() => onToggle(item)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                sel ? 'bg-[#DC2626]/15 border-[#DC2626]/40 text-[#DC2626]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[#64748B]'
              }`}
            >
              {sel && '✓ '}{item}{typeof item === 'number' ? ' an' + (item > 1 ? 's' : '') : ''}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{offres.length} offre{offres.length !== 1 ? 's' : ''} active{offres.length !== 1 ? 's' : ''}</p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors"
        >
          <Plus size={13} /> {t('rh.recrutement.newPosting')}
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 space-y-4 overflow-hidden"
          >
            <h3 className="text-sm font-bold text-[var(--text)]">Nouvelle offre d'emploi</h3>
            <input
              value={form.titre}
              onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              placeholder="Intitulé du poste *"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#64748B] outline-none focus:border-[#DC2626]/40 transition-colors"
            />
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description du poste..."
              rows={3}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#64748B] outline-none focus:border-[#DC2626]/40 transition-colors resize-none"
            />
            <CheckGroup label="Niveau d'études requis" items={NIVEAUX} selected={form.niveaux}
              onToggle={v => setForm(f => ({ ...f, niveaux: toggle(f.niveaux, v as string) }))} />
            <CheckGroup label="Expérience minimum" items={EXPS} selected={form.experience ? [form.experience] : []}
              onToggle={v => setForm(f => ({ ...f, experience: f.experience === v ? 0 : v as number }))} />
            <CheckGroup label="Langues requises" items={LANGUES} selected={form.langues}
              onToggle={v => setForm(f => ({ ...f, langues: toggle(f.langues, v as string) }))} />
            <CheckGroup label="Mots-clés / Domaines" items={MOTS_CLES} selected={form.mots_cles}
              onToggle={v => setForm(f => ({ ...f, mots_cles: toggle(f.mots_cles, v as string) }))} />
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                {t('common.cancel')}
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleCreate}
                disabled={saving || !form.titre.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {saving ? t('common.loading') : 'Créer l\'offre'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {offres.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <Briefcase size={36} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t('rh.recrutement.noPostings')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offres.map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 flex items-start justify-between gap-4 hover:border-[#64748B] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-[var(--text)] truncate">{o.titre}</p>
                  <span className="text-[10px] font-semibold text-[#16A34A] bg-[#16A34A18] px-1.5 py-0.5 rounded-full shrink-0">
                    {o.statut}
                  </span>
                </div>
                {o.description && (
                  <p className="text-xs text-[var(--text-secondary)] truncate mb-2">{o.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {o.criteres?.niveaux?.slice(0, 3).map(n => (
                    <span key={n} className="text-[10px] text-[var(--text-secondary)] border border-[var(--border)] rounded px-1.5 py-0.5">{n}</span>
                  ))}
                  {o.criteres?.experience ? (
                    <span className="text-[10px] text-[var(--text-secondary)] border border-[var(--border)] rounded px-1.5 py-0.5">
                      {o.criteres.experience}+ an{o.criteres.experience > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {o.criteres?.langues?.slice(0, 2).map(l => (
                    <span key={l} className="text-[10px] text-[#DC2626] border border-[#DC2626]/20 rounded px-1.5 py-0.5">{l}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete(o.id)}
                className="text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0 p-1"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Onglet 2 : Candidats ─────────────────────────────────────────────────────

function TabCandidats({ tenantId, offres, candidats, onRefresh }: {
  tenantId: string; offres: Offre[]; candidats: Candidat[]; onRefresh: () => void
}) {
  const { t } = useLocale()
  const [selectedOffre, setSelectedOffre] = useState<string>('all')
  const [uploading,     setUploading]     = useState(false)
  const [progress,      setProgress]      = useState(0)
  const [progressText,  setProgressText]  = useState('')
  const [filter,        setFilter]        = useState<'all' | 'top' | 'recommande' | 'rejete'>('all')
  const [error,         setError]         = useState('')

  const shown = candidats.filter(c => {
    if (selectedOffre !== 'all' && c.offre_id !== selectedOffre) return false
    if (filter === 'top') return c.score >= 70
    if (filter === 'recommande') return c.recommande
    if (filter === 'rejete') return c.statut === 'rejete'
    return true
  })

  async function handleFile(file: File) {
    setUploading(true); setError(''); setProgress(10)
    setProgressText('Extraction du texte...')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const upRes = await fetch('/api/cv/upload', { method: 'POST', body: fd })
      const upData = await upRes.json()
      if (!upRes.ok) throw new Error(upData.error ?? 'Erreur upload')

      setProgress(45); setProgressText('Analyse IA en cours...')
      const offre = offres.find(o => o.id === selectedOffre)
      const anaRes = await fetch('/api/cv/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvText: upData.text,
          criteres: offre?.criteres,
          offreId: selectedOffre !== 'all' ? selectedOffre : undefined,
          offreTitre: offre?.titre,
          tenantId,
        }),
      })
      const anaData = await anaRes.json()
      if (!anaRes.ok) throw new Error(anaData.error ?? 'Erreur analyse')

      setProgress(100); setProgressText('Analyse terminée !')
      setTimeout(() => { setProgress(0); setProgressText('') }, 1200)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setProgress(0); setProgressText('')
    } finally {
      setUploading(false)
    }
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('cv_candidats').update({ statut }).eq('id', id)
    onRefresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('cv_candidats').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Offre selector + upload */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[var(--text-secondary)] mb-1.5 block font-semibold">Offre cible</label>
          <div className="relative">
            <select
              value={selectedOffre}
              onChange={e => setSelectedOffre(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[#DC2626]/40 appearance-none pr-8"
            >
              <option value="all">Toutes les offres</option>
              {offres.map(o => <option key={o.id} value={o.id}>{o.titre}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
          </div>
        </div>

        {/* Progress */}
        {progress > 0 && (
          <div className="flex flex-col justify-end">
            <p className="text-xs text-[var(--text-secondary)] mb-1">{progressText}</p>
            <div className="h-2 bg-[var(--surface-alt)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#DC2626] rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}
      </div>

      <DropZone onFile={handleFile} disabled={uploading} />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-lg">
          <AlertCircle size={13} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-[var(--text-secondary)] hover:text-red-400"><X size={12} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'top', 'recommande', 'rejete'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#64748B]'
            }`}
          >
            {{ all: 'Tous', top: 'Score > 70', recommande: 'Recommandés', rejete: 'Rejetés' }[f]}
          </button>
        ))}
        <span className="text-xs text-[var(--text-secondary)] ml-auto">{shown.length} candidat{shown.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {shown.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <Users size={36} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Aucun candidat. Déposez des CVs ci-dessus pour commencer l'analyse.</p>
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Candidat', 'Score IA', 'Niveau', 'Expérience', 'Langues', 'Statut', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {shown.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="hover:bg-white/5/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: `${scoreColor(c.score)}1A`, color: scoreColor(c.score) }}
                        >
                          {(c.nom ?? 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--text)]">{c.nom}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] truncate max-w-[120px]">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ScoreBadge score={c.score} /></td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{c.niveau_etudes}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {c.annees_experience} an{c.annees_experience !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {c.langues.slice(0, 2).join(', ')}{c.langues.length > 2 && '...'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.statut}
                        onChange={e => updateStatut(c.id, e.target.value)}
                        className="bg-transparent text-[10px] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-secondary)] outline-none"
                      >
                        <option value="nouveau">{t('common.new')}</option>
                        <option value="entretien">Entretien</option>
                        <option value="retenu">Retenu</option>
                        <option value="rejete">{t('common.rejected')}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(c.id)} className="text-[var(--text-secondary)] hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Onglet 3 : Top Candidats ─────────────────────────────────────────────────

function TabTop({ candidats, onRefresh }: { candidats: Candidat[]; onRefresh: () => void }) {
  const top = [...candidats].sort((a, b) => b.score - a.score).slice(0, 3)

  async function updateStatut(id: string, statut: string) {
    await supabase.from('cv_candidats').update({ statut }).eq('id', id)
    onRefresh()
  }

  if (top.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--text-secondary)]">
        <Star size={40} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Analysez des CVs pour voir les meilleurs candidats ici.</p>
      </div>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        {top.length} meilleur{top.length !== 1 ? 's' : ''} candidat{top.length !== 1 ? 's' : ''} recommandé{top.length !== 1 ? 's' : ''} par l'IA
      </p>
      {top.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, ease: 'easeOut' }}
          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 hover:border-[#64748B] transition-all"
          style={c.score >= 70 ? { boxShadow: `0 0 24px ${scoreColor(c.score)}10` } : undefined}
        >
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Score gauge */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <ScoreGauge score={c.score} size={88} />
              <span className="text-lg">{medals[i]}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-base font-bold text-[var(--text)]">{c.nom}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {c.niveau_etudes} · {c.annees_experience} an{c.annees_experience !== 1 ? 's' : ''} exp.
                  </p>
                </div>
                {c.recommande && (
                  <span className="text-[10px] font-bold text-[#16A34A] bg-[#16A34A18] px-2 py-0.5 rounded-full shrink-0">
                    ✓ Recommandé
                  </span>
                )}
              </div>

              {c.resume_court && (
                <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">{c.resume_court}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {c.points_forts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[#16A34A] mb-1.5">✅ Points forts</p>
                    <ul className="space-y-0.5">
                      {c.points_forts.slice(0, 4).map((p, j) => (
                        <li key={j} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                          <span className="text-[#16A34A] mt-0.5 shrink-0">·</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.points_faibles.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[#DC2626] mb-1.5">❌ Points faibles</p>
                    <ul className="space-y-0.5">
                      {c.points_faibles.slice(0, 4).map((p, j) => (
                        <li key={j} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                          <span className="text-[#DC2626] mt-0.5 shrink-0">·</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {c.competences.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {c.competences.slice(0, 6).map((comp, j) => (
                    <span key={j} className="text-[10px] text-[var(--text-secondary)] border border-[var(--border)] rounded-full px-2 py-0.5">
                      {comp}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] rounded-lg text-xs font-semibold hover:bg-[#DC2626]/20 transition-colors"
                  >
                    <Mail size={12} /> Contacter
                  </a>
                )}
                {c.telephone && (
                  <a
                    href={`https://wa.me/${c.telephone.replace(/\s/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)]/10 border border-[#16A34A]/20 text-[#16A34A] rounded-lg text-xs font-semibold hover:bg-[var(--surface)]/20 transition-colors"
                  >
                    <Phone size={12} /> WhatsApp
                  </a>
                )}
                <button
                  onClick={() => updateStatut(c.id, 'retenu')}
                  disabled={c.statut === 'retenu'}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] text-white rounded-lg text-xs font-bold hover:bg-[#071535] transition-colors disabled:opacity-40"
                >
                  <Check size={12} /> Retenir
                </button>
                <button
                  onClick={() => updateStatut(c.id, 'rejete')}
                  disabled={c.statut === 'rejete'}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] rounded-lg text-xs font-semibold hover:bg-[#DC2626]/20 transition-colors disabled:opacity-40"
                >
                  <X size={12} /> Rejeter
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── Onglet 4 : Agent IA ──────────────────────────────────────────────────────

function TabAgent({ candidats }: { candidats: Candidat[] }) {
  const [config, setConfig] = useState({
    nom: 'Sophie — Recruteuse IA',
    seuil: 65,
    action: 'notifier',
    actif: false,
  })

  const autoDecisions = candidats.filter(c => c.recommande || c.score >= config.seuil)

  return (
    <div className="space-y-5">
      {/* Config card */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#DC2626]/15 flex items-center justify-center">
            <Bot size={15} className="text-[#DC2626]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">Configuration de l'Agent</h3>
            <p className="text-xs text-[var(--text-secondary)]">Décisions automatiques basées sur le score IA</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setConfig(c => ({ ...c, actif: !c.actif }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${config.actif ? 'bg-[var(--surface)]' : 'bg-[#30363D]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.actif ? 'translate-x-5.5 translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Nom de l'agent</label>
            <input
              value={config.nom}
              onChange={e => setConfig(c => ({ ...c, nom: e.target.value }))}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[#DC2626]/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
              Seuil de score minimum : <span className="text-[#DC2626]">{config.seuil}/100</span>
            </label>
            <input
              type="range" min={0} max={100}
              value={config.seuil}
              onChange={e => setConfig(c => ({ ...c, seuil: Number(e.target.value) }))}
              className="w-full accent-[#DC2626]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)] mb-2 block">Action automatique</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { val: 'notifier', label: '📬 Notifier le RH' },
                { val: 'retenir',  label: '✅ Retenir auto'  },
                { val: 'rejeter',  label: '❌ Rejeter auto'  },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setConfig(c => ({ ...c, action: opt.val }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    config.action === opt.val
                      ? 'bg-[#DC2626]/15 border-[#DC2626]/40 text-[#DC2626]'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[#64748B]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Historique décisions */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--text)] mb-3">
          Décisions de l'agent ({autoDecisions.length})
        </h3>
        {autoDecisions.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
            L'agent n'a pas encore pris de décisions. Ajustez le seuil ou analysez des CVs.
          </p>
        ) : (
          <div className="space-y-2">
            {autoDecisions.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0"
              >
                <ScoreBadge score={c.score} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text)] truncate">{c.nom}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{c.resume_court?.slice(0, 80)}...</p>
                </div>
                <span className="text-[10px] text-[#16A34A] bg-[#16A34A14] px-2 py-0.5 rounded-full shrink-0">
                  ✓ {config.action === 'notifier' ? 'Notifié' : config.action === 'retenir' ? 'Retenu' : 'Rejeté'}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function RecrutementPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()
  const [activeTab,  setActiveTab]  = useState('offres')
  const [offres,     setOffres]     = useState<Offre[]>([])
  const [candidats,  setCandidats]  = useState<Candidat[]>([])
  const [dataLoading,setDataLoading]= useState(true)

  const TABS = [
    { id: 'offres',    label: t('rh.recrutement.tab.postes'),     icon: Briefcase },
    { id: 'candidats', label: t('rh.recrutement.tab.candidats'),  icon: Users     },
    { id: 'top',       label: 'Top Candidats',                    icon: Star      },
    { id: 'agent',     label: 'Agent IA',                         icon: Bot       },
  ]

  const load = useCallback(async () => {
    if (!tenantId) return
    setDataLoading(true)
    const [offresRes, candidatsRes] = await Promise.all([
      supabase.from('offres_emploi').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('cv_candidats').select('*').eq('tenant_id', tenantId).order('score', { ascending: false }).limit(200),
    ])
    setOffres(offresRes.data as Offre[] ?? [])
    setCandidats(candidatsRes.data as Candidat[] ?? [])
    setDataLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  if (tenantLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="text-[#DC2626] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-[var(--text)]">{t('rh.recrutement.title')}</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {t('rh.recrutement.subtitle')} · {offres.length} offre{offres.length !== 1 ? 's' : ''} · {candidats.length} candidat{candidats.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-1">
        {TABS.map(tab_ => {
          const Icon = tab_.icon
          const active = activeTab === tab_.id
          return (
            <button
              key={tab_.id}
              onClick={() => setActiveTab(tab_.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${
                active
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/5'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{tab_.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
        >
          {activeTab === 'offres' && (
            <TabOffres tenantId={tenantId!} offres={offres} onRefresh={load} />
          )}
          {activeTab === 'candidats' && (
            <TabCandidats tenantId={tenantId!} offres={offres} candidats={candidats} onRefresh={load} />
          )}
          {activeTab === 'top' && (
            <TabTop candidats={candidats} onRefresh={load} />
          )}
          {activeTab === 'agent' && (
            <TabAgent candidats={candidats} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
