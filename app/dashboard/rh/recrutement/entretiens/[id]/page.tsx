'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Loader2, Brain, ChevronLeft, User, Briefcase, Calendar,
  Star, CheckCircle, AlertTriangle, XCircle, Send, FileText,
} from 'lucide-react'

interface QuestionsEntretien {
  questions_generales: string[]
  questions_techniques: string[]
  cas_pratiques: string[]
  tests_metier: string[]
  criteres_evaluation: { communication: string; technique: string; leadership: string }
}

interface PredictionPerformance {
  potentiel_reussite: number
  risque_depart_12mois: number
  risque_echec_essai: number
  niveau_adaptation: 'Élevé' | 'Moyen' | 'Faible'
  recommandation: 'Embaucher' | "Liste d'attente" | 'Rejeter'
  justification: string
}

interface EntretienDetail {
  id: string
  statut: string
  date_entretien: string | null
  note_finale: number | null
  notes: string | null
  questions_ia: QuestionsEntretien | null
  evaluation: Record<string, number> | null
  rapport_prediction: PredictionPerformance | null
  candidature_id: string
  candidatures: {
    candidats: {
      id: string; nom: string | null; prenom: string | null; email: string | null
      score_global: number; competences: string[] | null; diplomes: string[] | null
      langues: string[] | null; annees_experience: number | null; niveau_etudes: string | null; cv_url: string | null
    } | null
    offres_emploi: { id: string; titre: string | null } | null
  } | null
}

const CRITERES = [
  { key: 'communication', label: 'Communication', color: '#2563EB' },
  { key: 'technique',     label: 'Technique',     color: '#16A34A' },
  { key: 'leadership',    label: 'Leadership',    color: '#8B5CF6' },
  { key: 'initiative',    label: 'Initiative',    color: '#F59E0B' },
  { key: 'culture_fit',   label: 'Fit culturel',  color: '#DC2626' },
]

const RECO_CFG: Record<string, { bg: string; color: string; icon: typeof CheckCircle }> = {
  'Embaucher':      { bg: '#F0FDF4', color: '#16A34A', icon: CheckCircle },
  "Liste d'attente":{ bg: '#FFFBEB', color: '#F59E0B', icon: AlertTriangle },
  'Rejeter':        { bg: '#FEF2F2', color: '#DC2626', icon: XCircle },
}

const ADAPT_COLORS = { 'Élevé': '#16A34A', 'Moyen': '#F59E0B', 'Faible': '#DC2626' }

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value * 10}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-5 text-right" style={{ color }}>{value}</span>
    </div>
  )
}

