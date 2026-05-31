'use client'
import { useLocale } from '@/lib/hooks/useLocale'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Check, Loader2, Printer, ChevronDown,
  BookOpenCheck, CalendarRange, FlaskConical, ScrollText,
  GraduationCap, Swords, X, Eye, ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  type Etudiant, type ClasseEcole, type Enseignant,
  type Subject, type SessionEcole, type Exam, type ExamGrade,
  type Attestation, type Diploma, type Defense,
  NIVEAUX, TYPES_EXAM, TYPES_ATTESTATION,
  STATUT_DIPLOME, STATUT_DEFENSE, MENTIONS_DIPLOME,
  calcExamMoyenne, getMention, printAttestation, printDiploma,
  fmt, FI, KpiCard, Avatar, EmptyState,
} from './shared'

// ── Shared sub-components ─────────────────────────────────────────────────────

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{children}</th>
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 text-sm ${className ?? ''}`}>{children}</td>
}
function FormCard({ children }: { children?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-[#DC2626]/20 p-4 space-y-3" style={{ background: 'rgba(240,163,10,0.04)' }}>
      {children}
    </motion.div>
  )
}

// ── SECTION MATIÈRES ─────────────────────────────────────────────────────────

export function SectionMatieres({ tenantId, enseignants }: { tenantId: string; enseignants: Enseignant[] }) {
  const { t } = useLocale()
  const [subjects,  setSubjects]  = useState<Subject[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState({ nom: '', code: '', coefficient: '1', niveau: '', enseignant_id: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('subjects').select('*').eq('tenant_id', tenantId).order('nom')
    setSubjects((data ?? []) as Subject[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.nom) return
    setSaving(true)
    const { error } = await supabase.from('subjects').insert({
      tenant_id:     tenantId,
      nom:           form.nom,
      code:          form.code || null,
      coefficient:   parseFloat(form.coefficient) || 1,
      niveau:        form.niveau || null,
      enseignant_id: form.enseignant_id || null,
    })
    if (!error) { load(); setShowForm(false); setForm({ nom: '', code: '', coefficient: '1', niveau: '', enseignant_id: '' }) }
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('Supprimer cette matière ?')) return
    await supabase.from('subjects').delete().eq('id', id)
    setSubjects(p => p.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <KpiCard label="Matières cataloguées" value={subjects.length} color="#DC2626" />
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white">
          <Plus size={13} /> Ajouter une matière
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <FormCard>
            <p className="text-xs font-bold text-[#DC2626]">Nouvelle matière</p>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Nom de la matière *" value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} placeholder="Mathématiques, Français…" />
              <FI label="Code (optionnel)" value={form.code} onChange={v => setForm(p => ({ ...p, code: v }))} placeholder="MATH101" />
              <FI label="Coefficient" value={form.coefficient} onChange={v => setForm(p => ({ ...p, coefficient: v }))} type="number" />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Niveau</label>
                <select value={form.niveau} onChange={e => setForm(p => ({ ...p, niveau: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">Tous niveaux</option>
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Enseignant responsable</label>
                <select value={form.enseignant_id} onChange={e => setForm(p => ({ ...p, enseignant_id: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Aucun —</option>
                  {enseignants.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} {e.matiere ? `(${e.matiere})` : ''}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.nom} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[var(--primary)] text-white disabled:opacity-40">
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </FormCard>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={20} /></div>
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpenCheck} message="Aucune matière enregistrée." />
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead><tr style={{ background: '#FFFFFF' }}><Th>Matière</Th><Th>Code</Th><Th>Niveau</Th><Th>Coeff.</Th><Th>Enseignant</Th><Th></Th></tr></thead>
            <tbody>
              {subjects.map(s => {
                const ens = enseignants.find(e => e.id === s.enseignant_id)
                return (
                  <tr key={s.id} className="border-t border-[var(--border)] hover:bg-gray-50">
                    <Td><span className="font-medium text-[#101729]">{s.nom}</span></Td>
                    <Td><span className="text-[10px] font-mono bg-[var(--surface)] px-2 py-0.5 rounded text-[#DC2626]">{s.code ?? '—'}</span></Td>
                    <Td className="text-[var(--text-secondary)]">{NIVEAUX.find(n => n.value === s.niveau)?.label ?? 'Tous'}</Td>
                    <Td className="font-bold text-[#DC2626]">{s.coefficient}</Td>
                    <Td className="text-[var(--text-secondary)]">{ens ? `${ens.prenom} ${ens.nom}` : '—'}</Td>
                    <Td><button onClick={() => del(s.id)} className="text-[var(--text-secondary)] hover:text-red-400 transition-colors"><Trash2 size={12} /></button></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── SECTION SESSIONS ─────────────────────────────────────────────────────────

const SESSION_TYPES: { value: SessionEcole['type']; label: string }[] = [
  { value: 'trimestre1', label: 'Trimestre 1' },
  { value: 'trimestre2', label: 'Trimestre 2' },
  { value: 'trimestre3', label: 'Trimestre 3' },
  { value: 'semestre1',  label: 'Semestre 1' },
  { value: 'semestre2',  label: 'Semestre 2' },
  { value: 'annuel',     label: 'Annuel' },
]

export function SectionSessions({ tenantId }: { tenantId: string }) {
  const { t } = useLocale()
  const [sessions, setSessions] = useState<SessionEcole[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const year = new Date().getFullYear()
  const [form, setForm] = useState({ nom: '', type: 'trimestre1' as SessionEcole['type'], annee_scolaire: `${year}-${year + 1}`, date_debut: '', date_fin: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sessions_ecole').select('*').eq('tenant_id', tenantId).order('date_debut', { ascending: false })
    setSessions((data ?? []) as SessionEcole[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.nom || !form.date_debut || !form.date_fin) return
    setSaving(true)
    await supabase.from('sessions_ecole').insert({ tenant_id: tenantId, ...form })
    load(); setShowForm(false); setSaving(false)
  }

  async function updateStatut(id: string, statut: SessionEcole['statut']) {
    await supabase.from('sessions_ecole').update({ statut }).eq('id', id)
    setSessions(p => p.map(s => s.id === id ? { ...s, statut } : s))
  }

  const STATUT_CFG = {
    en_cours: { label: 'En cours', color: '#0F172A', bg: '#0F172A18' },
    cloture:  { label: 'Clôturée', color: '#DC2626', bg: '#DC262618' },
    archive:  { label: 'Archivée', color: '#64748B', bg: '#48445818' },
  } as const

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <KpiCard label="Sessions actives" value={sessions.filter(s => s.statut === 'en_cours').length} color="#0F172A" />
          <KpiCard label="Total sessions" value={sessions.length} color="#DC2626" />
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white">
          <Plus size={13} /> Nouvelle session
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <FormCard>
            <p className="text-xs font-bold text-[#DC2626]">Nouvelle session d'examen</p>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Nom de la session *" value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} placeholder="Trimestre 1 – 2024-2025" />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.type')}</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as SessionEcole['type'] }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  {SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <FI label="Année scolaire *" value={form.annee_scolaire} onChange={v => setForm(p => ({ ...p, annee_scolaire: v }))} placeholder="2024-2025" />
              <div />
              <FI label="Date début *" value={form.date_debut} onChange={v => setForm(p => ({ ...p, date_debut: v }))} type="date" />
              <FI label="Date fin *" value={form.date_fin} onChange={v => setForm(p => ({ ...p, date_fin: v }))} type="date" />
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.nom || !form.date_debut || !form.date_fin} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[var(--primary)] text-white disabled:opacity-40">
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Créer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </FormCard>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={20} /></div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={CalendarRange} message="Aucune session créée." />
      ) : (
        <div className="space-y-2">
          {sessions.map(s => {
            const cfg = STATUT_CFG[s.statut]
            return (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[var(--border)]" style={{ background: '#FFFFFF' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#101729]">{s.nom}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {SESSION_TYPES.find(t => t.value === s.type)?.label} · {s.annee_scolaire} ·{' '}
                    {new Date(s.date_debut).toLocaleDateString('fr-FR')} → {new Date(s.date_fin).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                {s.statut === 'en_cours' && (
                  <button onClick={() => updateStatut(s.id, 'cloture')} className="text-[10px] px-2 py-1 rounded-lg border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors shrink-0">
                    Clôturer
                  </button>
                )}
                {s.statut === 'cloture' && (
                  <button onClick={() => updateStatut(s.id, 'archive')} className="text-[10px] px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 transition-colors shrink-0">
                    Archiver
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── SECTION EXAMENS & NOTES ──────────────────────────────────────────────────

export function SectionExamens({ tenantId, etudiants, classes }: {
  tenantId: string; etudiants: Etudiant[]; classes: ClasseEcole[]
}) {
  const { t } = useLocale()
  const [sessions, setSessions] = useState<SessionEcole[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams,    setExams]    = useState<Exam[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [activeExam, setActiveExam] = useState<Exam | null>(null)
  const [grades,     setGrades]    = useState<ExamGrade[]>([])
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({})
  const [savingGrades, setSavingGrades] = useState(false)

  const [form, setForm] = useState({
    session_id: '', classe_id: '', subject_id: '', nom: '',
    type_exam: 'composition' as Exam['type_exam'], date_exam: '', note_max: '20', coefficient: '1',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: ses }, { data: sub }, { data: ex }] = await Promise.all([
      supabase.from('sessions_ecole').select('*').eq('tenant_id', tenantId).order('date_debut', { ascending: false }),
      supabase.from('subjects').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('exams').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    ])
    setSessions((ses ?? []) as SessionEcole[])
    setSubjects((sub ?? []) as Subject[])
    setExams((ex ?? []) as Exam[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function saveExam() {
    if (!form.nom) return
    setSaving(true)
    await supabase.from('exams').insert({
      tenant_id:  tenantId,
      session_id: form.session_id || null,
      classe_id:  form.classe_id  || null,
      subject_id: form.subject_id || null,
      nom:        form.nom,
      type_exam:  form.type_exam,
      date_exam:  form.date_exam  || null,
      note_max:   parseFloat(form.note_max)   || 20,
      coefficient: parseFloat(form.coefficient) || 1,
    })
    load(); setShowForm(false); setSaving(false)
  }

  async function openExam(exam: Exam) {
    setActiveExam(exam)
    const { data } = await supabase.from('exam_grades').select('*').eq('exam_id', exam.id)
    const g = (data ?? []) as ExamGrade[]
    setGrades(g)
    const inputs: Record<string, string> = {}
    for (const gr of g) inputs[gr.etudiant_id] = gr.note !== null ? String(gr.note) : ''
    setGradeInputs(inputs)
  }

  async function saveGrades() {
    if (!activeExam) return
    setSavingGrades(true)
    const classe = classes.find(c => c.id === activeExam.classe_id)
    const classeEtudiants = classe
      ? etudiants.filter(e => e.classe === classe.nom || e.classe === classe.id)
      : etudiants

    const rows = classeEtudiants.map(e => ({
      tenant_id:   tenantId,
      exam_id:     activeExam.id,
      etudiant_id: e.id,
      note:        gradeInputs[e.id] !== undefined && gradeInputs[e.id] !== '' ? parseFloat(gradeInputs[e.id]) : null,
      absent:      gradeInputs[e.id] === 'ABS',
    }))

    await supabase.from('exam_grades').upsert(rows, { onConflict: 'exam_id,etudiant_id' })
    setSavingGrades(false)
  }

  const classeEtudiants = activeExam?.classe_id
    ? etudiants.filter(e => {
        const cl = classes.find(c => c.id === activeExam.classe_id)
        return cl && (e.classe === cl.nom || e.classe === cl.id)
      })
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <KpiCard label="Épreuves créées" value={exams.length} color="#7C3AED" />
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#ff7000] text-white">
          <Plus size={13} /> Nouvelle épreuve
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-[#7C3AED]/20 p-4 space-y-3" style={{ background: 'rgba(139,92,246,0.04)' }}>
            <p className="text-xs font-bold text-[#7C3AED]">Nouvelle épreuve</p>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Intitulé *" value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} placeholder="Composition de Mathématiques – T1" />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Type d'épreuve</label>
                <select value={form.type_exam} onChange={e => setForm(p => ({ ...p, type_exam: e.target.value as Exam['type_exam'] }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  {TYPES_EXAM.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Session</label>
                <select value={form.session_id} onChange={e => setForm(p => ({ ...p, session_id: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Aucune —</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Classe</label>
                <select value={form.classe_id} onChange={e => setForm(p => ({ ...p, classe_id: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Toutes —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Matière</label>
                <select value={form.subject_id} onChange={e => setForm(p => ({ ...p, subject_id: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Aucune —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <FI label="Date de l'épreuve" value={form.date_exam} onChange={v => setForm(p => ({ ...p, date_exam: v }))} type="date" />
              <FI label="Note max" value={form.note_max} onChange={v => setForm(p => ({ ...p, note_max: v }))} type="number" />
              <FI label="Coefficient" value={form.coefficient} onChange={v => setForm(p => ({ ...p, coefficient: v }))} type="number" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveExam} disabled={saving || !form.nom} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#ff7000] text-white disabled:opacity-40">
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Créer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Liste des épreuves */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={20} /></div>
          ) : exams.length === 0 ? (
            <EmptyState icon={FlaskConical} message="Aucune épreuve créée." />
          ) : (
            exams.map(ex => {
              const ses = sessions.find(s => s.id === ex.session_id)
              const sub = subjects.find(s => s.id === ex.subject_id)
              const cls = classes.find(c => c.id === ex.classe_id)
              const isActive = activeExam?.id === ex.id
              return (
                <button key={ex.id} onClick={() => openExam(ex)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isActive ? 'border-[#7C3AED]/40 bg-[#7C3AED]/08' : 'border-[var(--border)] hover:border-[#00b9a7]/40'}`}
                  style={{ background: isActive ? 'rgba(255,112,0,0.08)' : '#FFFFFF' }}>
                  <FlaskConical size={16} className="text-[#7C3AED] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#101729] truncate">{ex.nom}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {TYPES_EXAM.find(t => t.value === ex.type_exam)?.label}
                      {sub && ` · ${sub.nom}`}
                      {cls && ` · ${cls.nom}`}
                      {ses && ` · ${ses.nom}`}
                    </p>
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] shrink-0">/{ex.note_max} · coeff {ex.coefficient}</span>
                  <ChevronRight size={13} className="text-[var(--text-secondary)] shrink-0" />
                </button>
              )
            })
          )}
        </div>

        {/* Saisie des notes */}
        {activeExam ? (
          <div className="rounded-xl border border-[#7C3AED]/20 overflow-hidden" style={{ background: 'rgba(139,92,246,0.04)' }}>
            <div className="px-4 py-3 border-b border-[#7C3AED]/15 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#101729]">{activeExam.nom}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">Saisie des notes · /{activeExam.note_max}</p>
              </div>
              <button onClick={() => setActiveExam(null)} className="text-[var(--text-secondary)] hover:text-[#101729]"><X size={14} /></button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {classeEtudiants.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] text-center py-8">Sélectionnez une classe pour la saisie.</p>
              ) : (
                classeEtudiants.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--border)]">
                    <Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={28} />
                    <span className="text-sm text-[#101729] flex-1 truncate">{e.prenom} {e.nom}</span>
                    <input
                      type="number" min={0} max={activeExam.note_max} step={0.5}
                      value={gradeInputs[e.id] ?? ''}
                      onChange={ev => setGradeInputs(p => ({ ...p, [e.id]: ev.target.value }))}
                      placeholder="—"
                      className="w-16 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-[#101729] text-center focus:outline-none focus:border-[#00b9a7]"
                    />
                  </div>
                ))
              )}
            </div>
            {classeEtudiants.length > 0 && (
              <div className="px-4 py-3 border-t border-[#7C3AED]/15">
                <button onClick={saveGrades} disabled={savingGrades} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-[#ff7000] text-white disabled:opacity-40">
                  {savingGrades ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Enregistrer les notes
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] py-12 text-center" style={{ background: '#F9FAFB' }}>
            <Eye size={24} className="text-[var(--text-secondary)] opacity-20 mb-3" />
            <p className="text-xs text-[var(--text-secondary)]">Cliquez sur une épreuve pour saisir les notes</p>
          </div>
        )}
      </div>

      {/* Synthèse des moyennes par session */}
      {sessions.filter(s => s.statut === 'en_cours').length > 0 && (
        <MoyennesSynthese tenantId={tenantId} sessions={sessions.filter(s => s.statut !== 'archive')} exams={exams} etudiants={etudiants} />
      )}
    </div>
  )
}

