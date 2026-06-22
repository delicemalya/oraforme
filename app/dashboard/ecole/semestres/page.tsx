'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, RefreshCw, Loader2, Check, X, ChevronDown, GraduationCap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SemestreEtudiant {
  id: string
  etudiant_id: string
  annee_universitaire: string
  semestre: number
  credits_obtenus: number
  credits_requis: number
  moyenne: number | null
  statut: 'en_cours' | 'valide' | 'ajourne' | 'rattrapage' | 'abandonne'
  session: 'normale' | 'rattrapage' | 'exceptionnelle'
  mention: string | null
  date_deliberation: string | null
  created_at: string
  // joined
  etudiants?: { nom: string; prenom: string; numero_id: string }
}

interface Etudiant {
  id: string
  nom: string
  prenom: string
  numero_id: string
  niveau: string
  statut: string
}

const STATUT_COLORS: Record<string, string> = {
  en_cours:  '#2563EB',
  valide:    '#16A34A',
  ajourne:   '#DC2626',
  rattrapage:'#D97706',
  abandonne: '#64748B',
}

const STATUT_LABELS: Record<string, string> = {
  en_cours:  'En cours',
  valide:    'Validé',
  ajourne:   'Ajourné',
  rattrapage:'Rattrapage',
  abandonne: 'Abandonné',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SemestresPage() {
  const { tenantId, sousType } = useTenant()

  const [semestres,  setSemestres]  = useState<SemestreEtudiant[]>([])
  const [etudiants,  setEtudiants]  = useState<Etudiant[]>([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState<{ ok: boolean; msg: string } | null>(null)
  const [filterAnnee, setFilterAnnee] = useState('2024-2025')
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [semRes, etuRes] = await Promise.all([
      supabase
        .from('semestres_etudiants')
        .select('*, etudiants(nom, prenom, numero_id)')
        .eq('tenant_id', tenantId)
        .eq('annee_universitaire', filterAnnee)
        .order('semestre')
        .order('created_at', { ascending: false }),
      supabase
        .from('etudiants')
        .select('id, nom, prenom, numero_id, niveau, statut')
        .eq('tenant_id', tenantId)
        .eq('statut', 'actif')
        .order('nom'),
    ])
    setSemestres(semRes.data ?? [])
    setEtudiants(etuRes.data ?? [])
    setLoading(false)
  }, [tenantId, filterAnnee])

  useEffect(() => { load() }, [load])

  async function deliberer(id: string, statut: SemestreEtudiant['statut'], mention: string) {
    const { error } = await supabase.from('semestres_etudiants')
      .update({ statut, mention: mention || null, date_deliberation: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
      .eq('tenant_id', tenantId!)
    if (error) showToast(false, 'Erreur lors de la délibération.')
    else { showToast(true, 'Délibération enregistrée.'); load() }
  }

  async function initSemestre(etudiantId: string, semestre: number) {
    const { error } = await supabase.from('semestres_etudiants').insert({
      tenant_id:          tenantId,
      etudiant_id:        etudiantId,
      annee_universitaire: filterAnnee,
      semestre,
      credits_requis:     30,
      credits_obtenus:    0,
      statut:             'en_cours',
      session:            'normale',
    })
    if (error) showToast(false, error.message)
    else { showToast(true, 'Semestre initialisé.'); load() }
  }

  if (sousType && sousType !== 'universite') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CalendarClock size={40} style={{ color: 'var(--border)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          La gestion des semestres et délibérations est réservée aux établissements universitaires.
        </p>
      </div>
    )
  }

  const displayed = semestres.filter(s => filterStatut === 'tous' || s.statut === filterStatut)

  const grouped = displayed.reduce<Record<number, SemestreEtudiant[]>>((acc, s) => {
    if (!acc[s.semestre]) acc[s.semestre] = []
    acc[s.semestre].push(s)
    return acc
  }, {})

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            Semestres & Délibérations
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Validation semestrielle LMD — crédits ECTS, mentions, jurys de délibération.
          </p>
        </div>
        <select value={filterAnnee}
          onChange={e => setFilterAnnee(e.target.value)}
          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none">
          {['2024-2025', '2025-2026', '2026-2027'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </motion.div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Inscrits',    value: etudiants.length,                                       color: '#2563EB' },
            { label: 'Validés',     value: semestres.filter(s => s.statut === 'valide').length,    color: '#16A34A' },
            { label: 'Ajournés',    value: semestres.filter(s => s.statut === 'ajourne').length,   color: '#DC2626' },
            { label: 'Rattrapage',  value: semestres.filter(s => s.statut === 'rattrapage').length,color: '#D97706' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border p-4"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
            </div>
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

      {/* Filtre statut */}
      <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1 flex-wrap">
        {(['tous', 'en_cours', 'valide', 'ajourne', 'rattrapage', 'abandonne'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatut(s)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: filterStatut === s ? (s === 'tous' ? '#0F172A' : STATUT_COLORS[s]) : 'transparent',
              color: filterStatut === s ? '#FFFFFF' : 'var(--text-secondary)',
            }}>
            {s === 'tous' ? 'Tous' : STATUT_LABELS[s]}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}>
          <GraduationCap size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucun semestre pour {filterAnnee}. Les semestres sont créés à l&apos;inscription des étudiants.
          </p>
          {etudiants.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Initialiser le semestre 1 pour tous les étudiants actifs ?
              </p>
              <button
                onClick={async () => {
                  for (const etu of etudiants) {
                    await initSemestre(etu.id, 1)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#DC2626' }}>
                Initialiser S1 — {etudiants.length} étudiant{etudiants.length > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([sem, items]) => {
              const key = `sem-${sem}`
              const isOpen = expanded.has(key)
              const validés = items.filter(s => s.statut === 'valide').length
              const total   = items.length
              return (
                <div key={sem} className="rounded-xl border overflow-hidden"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => toggleExpand(key)}
                    className="w-full flex items-center justify-between px-5 py-3.5 transition-colors"
                    style={{ borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(220,38,38,0.1)' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>S{sem}</span>
                      </div>
                      <div className="text-left">
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          Semestre {sem}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {total} dossier{total > 1 ? 's' : ''} · {validés} validé{validés > 1 ? 's' : ''} ({total > 0 ? Math.round(validés/total*100) : 0}%)
                        </p>
                      </div>
                    </div>
                    <ChevronDown size={16} style={{
                      color: 'var(--text-secondary)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s',
                    }} />
                  </button>

                  {isOpen && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {['Étudiant', 'Crédits', 'Moyenne', 'Mention', 'Statut', 'Délibérer'].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left"
                                style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((s, i) => (
                            <DelibRow key={s.id} s={s} onDeliberer={deliberer}
                              isLast={i === items.length - 1} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ── Deliberation row ───────────────────────────────────────────────────────────

function DelibRow({
  s, onDeliberer, isLast,
}: {
  s: SemestreEtudiant
  onDeliberer: (id: string, statut: SemestreEtudiant['statut'], mention: string) => void
  isLast: boolean
}) {
  const [newStatut, setNewStatut] = useState<SemestreEtudiant['statut']>(s.statut)
  const [newMention, setNewMention] = useState(s.mention ?? '')
  const [deliberating, setDeliberating] = useState(false)

  async function submit() {
    setDeliberating(true)
    await onDeliberer(s.id, newStatut, newMention)
    setDeliberating(false)
  }

  const nom = s.etudiants ? `${s.etudiants.prenom} ${s.etudiants.nom}` : '—'
  const numId = s.etudiants?.numero_id ?? '—'

  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
      className="transition-colors"
      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(220,38,38,0.02)'}
      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
      <td className="px-4 py-3">
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{nom}</p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{numId}</p>
      </td>
      <td className="px-4 py-3">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.credits_obtenus}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/{s.credits_requis}</span>
      </td>
      <td className="px-4 py-3" style={{ fontSize: 14, fontWeight: 700, color: s.moyenne !== null && s.moyenne >= 10 ? '#16A34A' : '#DC2626' }}>
        {s.moyenne !== null ? s.moyenne.toFixed(2) : '—'}
      </td>
      <td className="px-4 py-3" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        {s.mention ?? '—'}
      </td>
      <td className="px-4 py-3">
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: `${STATUT_COLORS[s.statut]}18`,
          color: STATUT_COLORS[s.statut],
        }}>
          {STATUT_LABELS[s.statut]}
        </span>
      </td>
      <td className="px-4 py-3">
        {s.statut === 'en_cours' || s.statut === 'rattrapage' ? (
          <div className="flex items-center gap-2">
            <select value={newStatut} onChange={e => setNewStatut(e.target.value as SemestreEtudiant['statut'])}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs focus:outline-none">
              {(['valide', 'ajourne', 'rattrapage'] as const).map(st => (
                <option key={st} value={st}>{STATUT_LABELS[st]}</option>
              ))}
            </select>
            <input value={newMention} onChange={e => setNewMention(e.target.value)}
              placeholder="Mention"
              className="w-24 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs focus:outline-none" />
            <button onClick={submit} disabled={deliberating}
              className="p-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}>
              {deliberating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {s.date_deliberation ? new Date(s.date_deliberation).toLocaleDateString('fr-FR') : 'Délibéré'}
          </span>
        )}
      </td>
    </tr>
  )
}