export default function EntretienDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [entretien, setEntretien] = useState<EntretienDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [globalNotes, setGlobalNotes] = useState('')
  const [evaluation, setEvaluation] = useState<Record<string, number>>({
    communication: 5, technique: 5, leadership: 5, initiative: 5, culture_fit: 5,
  })
  const [prediction, setPrediction] = useState<PredictionPerformance | null>(null)
  const [scoreEntretien, setScoreEntretien] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/jobs/entretien?entretienId=${id}`)
    if (!res.ok) { setLoading(false); return }
    const { entretien: data } = await res.json() as { entretien: EntretienDetail }
    setEntretien(data)
    if (data.evaluation) setEvaluation(data.evaluation as Record<string, number>)
    if (data.rapport_prediction) setPrediction(data.rapport_prediction)
    if (data.notes) setGlobalNotes(data.notes)
    setLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])

  async function generateQuestions() {
    setGenerating(true)
    const res = await fetch('/api/jobs/entretien', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entretienId: id }),
    })
    const data = await res.json() as { questions?: QuestionsEntretien; error?: string }
    if (data.questions && entretien) {
      setEntretien({ ...entretien, questions_ia: data.questions, statut: 'en_cours' })
    }
    setGenerating(false)
  }

  async function terminer() {
    setSaving(true)
    const res = await fetch('/api/jobs/entretien', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entretienId: id, evaluation, notes: globalNotes }),
    })
    const data = await res.json() as { prediction?: PredictionPerformance; scoreEntretien?: number; error?: string }
    if (data.prediction) {
      setPrediction(data.prediction)
      setScoreEntretien(data.scoreEntretien ?? null)
      if (entretien) setEntretien({ ...entretien, statut: 'termine' })
    }
    setSaving(false)
  }

  const scoreEntretienCalc = Math.round(
    Object.values(evaluation).reduce((s, v) => s + v, 0) / Object.values(evaluation).length * 10
  )

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  if (!entretien) return (
    <div className="text-center py-24 text-[#94A3B8]">
      <p className="text-sm">Entretien introuvable.</p>
    </div>
  )

  const cand = entretien.candidatures?.candidats
  const offre = entretien.candidatures?.offres_emploi
  const nomCandidatFull = cand ? [cand.prenom, cand.nom].filter(Boolean).join(' ') || cand.email || 'Candidat' : 'Candidat'
  const questions = entretien.questions_ia
  const isTermine = entretien.statut === 'termine'

  const recoInfo = prediction ? RECO_CFG[prediction.recommandation] : null
  const RecoIcon = recoInfo?.icon ?? CheckCircle

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg transition-colors">
          <ChevronLeft size={16} className="text-[#64748B]" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-[#0F172A]">Entretien IA — {nomCandidatFull}</h1>
          <p className="text-xs text-[#64748B]">
            {offre?.titre ?? 'Offre inconnue'}
            {entretien.date_entretien && ` · ${new Date(entretien.date_entretien).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
          isTermine ? 'bg-green-100 text-green-700' :
          entretien.statut === 'en_cours' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {isTermine ? 'Terminé' : entretien.statut === 'en_cours' ? 'En cours' : 'Planifié'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── LEFT: Fiche + Questions ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Fiche candidat */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#E09000] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {[(cand?.prenom ?? '').charAt(0), (cand?.nom ?? '').charAt(0)].filter(Boolean).join('').toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#0F172A]">{nomCandidatFull}</p>
                <p className="text-xs text-[#64748B]">{cand?.email ?? '—'}</p>
              </div>
              <div className="text-right shrink-0">
                {(cand?.score_global ?? 0) > 0 && (
                  <p className="text-lg font-extrabold" style={{
                    color: (cand?.score_global ?? 0) >= 70 ? '#16A34A' : (cand?.score_global ?? 0) >= 50 ? '#F59E0B' : '#DC2626'
                  }}>{cand?.score_global ?? 0}</p>
                )}
                <p className="text-[10px] text-[#94A3B8]">score CV</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-[#F1F5F9]">
              <div className="flex items-center gap-1.5">
                <Briefcase size={11} className="text-[#94A3B8]" />
                <p className="text-[10px] text-[#64748B]">{cand?.annees_experience ?? 0} an{(cand?.annees_experience ?? 0) > 1 ? 's' : ''} exp.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <User size={11} className="text-[#94A3B8]" />
                <p className="text-[10px] text-[#64748B] truncate">{cand?.niveau_etudes ?? 'N/A'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Star size={11} className="text-[#94A3B8]" />
                <p className="text-[10px] text-[#64748B] truncate">{(cand?.langues ?? []).join(', ') || 'N/A'}</p>
              </div>
            </div>
            {(cand?.competences ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {(cand?.competences ?? []).slice(0, 6).map(c => (
                  <span key={c} className="text-[9px] bg-[#FEF3C7] text-[#92400E] px-1.5 py-0.5 rounded-full border border-[#F59E0B]/20">{c}</span>
                ))}
              </div>
            )}
          </div>

          {/* Generate button / Questions */}
          {!questions ? (
            <div className="bg-white border border-dashed border-[#E2E8F0] rounded-xl p-8 text-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Brain size={22} className="text-white" />
              </div>
              <p className="text-sm font-bold text-[#0F172A] mb-1">Questions d&apos;entretien IA</p>
              <p className="text-xs text-[#64748B] mb-5">MIAA+ va générer des questions personnalisées basées sur le profil du candidat et le poste.</p>
              <button onClick={generateQuestions} disabled={generating}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold mx-auto hover:opacity-90 transition-opacity shadow-md disabled:opacity-60">
                {generating ? <><Loader2 size={15} className="animate-spin" /> Génération en cours...</> : <><Brain size={15} /> Générer les questions IA</>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Questions générales */}
              <QuestionsSection
                title="Questions générales"
                questions={questions.questions_generales}
                color="#2563EB"
                prefix="g"
                notes={notes}
                onNote={(k, v) => setNotes(n => ({ ...n, [k]: v }))}
                disabled={isTermine}
              />
              {/* Questions techniques */}
              <QuestionsSection
                title="Questions techniques"
                questions={questions.questions_techniques}
                color="#16A34A"
                prefix="t"
                notes={notes}
                onNote={(k, v) => setNotes(n => ({ ...n, [k]: v }))}
                disabled={isTermine}
              />
              {/* Cas pratiques */}
              <QuestionsSection
                title="Cas pratiques"
                questions={questions.cas_pratiques}
                color="#8B5CF6"
                prefix="c"
                notes={notes}
                onNote={(k, v) => setNotes(n => ({ ...n, [k]: v }))}
                disabled={isTermine}
              />
              {/* Tests métier */}
              <QuestionsSection
                title="Tests métier"
                questions={questions.tests_metier}
                color="#F59E0B"
                prefix="m"
                notes={notes}
                onNote={(k, v) => setNotes(n => ({ ...n, [k]: v }))}
                disabled={isTermine}
              />

              {/* Notes globales */}
              {!isTermine && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={13} className="text-[#64748B]" />
                    <p className="text-xs font-bold text-[#0F172A]">Notes générales</p>
                  </div>
                  <textarea
                    value={globalNotes}
                    onChange={e => setGlobalNotes(e.target.value)}
                    placeholder="Observations générales sur le candidat, comportement, ponctualité..."
                    rows={3}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors resize-none placeholder:text-[#94A3B8]"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Évaluation + Prédiction ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Grille d'évaluation */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#E09000] flex items-center justify-center">
                <Star size={13} className="text-white" />
              </div>
              <p className="text-sm font-bold text-[#0F172A]">Évaluation</p>
            </div>

            <div className="space-y-3">
              {CRITERES.map(c => (
                <div key={c.key}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-[#64748B]">{c.label}</p>
                    {questions?.criteres_evaluation && c.key in questions.criteres_evaluation && (
                      <span className="text-[9px] text-[#94A3B8] max-w-[120px] truncate">
                        {(questions.criteres_evaluation as Record<string, string>)[c.key]}
                      </span>
                    )}
                  </div>
                  {isTermine ? (
                    <ScoreBar value={evaluation[c.key] ?? 5} color={c.color} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={0} max={10} step={1}
                        value={evaluation[c.key] ?? 5}
                        onChange={e => setEvaluation(ev => ({ ...ev, [c.key]: +e.target.value }))}
                        className="flex-1 h-1.5 accent-[#F59E0B] cursor-pointer"
                      />
                      <span className="text-xs font-bold w-5 text-right" style={{ color: c.color }}>
                        {evaluation[c.key] ?? 5}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Score entretien calculé */}
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <p className="text-xs text-[#64748B] font-semibold">Score entretien</p>
              <p className="text-xl font-extrabold" style={{
                color: scoreEntretienCalc >= 70 ? '#16A34A' : scoreEntretienCalc >= 50 ? '#F59E0B' : '#DC2626'
              }}>
                {isTermine && scoreEntretien !== null ? scoreEntretien : scoreEntretienCalc}
                <span className="text-xs text-[#94A3B8] font-normal">/100</span>
              </p>
            </div>

            {/* Bouton terminer */}
            {!isTermine && questions && (
              <button onClick={terminer} disabled={saving}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#F59E0B] to-[#E09000] text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-md disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
                {saving ? 'Calcul en cours...' : 'Terminer et calculer score final'}
              </button>
            )}
          </div>

          {/* Prédiction IA */}
          {prediction && recoInfo && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Brain size={13} className="text-white" />
                </div>
                <p className="text-sm font-bold text-[#0F172A]">Prédiction IA</p>
              </div>

              {/* Recommandation */}
              <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: recoInfo.bg, border: `1px solid ${recoInfo.color}30` }}>
                <RecoIcon size={20} style={{ color: recoInfo.color }} />
                <div>
                  <p className="text-sm font-extrabold" style={{ color: recoInfo.color }}>{prediction.recommandation}</p>
                  <p className="text-[10px] text-[#64748B]">Recommandation finale MIAA+</p>
                </div>
              </div>

              {/* Métriques */}
              <div className="space-y-2.5">
                <MetricRow label="Potentiel de réussite" value={prediction.potentiel_reussite} suffix="%" color="#16A34A" />
                <MetricRow label="Risque départ 12 mois" value={prediction.risque_depart_12mois} suffix="%" color="#F59E0B" inverse />
                <MetricRow label="Risque échec essai" value={prediction.risque_echec_essai} suffix="%" color="#DC2626" inverse />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <p className="text-[10px] text-[#64748B]">Niveau d&apos;adaptation :</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color: ADAPT_COLORS[prediction.niveau_adaptation], background: `${ADAPT_COLORS[prediction.niveau_adaptation]}15` }}>
                  {prediction.niveau_adaptation}
                </span>
              </div>

              <p className="mt-3 pt-3 border-t border-[#F1F5F9] text-[10px] text-[#64748B] leading-relaxed">
                {prediction.justification}
              </p>
            </div>
          )}

          {/* Placeholder avant entretien */}
          {!prediction && !isTermine && (
            <div className="bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-xl p-6 text-center">
              <Brain size={24} className="mx-auto mb-2 text-[#CBD5E1]" />
              <p className="text-xs text-[#94A3B8]">La prédiction IA sera calculée à la fin de l&apos;entretien.</p>
            </div>
          )}

          {/* CV link */}
          {cand?.cv_url && (
            <a href={cand.cv_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors shadow-sm">
              <FileText size={13} className="text-[#64748B]" /> Voir le CV du candidat
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuestionsSection({
  title, questions, color, prefix, notes, onNote, disabled,
}: {
  title: string; questions: string[]; color: string; prefix: string
  notes: Record<string, string>; onNote: (k: string, v: string) => void; disabled: boolean
}) {
  const [open, setOpen] = useState(true)
  if (!questions || questions.length === 0) return null
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#F8FAFC] transition-colors">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <p className="text-xs font-bold text-[#0F172A] flex-1">{title}</p>
        <span className="text-[10px] text-[#94A3B8] mr-2">{questions.length} questions</span>
        <Calendar size={12} className={`text-[#94A3B8] transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#F1F5F9]">
          {questions.map((q, i) => {
            const key = `${prefix}${i}`
            return (
              <div key={key} className="pt-3">
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}15`, color }}>
                    {i + 1}
                  </span>
                  <p className="text-xs text-[#0F172A] flex-1">{q}</p>
                </div>
                {!disabled && (
                  <textarea
                    value={notes[key] ?? ''}
                    onChange={e => onNote(key, e.target.value)}
                    placeholder="Notes..."
                    rows={2}
                    className="w-full ml-7 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[10px] text-[#0F172A] outline-none focus:border-[#F59E0B]/50 transition-colors resize-none placeholder:text-[#CBD5E1]"
                  />
                )}
                {disabled && notes[key] && (
                  <p className="ml-7 text-[10px] text-[#64748B] italic">{notes[key]}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MetricRow({ label, value, suffix, color, inverse }: {
  label: string; value: number; suffix: string; color: string; inverse?: boolean
}) {
  const pct = Math.min(100, value)
  const displayColor = inverse ? (value <= 20 ? '#16A34A' : value <= 40 ? '#F59E0B' : '#DC2626') : color
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-[#64748B]">{label}</p>
        <p className="text-[10px] font-bold" style={{ color: displayColor }}>{value}{suffix}</p>
      </div>
      <div className="h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: displayColor }} />
      </div>
    </div>
  )
}