// ── Synthèse moyennes ─────────────────────────────────────────────────────────

function MoyennesSynthese({ tenantId, sessions, exams, etudiants }: {
  tenantId: string; sessions: SessionEcole[]; exams: Exam[]; etudiants: Etudiant[]
}) {
  const [open,    setOpen]    = useState(false)
  const [selSes,  setSelSes]  = useState(sessions[0]?.id ?? '')
  const [grades,  setGrades]  = useState<ExamGrade[]>([])
  const [loading, setLoading] = useState(false)

  async function loadGrades(sessionId: string) {
    setLoading(true)
    const sessionExams = exams.filter(e => e.session_id === sessionId)
    if (sessionExams.length === 0) { setGrades([]); setLoading(false); return }
    const { data } = await supabase.from('exam_grades').select('*').in('exam_id', sessionExams.map(e => e.id))
    setGrades((data ?? []) as ExamGrade[])
    setLoading(false)
  }

  const sessionExams = exams.filter(e => e.session_id === selSes)
  const moyennesEtu  = etudiants.map(e => {
    const eGrades = grades.filter(g => g.etudiant_id === e.id)
    const moy     = calcExamMoyenne(eGrades, sessionExams)
    return { etudiant: e, moy }
  }).filter(x => x.moy !== null).sort((a, b) => (b.moy ?? 0) - (a.moy ?? 0))

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: '#FFFFFF' }}>
      <button onClick={() => { setOpen(v => !v); if (!open) loadGrades(selSes) }}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold text-[#101729] flex items-center gap-2">
          <BarChart2 size={14} className="text-[#DC2626]" /> Synthèse des moyennes par session
        </span>
        <ChevronDown size={14} className={`text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[var(--border)]">
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Session</label>
                <select value={selSes} onChange={e => { setSelSes(e.target.value); loadGrades(e.target.value) }}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              {loading ? <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[var(--text-secondary)]" /></div>
              : moyennesEtu.length === 0 ? <p className="text-xs text-[var(--text-secondary)] text-center py-4">Aucune note saisie pour cette session.</p>
              : (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr style={{ background: '#FFFFFF' }}><Th>Rang</Th><Th>Étudiant</Th><Th>Moyenne /20</Th><Th>Mention</Th></tr></thead>
                    <tbody>
                      {moyennesEtu.map(({ etudiant: e, moy }, i) => {
                        const mention = getMention(moy!)
                        return (
                          <tr key={e.id} className="border-t border-[var(--border)]">
                            <Td><span className="font-bold text-[#DC2626]">#{i + 1}</span></Td>
                            <Td><div className="flex items-center gap-2"><Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={24} /><span className="text-[#101729]">{e.prenom} {e.nom}</span></div></Td>
                            <Td><span className="font-bold text-lg" style={{ color: mention.color }}>{moy!.toFixed(2)}</span></Td>
                            <Td><span className="text-xs font-semibold" style={{ color: mention.color }}>{mention.label}</span></Td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

 
function BarChart2({ size, className }: { size?: number; className?: string }) {
  return <svg width={size ?? 16} height={size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
}

// ── SECTION ATTESTATIONS ─────────────────────────────────────────────────────

export function SectionAttestations({ tenantId, etudiants, nomEcole }: {
  tenantId: string; etudiants: Etudiant[]; nomEcole: string
}) {
  const { t } = useLocale()
  const [attestations, setAttestations] = useState<Attestation[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const year = new Date().getFullYear()
  const [form, setForm] = useState({
    etudiant_id: '', type_attestation: 'scolarite' as Attestation['type_attestation'],
    annee_scolaire: `${year}-${year + 1}`, motif: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('attestations').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setAttestations((data ?? []) as Attestation[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.etudiant_id || !form.type_attestation) return
    setSaving(true)
    const { data } = await supabase.from('attestations').insert({
      tenant_id:        tenantId,
      etudiant_id:      form.etudiant_id,
      type_attestation: form.type_attestation,
      annee_scolaire:   form.annee_scolaire || null,
      motif:            form.motif || null,
    }).select().single()
    if (data) setAttestations(p => [data as Attestation, ...p])
    setShowForm(false); setSaving(false)
  }

  function print(a: Attestation) {
    const e = etudiants.find(et => et.id === a.etudiant_id)
    if (e) printAttestation(e, a, nomEcole)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <KpiCard label="Attestations émises" value={attestations.length} color="#0F172A" />
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#0F172A', color: '#0F172A' }}>
          <Plus size={13} /> Émettre une attestation
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-[#0F172A]/20 p-4 space-y-3" style={{ background: 'rgba(6,182,212,0.04)' }}>
            <p className="text-xs font-bold text-[#DC2626]">Nouvelle attestation</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Étudiant *</label>
                <select value={form.etudiant_id} onChange={e => setForm(p => ({ ...p, etudiant_id: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Choisir —</option>
                  {etudiants.filter(e => e.statut === 'actif').map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.numero_id})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Type *</label>
                <select value={form.type_attestation} onChange={e => setForm(p => ({ ...p, type_attestation: e.target.value as Attestation['type_attestation'] }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  {TYPES_ATTESTATION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <FI label="Année scolaire" value={form.annee_scolaire} onChange={v => setForm(p => ({ ...p, annee_scolaire: v }))} />
              <FI label="Motif / observations" value={form.motif} onChange={v => setForm(p => ({ ...p, motif: v }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.etudiant_id} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#0F172A', color: '#0F172A' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <ScrollText size={12} />} Émettre
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={20} /></div>
      ) : attestations.length === 0 ? (
        <EmptyState icon={ScrollText} message="Aucune attestation émise." />
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead><tr style={{ background: '#FFFFFF' }}><Th>Étudiant</Th><Th>{t('common.type')}</Th><Th>Réf.</Th><Th>{t('common.year')}</Th><Th>{t('common.date')}</Th><Th></Th></tr></thead>
            <tbody>
              {attestations.map(a => {
                const e = etudiants.find(et => et.id === a.etudiant_id)
                return (
                  <tr key={a.id} className="border-t border-[var(--border)] hover:bg-gray-50">
                    <Td>{e ? <div className="flex items-center gap-2"><Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={24} /><span className="text-[#101729]">{e.prenom} {e.nom}</span></div> : <span className="text-[var(--text-secondary)]">—</span>}</Td>
                    <Td className="text-[#DC2626] text-[11px]">{TYPES_ATTESTATION.find(t => t.value === a.type_attestation)?.label}</Td>
                    <Td><span className="text-[10px] font-mono text-[var(--text-secondary)]">{a.numero_ref ?? '—'}</span></Td>
                    <Td className="text-[var(--text-secondary)]">{a.annee_scolaire ?? '—'}</Td>
                    <Td className="text-[var(--text-secondary)]">{new Date(a.date_emission).toLocaleDateString('fr-FR')}</Td>
                    <Td>
                      <button onClick={() => print(a)} className="text-[var(--text-secondary)] hover:text-[#DC2626] transition-colors" title={t('common.print')}>
                        <Printer size={13} />
                      </button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── SECTION DIPLÔMES (Direction) ─────────────────────────────────────────────

export function SectionDiplomes({ tenantId, etudiants, nomEcole }: {
  tenantId: string; etudiants: Etudiant[]; nomEcole: string
}) {
  const { t } = useLocale()
  const [diplomas, setDiplomas] = useState<Diploma[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    etudiant_id: '', type_diplome: '', mention: '' as string,
    annee_obtention: String(new Date().getFullYear()), observations: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('diplomas').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setDiplomas((data ?? []) as Diploma[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.etudiant_id || !form.type_diplome || !form.annee_obtention) return
    setSaving(true)
    await supabase.from('diplomas').insert({
      tenant_id:       tenantId,
      etudiant_id:     form.etudiant_id,
      type_diplome:    form.type_diplome,
      mention:         form.mention || null,
      annee_obtention: parseInt(form.annee_obtention),
      observations:    form.observations || null,
    })
    load(); setShowForm(false); setSaving(false)
  }

  async function updateStatut(id: string, statut: Diploma['statut']) {
    await supabase.from('diplomas').update({ statut }).eq('id', id)
    setDiplomas(p => p.map(d => d.id === id ? { ...d, statut } : d))
    // Mark student as diplômé when delivered
    if (statut === 'delivre') {
      const dip = diplomas.find(d => d.id === id)
      if (dip) await supabase.from('etudiants').update({ statut: 'diplome' }).eq('id', dip.etudiant_id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <KpiCard label="Diplômes émis" value={diplomas.filter(d => d.statut === 'delivre').length} color="#7C3AED" />
          <KpiCard label="En attente" value={diplomas.filter(d => d.statut === 'en_attente').length} color="#DC2626" />
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#ff7000] text-white">
          <Plus size={13} /> Créer un diplôme
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-[#7C3AED]/20 p-4 space-y-3" style={{ background: 'rgba(139,92,246,0.04)' }}>
            <p className="text-xs font-bold text-[#7C3AED]">Nouveau diplôme</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Étudiant *</label>
                <select value={form.etudiant_id} onChange={e => setForm(p => ({ ...p, etudiant_id: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Choisir —</option>
                  {etudiants.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.numero_id})</option>)}
                </select>
              </div>
              <FI label="Type de diplôme *" value={form.type_diplome} onChange={v => setForm(p => ({ ...p, type_diplome: v }))} placeholder="Licence, Master, BTS, Baccalauréat…" />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Mention</label>
                <select value={form.mention} onChange={e => setForm(p => ({ ...p, mention: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Sans mention —</option>
                  {MENTIONS_DIPLOME.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <FI label="Année d'obtention *" value={form.annee_obtention} onChange={v => setForm(p => ({ ...p, annee_obtention: v }))} type="number" />
              <div className="col-span-2">
                <FI label="Observations" value={form.observations} onChange={v => setForm(p => ({ ...p, observations: v }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.etudiant_id || !form.type_diplome} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#ff7000] text-white disabled:opacity-40">
                {saving ? <Loader2 className="animate-spin" size={12} /> : <GraduationCap size={12} />} Créer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={20} /></div>
      ) : diplomas.length === 0 ? (
        <EmptyState icon={GraduationCap} message="Aucun diplôme émis." />
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead><tr style={{ background: '#FFFFFF' }}><Th>Étudiant</Th><Th>Diplôme</Th><Th>Mention</Th><Th>{t('common.year')}</Th><Th>{t('common.status')}</Th><Th>{t('common.actions')}</Th></tr></thead>
            <tbody>
              {diplomas.map(d => {
                const e   = etudiants.find(et => et.id === d.etudiant_id)
                const cfg = STATUT_DIPLOME[d.statut]
                const men = MENTIONS_DIPLOME.find(m => m.value === d.mention)
                return (
                  <tr key={d.id} className="border-t border-[var(--border)] hover:bg-gray-50">
                    <Td>{e ? <div className="flex items-center gap-2"><Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={24} /><span className="text-[#101729]">{e.prenom} {e.nom}</span></div> : '—'}</Td>
                    <Td className="font-medium text-[#101729]">{d.type_diplome}</Td>
                    <Td>{men ? <span className="text-xs font-semibold" style={{ color: men.color }}>{men.label}</span> : <span className="text-[var(--text-secondary)]">—</span>}</Td>
                    <Td className="text-[var(--text-secondary)]">{d.annee_obtention}</Td>
                    <Td><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {d.statut === 'en_attente' && (
                          <button onClick={() => updateStatut(d.id, 'valide')} className="text-[10px] px-2 py-0.5 rounded border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors">{t('common.validate')}</button>
                        )}
                        {d.statut === 'valide' && (
                          <button onClick={() => updateStatut(d.id, 'delivre')} className="text-[10px] px-2 py-0.5 rounded border border-[#0F172A]/30 text-[#DC2626] hover:bg-[var(--surface)]/10 transition-colors">Délivrer</button>
                        )}
                        {e && <button onClick={() => printDiploma(e, d, nomEcole)} className="text-[var(--text-secondary)] hover:text-[#7C3AED] transition-colors" title={t('common.print')}><Printer size={12} /></button>}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── SECTION SOUTENANCES (Direction) ──────────────────────────────────────────

export function SectionSoutenances({ tenantId, etudiants }: { tenantId: string; etudiants: Etudiant[] }) {
  const { t } = useLocale()
  const [defenses, setDefenses] = useState<Defense[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [editNote, setEditNote] = useState<{ id: string; note: string; mention: string } | null>(null)
  const [form, setForm] = useState({
    etudiant_id: '', titre_memoire: '', date_soutenance: '', salle: '',
    directeur_memoire: '', membres_jury: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('defenses').select('*').eq('tenant_id', tenantId).order('date_soutenance')
    setDefenses((data ?? []) as Defense[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.etudiant_id || !form.titre_memoire || !form.date_soutenance) return
    setSaving(true)
    await supabase.from('defenses').insert({
      tenant_id:         tenantId,
      etudiant_id:       form.etudiant_id,
      titre_memoire:     form.titre_memoire,
      date_soutenance:   form.date_soutenance,
      salle:             form.salle             || null,
      directeur_memoire: form.directeur_memoire || null,
      membres_jury:      form.membres_jury      || null,
    })
    load(); setShowForm(false); setSaving(false)
    setForm({ etudiant_id: '', titre_memoire: '', date_soutenance: '', salle: '', directeur_memoire: '', membres_jury: '' })
  }

  async function updateStatut(id: string, statut: Defense['statut']) {
    await supabase.from('defenses').update({ statut }).eq('id', id)
    setDefenses(p => p.map(d => d.id === id ? { ...d, statut } : d))
  }

  async function saveNote() {
    if (!editNote) return
    const note    = parseFloat(editNote.note) || null
    const mention = editNote.mention || null
    await supabase.from('defenses').update({ note_finale: note, mention, statut: 'passe' }).eq('id', editNote.id)
    setDefenses(p => p.map(d => d.id === editNote.id ? { ...d, note_finale: note, mention, statut: 'passe' } : d))
    setEditNote(null)
  }

  const upcoming = defenses.filter(d => ['planifie', 'en_cours'].includes(d.statut))
  const past     = defenses.filter(d => ['passe', 'reporte', 'annule'].includes(d.statut))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <KpiCard label="Soutenances à venir" value={upcoming.length} color="#DC2626" />
          <KpiCard label="Passées" value={past.filter(d => d.statut === 'passe').length} color="#0F172A" />
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#DC2626] text-white">
          <Plus size={13} /> Planifier une soutenance
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-[#DC2626]/20 p-4 space-y-3" style={{ background: 'rgba(56,139,253,0.04)' }}>
            <p className="text-xs font-bold text-[#DC2626]">Planifier une soutenance</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Étudiant *</label>
                <select value={form.etudiant_id} onChange={e => setForm(p => ({ ...p, etudiant_id: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Choisir —</option>
                  {etudiants.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.numero_id})</option>)}
                </select>
              </div>
              <FI label="Date & heure *" value={form.date_soutenance} onChange={v => setForm(p => ({ ...p, date_soutenance: v }))} type="datetime-local" />
              <div className="col-span-2">
                <FI label="Titre du mémoire *" value={form.titre_memoire} onChange={v => setForm(p => ({ ...p, titre_memoire: v }))} placeholder="Titre complet du mémoire ou projet de fin d'études" />
              </div>
              <FI label="Salle" value={form.salle} onChange={v => setForm(p => ({ ...p, salle: v }))} placeholder="Amphi A, Salle 102…" />
              <FI label="Directeur du mémoire" value={form.directeur_memoire} onChange={v => setForm(p => ({ ...p, directeur_memoire: v }))} />
              <div className="col-span-2">
                <FI label="Membres du jury" value={form.membres_jury} onChange={v => setForm(p => ({ ...p, membres_jury: v }))} placeholder="Pr. Dupont, Dr. Martin, Ing. Kabila…" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.etudiant_id || !form.titre_memoire || !form.date_soutenance} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#DC2626] text-white disabled:opacity-40">
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Swords size={12} />} Planifier
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saisie de note */}
      <AnimatePresence>
        {editNote && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditNote(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-80 space-y-4">
              <h3 className="text-sm font-bold text-[#101729]">Résultat de soutenance</h3>
              <FI label="Note finale /20" value={editNote.note} onChange={v => setEditNote(p => p ? { ...p, note: v } : null)} type="number" />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Mention</label>
                <select value={editNote.mention} onChange={e => setEditNote(p => p ? { ...p, mention: e.target.value } : null)} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">— Sans mention —</option>
                  {MENTIONS_DIPLOME.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={saveNote} className="flex-1 py-2 rounded-lg bg-[#DC2626] text-white text-xs font-semibold flex items-center justify-center gap-1"><Check size={12} /> Valider</button>
                <button onClick={() => setEditNote(null)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-xs">{t('common.cancel')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={20} /></div>
      ) : defenses.length === 0 ? (
        <EmptyState icon={Swords} message="Aucune soutenance planifiée." />
      ) : (
        <div className="space-y-2">
          {[...upcoming, ...past].map(d => {
            const e   = etudiants.find(et => et.id === d.etudiant_id)
            const cfg = STATUT_DEFENSE[d.statut]
            const men = MENTIONS_DIPLOME.find(m => m.value === d.mention)
            return (
              <div key={d.id} className="rounded-xl border border-[var(--border)] p-4" style={{ background: '#FFFFFF' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                      {men && <span className="text-[10px] font-semibold" style={{ color: men.color }}>{men.label}</span>}
                      {d.note_finale !== null && <span className="text-[10px] text-[var(--text-secondary)]">Note : {d.note_finale}/20</span>}
                    </div>
                    <p className="text-sm font-semibold text-[#101729] truncate">{d.titre_memoire}</p>
                    {e && (
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={20} />
                        <span className="text-xs text-[var(--text-secondary)]">{e.prenom} {e.nom}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-1.5 flex-wrap text-[10px] text-[var(--text-secondary)]">
                      <span>📅 {new Date(d.date_soutenance).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {d.salle             && <span>📍 {d.salle}</span>}
                      {d.directeur_memoire && <span>👨‍🏫 Dir. : {d.directeur_memoire}</span>}
                      {d.membres_jury      && <span>👥 Jury : {d.membres_jury}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {d.statut === 'planifie' && (
                      <>
                        <button onClick={() => updateStatut(d.id, 'en_cours')} className="text-[10px] px-2 py-1 rounded border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors">Démarrer</button>
                        <button onClick={() => updateStatut(d.id, 'reporte')} className="text-[10px] px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 transition-colors">Reporter</button>
                      </>
                    )}
                    {d.statut === 'en_cours' && (
                      <button onClick={() => setEditNote({ id: d.id, note: '', mention: '' })} className="text-[10px] px-2 py-1 rounded border border-[#0F172A]/30 text-[#DC2626] hover:bg-[var(--surface)]/10 transition-colors">Saisir résultat</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
