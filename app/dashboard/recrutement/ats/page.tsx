'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Kanban, Users, Upload, Search, Star, Plus, X,
  Mail, Phone, Link2,
  Briefcase, GraduationCap, Award, FlaskConical,
  Calendar, MapPin, Clock, DollarSign,
  AlertCircle, Download, FileText,
  Sparkles, Trash2, MoreHorizontal,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candidat {
  id: string; nom: string | null; prenom: string | null; email: string | null
  telephone: string | null; linkedin_url: string | null
  score_global: number; competences: string[] | null; langues: string[] | null
  disponibilite: string | null; salaire_souhaite: number | null
  type_contrat_souhaite: string | null; mobilite: string | null
  ville: string | null; pays: string | null; cv_url: string | null
  cv_text: string | null; notes_internes: string | null
  source: string | null; is_starred: boolean; created_at: string
}

interface Candidature {
  id: string; candidat_id: string; offre_titre: string | null
  offre_id: string | null; ats_stage: string; statut: string
  score_ia: number; created_at: string
}

interface Diplome {
  id: string; titre: string; etablissement: string | null
  domaine: string | null; annee: number | null; niveau: string | null
}

interface Certification {
  id: string; titre: string; organisme: string | null
  date_obtention: string | null; credential_url: string | null
}

interface Experience {
  id: string; poste: string; entreprise: string | null
  secteur: string | null; date_debut: string | null
  date_fin: string | null; en_cours: boolean; description: string | null
}

interface TestResult {
  id: string; nom_test: string; type_test: string | null
  score: number | null; score_max: number; date_passation: string | null
  statut: string
}

interface Entretien {
  id: string; date_heure: string; type: string | null; statut: string | null; notes: string | null
}

interface CandidatFull extends Candidat {
  candidatures: Candidature[]
  diplomes: Diplome[]; certifications: Certification[]
  experiences: Experience[]; tests: TestResult[]
  entretiens: Entretien[]
}

// ── ATS Stages ────────────────────────────────────────────────────────────────

const STAGES: Array<{ key: string; label: string; color: string; bg: string; next?: string }> = [
  { key: 'candidature',      label: 'Candidature',      color: '#64748B', bg: '#F8FAFC',   next: 'prequalification'   },
  { key: 'prequalification', label: 'Préqualification',  color: '#2563EB', bg: '#EFF6FF',   next: 'entretien_rh'       },
  { key: 'entretien_rh',     label: 'Entretien RH',      color: '#7C3AED', bg: '#F5F3FF',   next: 'entretien_client'   },
  { key: 'entretien_client', label: 'Entretien Client',  color: '#D97706', bg: '#FFFBEB',   next: 'validation'         },
  { key: 'validation',       label: 'Validation',        color: '#0EA5E9', bg: '#F0F9FF',   next: 'placement'          },
  { key: 'placement',        label: 'Placement',         color: '#16A34A', bg: '#F0FDF4',   next: 'mission'            },
  { key: 'mission',          label: 'Mission',           color: '#059669', bg: '#ECFDF5',   next: 'archivage'          },
  { key: 'archivage',        label: 'Archivage',         color: '#6B7280', bg: '#F1F5F9'                               },
]

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]))

function stageFromStatut(statut: string): string {
  if (statut === 'nouveau')   return 'candidature'
  if (statut === 'en_cours')  return 'prequalification'
  if (statut === 'entretien') return 'entretien_rh'
  if (statut === 'retenu')    return 'validation'
  if (statut === 'refuse')    return 'archivage'
  return 'candidature'
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreCls(s: number) {
  if (s >= 80) return { color: '#16A34A', bg: '#F0FDF4', ring: '#16A34A' }
  if (s >= 60) return { color: '#D97706', bg: '#FFFBEB', ring: '#D97706' }
  if (s > 0)   return { color: '#DC2626', bg: '#FEF2F2', ring: '#DC2626' }
  return { color: '#94A3B8', bg: '#F1F5F9', ring: '#E2E8F0' }
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size / 2) - 5; const circ = 2 * Math.PI * r
  const pct = Math.min(score, 100) / 100
  const sc = scoreCls(score)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={sc.ring} strokeWidth="4"
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fontSize={size > 40 ? 11 : 9} fontWeight="bold" fill={sc.color}>
        {score > 0 ? score : '—'}
      </text>
    </svg>
  )
}

function initials(prenom: string | null, nom: string | null): string {
  return [(prenom ?? '')[0], (nom ?? '')[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function fullName(c: { prenom: string | null; nom: string | null }): string {
  return [c.prenom, c.nom].filter(Boolean).join(' ') || 'Candidat anonyme'
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({
  candidat, candidature, onClick, onMove, onDelete,
}: {
  candidat: Candidat | null; candidature: Candidature
  onClick: () => void; onMove: (stage: string) => void; onDelete: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const sc = scoreCls(candidature.score_ia)
  const stage = STAGE_MAP[candidature.ats_stage]

  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm hover:shadow-md cursor-pointer transition-all group relative"
      onClick={onClick}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
          style={{ background: stage?.color ?? '#64748B' }}
        >
          {candidat ? initials(candidat.prenom, candidat.nom) : '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#0F172A] truncate leading-tight">
            {candidat ? fullName(candidat) : 'Candidat'}
          </p>
          <p className="text-[10px] text-[#94A3B8] truncate">
            {candidature.offre_titre ?? 'Offre inconnue'}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-[#F1F5F9] transition-all"
        >
          <MoreHorizontal size={12} className="text-[#94A3B8]" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {(candidat?.competences ?? []).slice(0, 2).map(c => (
            <span key={c} className="text-[9px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] px-1.5 py-0.5 rounded-md">
              {c}
            </span>
          ))}
        </div>
        {candidature.score_ia > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: sc.bg, color: sc.color }}>
            <Star size={8} /> {candidature.score_ia}
          </span>
        )}
      </div>

      <p className="text-[9px] text-[#CBD5E1] mt-1.5">
        {new Date(candidature.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </p>

      {showMenu && (
        <div
          className="absolute top-7 right-2 z-20 bg-white rounded-xl shadow-xl border border-[#E2E8F0] py-1 w-44"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[10px] text-[#94A3B8] px-3 py-1 font-semibold uppercase tracking-wider">Déplacer vers</p>
          {STAGES.filter(s => s.key !== candidature.ats_stage).map(s => (
            <button key={s.key}
              onClick={() => { onMove(s.key); setShowMenu(false) }}
              className="w-full text-left px-3 py-1.5 text-[11px] font-medium hover:bg-[#F8FAFC] flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
          <hr className="my-1 border-[#F1F5F9]" />
          <button onClick={() => { onDelete(); setShowMenu(false) }}
            className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 flex items-center gap-2">
            <Trash2 size={10} /> Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Profile Panel ─────────────────────────────────────────────────────────────

type ProfileTab = 'profil' | 'experiences' | 'diplomes' | 'entretiens' | 'tests'

function ProfilePanel({
  candidat, candidatures, onClose, onMoveStage, onSaveNote,
}: {
  candidat: CandidatFull; candidatures: Candidature[]
  onClose: () => void; onMoveStage: (candId: string, stage: string) => void
  onSaveNote: (candidatId: string, note: string) => void
}) {
  const [tab, setTab] = useState<ProfileTab>('profil')
  const [note, setNote] = useState(candidat.notes_internes ?? '')
  const [editNote, setEditNote] = useState(false)
  const sc = scoreCls(candidat.score_global)

  const TABS: Array<{ key: ProfileTab; label: string; count?: number }> = [
    { key: 'profil',      label: 'Profil'       },
    { key: 'experiences', label: 'Expériences', count: candidat.experiences.length   },
    { key: 'diplomes',    label: 'Diplômes',    count: candidat.diplomes.length + candidat.certifications.length },
    { key: 'entretiens',  label: 'Entretiens',  count: candidat.entretiens.length    },
    { key: 'tests',       label: 'Tests',       count: candidat.tests.length         },
  ]

  const activeCandidature = candidatures[0]

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-[#F1F5F9] bg-gradient-to-r from-[#F8FAFC] to-white flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-[15px] shrink-0"
            style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)' }}>
            {initials(candidat.prenom, candidat.nom)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] font-bold text-[#0F172A]">{fullName(candidat)}</h2>
              {candidat.is_starred && <Star size={12} className="text-[#F59E0B] fill-[#F59E0B]" />}
            </div>
            <div className="flex flex-wrap gap-2 mt-0.5">
              {candidat.email && (
                <a href={`mailto:${candidat.email}`} className="flex items-center gap-1 text-[10px] text-[#64748B] hover:text-[#2563EB]">
                  <Mail size={9} /> {candidat.email}
                </a>
              )}
              {candidat.telephone && (
                <a href={`tel:${candidat.telephone}`} className="flex items-center gap-1 text-[10px] text-[#64748B] hover:text-[#2563EB]">
                  <Phone size={9} /> {candidat.telephone}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ScoreRing score={candidat.score_global} size={44} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Pipeline badges */}
        {candidatures.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {candidatures.slice(0, 3).map(c => {
              const st = STAGE_MAP[c.ats_stage] ?? STAGE_MAP['candidature']
              return (
                <span key={c.id} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: st.bg, color: st.color }}>
                  {c.offre_titre?.slice(0, 20) ?? 'Offre'} · {st.label}
                </span>
              )
            })}
          </div>
        )}

        {/* Stage move for active candidature */}
        {activeCandidature && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[#94A3B8]">Avancer :</span>
            {STAGES.map(s => (
              <button key={s.key}
                onClick={() => onMoveStage(activeCandidature.id, s.key)}
                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border transition-all ${activeCandidature.ats_stage === s.key ? 'border-transparent' : 'border-transparent opacity-50 hover:opacity-100'}`}
                style={activeCandidature.ats_stage === s.key ? { background: s.color, color: '#fff' } : { background: s.bg, color: s.color }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-[#F1F5F9] overflow-x-auto flex-shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${tab === t.key ? 'bg-[#F59E0B] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`text-[9px] px-1 rounded-full ${tab === t.key ? 'bg-white/30 text-white' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── PROFIL ─── */}
        {tab === 'profil' && (
          <>
            {/* Info rapides */}
            <div className="grid grid-cols-2 gap-2">
              {candidat.disponibilite && (
                <div className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] rounded-xl">
                  <Clock size={13} className="text-[#16A34A] shrink-0" />
                  <div>
                    <p className="text-[9px] text-[#94A3B8]">Disponibilité</p>
                    <p className="text-[11px] font-semibold text-[#0F172A]">
                      {new Date(candidat.disponibilite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
              {candidat.ville && (
                <div className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] rounded-xl">
                  <MapPin size={13} className="text-[#2563EB] shrink-0" />
                  <div>
                    <p className="text-[9px] text-[#94A3B8]">Localisation</p>
                    <p className="text-[11px] font-semibold text-[#0F172A]">{candidat.ville}{candidat.pays ? `, ${candidat.pays}` : ''}</p>
                  </div>
                </div>
              )}
              {candidat.salaire_souhaite && (
                <div className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] rounded-xl">
                  <DollarSign size={13} className="text-[#F59E0B] shrink-0" />
                  <div>
                    <p className="text-[9px] text-[#94A3B8]">Salaire souhaité</p>
                    <p className="text-[11px] font-semibold text-[#0F172A]">{candidat.salaire_souhaite.toLocaleString('fr-FR')} FCFA</p>
                  </div>
                </div>
              )}
              {candidat.type_contrat_souhaite && (
                <div className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] rounded-xl">
                  <Briefcase size={13} className="text-[#7C3AED] shrink-0" />
                  <div>
                    <p className="text-[9px] text-[#94A3B8]">Contrat souhaité</p>
                    <p className="text-[11px] font-semibold text-[#0F172A] uppercase">{candidat.type_contrat_souhaite}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Compétences */}
            {(candidat.competences ?? []).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[#374151] mb-2">Compétences</p>
                <div className="flex flex-wrap gap-1.5">
                  {(candidat.competences ?? []).map(c => (
                    <span key={c} className="text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] px-2.5 py-1 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Langues */}
            {(candidat.langues ?? []).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[#374151] mb-2">Langues</p>
                <div className="flex flex-wrap gap-1.5">
                  {(candidat.langues ?? []).map(l => (
                    <span key={l} className="text-[11px] bg-[#EFF6FF] text-[#2563EB] px-2.5 py-1 rounded-full font-medium">{l}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Score MIAA+ */}
            {candidat.score_global > 0 && (
              <div className="p-3 rounded-xl border flex items-center gap-3" style={{ background: sc.bg, borderColor: sc.color + '30' }}>
                <Sparkles size={16} style={{ color: sc.color }} className="shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold" style={{ color: sc.color }}>Score MIAA+ : {candidat.score_global}/100</p>
                  <p className="text-[10px] text-[#64748B]">Analyse IA des compétences et expériences</p>
                </div>
              </div>
            )}

            {/* Extrait CV */}
            {candidat.cv_text && (
              <div>
                <p className="text-[11px] font-semibold text-[#374151] mb-2">Extrait CV</p>
                <p className="text-[11px] text-[#64748B] leading-relaxed bg-[#F8FAFC] rounded-xl p-3 max-h-32 overflow-y-auto">
                  {candidat.cv_text.slice(0, 600)}{candidat.cv_text.length > 600 ? '…' : ''}
                </p>
              </div>
            )}

            {/* Notes internes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-[#374151]">Notes internes</p>
                <button onClick={() => setEditNote(v => !v)} className="text-[10px] text-[#F59E0B] font-semibold hover:text-[#D97706]">
                  {editNote ? 'Annuler' : 'Modifier'}
                </button>
              </div>
              {editNote ? (
                <div className="space-y-2">
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                    className="w-full p-3 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 resize-none"
                    placeholder="Notes confidentielles sur ce candidat..."
                  />
                  <button onClick={() => { onSaveNote(candidat.id, note); setEditNote(false) }}
                    className="w-full py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706]">
                    Enregistrer
                  </button>
                </div>
              ) : (
                <p className="text-[12px] text-[#64748B] bg-[#F8FAFC] rounded-xl p-3 min-h-[48px]">
                  {note || <span className="italic text-[#CBD5E1]">Aucune note</span>}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── EXPÉRIENCES ─── */}
        {tab === 'experiences' && (
          <div>
            {candidat.experiences.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase size={28} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[11px] text-[#94A3B8]">Aucune expérience enregistrée</p>
              </div>
            ) : (
              <div className="relative pl-4 space-y-4">
                <div className="absolute left-1.5 top-2 bottom-2 w-px bg-[#E2E8F0]" />
                {candidat.experiences.map(exp => (
                  <div key={exp.id} className="relative">
                    <div className="absolute -left-3.5 top-1.5 w-3 h-3 rounded-full border-2 bg-white"
                      style={{ borderColor: exp.en_cours ? '#16A34A' : '#CBD5E1' }} />
                    <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 ml-2 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-bold text-[#0F172A]">{exp.poste}</p>
                          <p className="text-[11px] text-[#64748B]">{exp.entreprise ?? '—'}{exp.secteur ? ` · ${exp.secteur}` : ''}</p>
                        </div>
                        {exp.en_cours && (
                          <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-semibold shrink-0">En cours</span>
                        )}
                      </div>
                      {(exp.date_debut || exp.date_fin) && (
                        <p className="text-[10px] text-[#94A3B8] mt-1 flex items-center gap-1">
                          <Calendar size={9} />
                          {exp.date_debut ? new Date(exp.date_debut).getFullYear() : '?'}
                          {' – '}
                          {exp.en_cours ? 'Présent' : (exp.date_fin ? new Date(exp.date_fin).getFullYear() : '?')}
                        </p>
                      )}
                      {exp.description && (
                        <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">{exp.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DIPLÔMES & CERTIFS ─── */}
        {tab === 'diplomes' && (
          <div className="space-y-3">
            {candidat.diplomes.length === 0 && candidat.certifications.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap size={28} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[11px] text-[#94A3B8]">Aucun diplôme ou certification enregistré</p>
              </div>
            ) : (
              <>
                {candidat.diplomes.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-[#374151] mb-2 flex items-center gap-1.5">
                      <GraduationCap size={12} className="text-[#2563EB]" /> Diplômes
                    </p>
                    {candidat.diplomes.map(d => (
                      <div key={d.id} className="bg-[#EFF6FF] rounded-xl p-3 mb-2">
                        <p className="text-[12px] font-bold text-[#1D4ED8]">{d.titre}</p>
                        {d.etablissement && <p className="text-[11px] text-[#3B82F6]">{d.etablissement}</p>}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {d.niveau && <span className="text-[9px] bg-[#DBEAFE] text-[#1D4ED8] px-1.5 py-0.5 rounded-full font-semibold">{d.niveau}</span>}
                          {d.domaine && <span className="text-[9px] text-[#64748B]">{d.domaine}</span>}
                          {d.annee && <span className="text-[9px] text-[#94A3B8]">{d.annee}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {candidat.certifications.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-[#374151] mb-2 flex items-center gap-1.5">
                      <Award size={12} className="text-[#D97706]" /> Certifications
                    </p>
                    {candidat.certifications.map(c => (
                      <div key={c.id} className="bg-[#FFFBEB] rounded-xl p-3 mb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[12px] font-bold text-[#92400E]">{c.titre}</p>
                            {c.organisme && <p className="text-[11px] text-[#D97706]">{c.organisme}</p>}
                            {c.date_obtention && (
                              <p className="text-[10px] text-[#94A3B8] mt-0.5">
                                Obtenue le {new Date(c.date_obtention).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          {c.credential_url && (
                            <a href={c.credential_url} target="_blank" rel="noopener noreferrer"
                              className="text-[9px] bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-semibold hover:bg-amber-200 transition-colors shrink-0">
                              Voir
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ENTRETIENS ─── */}
        {tab === 'entretiens' && (
          <div className="space-y-2">
            {candidat.entretiens.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={28} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[11px] text-[#94A3B8]">Aucun entretien planifié</p>
              </div>
            ) : (
              candidat.entretiens.map(e => {
                const isPast = new Date(e.date_heure) < new Date()
                return (
                  <div key={e.id} className={`rounded-xl p-3 border ${isPast ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#F0FDF4] border-green-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-semibold text-[#0F172A]">
                        {new Date(e.date_heure).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {e.statut && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${e.statut === 'realise' ? 'bg-green-100 text-green-600' : e.statut === 'annule' ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-600'}`}>
                          {e.statut}
                        </span>
                      )}
                    </div>
                    {e.type && <p className="text-[10px] text-[#64748B] capitalize">{e.type}</p>}
                    {e.notes && <p className="text-[11px] text-[#64748B] mt-1">{e.notes}</p>}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── TESTS ─── */}
        {tab === 'tests' && (
          <div className="space-y-2">
            {candidat.tests.length === 0 ? (
              <div className="text-center py-8">
                <FlaskConical size={28} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[11px] text-[#94A3B8]">Aucun test enregistré</p>
              </div>
            ) : (
              candidat.tests.map(t => {
                const pct = t.score !== null ? Math.round((t.score / (t.score_max ?? 100)) * 100) : null
                const sc2 = pct !== null ? scoreCls(pct) : { color: '#94A3B8', bg: '#F1F5F9' }
                return (
                  <div key={t.id} className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-[12px] font-bold text-[#0F172A]">{t.nom_test}</p>
                        {t.type_test && <p className="text-[10px] text-[#94A3B8]">{t.type_test}</p>}
                        {t.date_passation && (
                          <p className="text-[10px] text-[#94A3B8]">
                            {new Date(t.date_passation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${t.statut === 'complete' ? 'bg-green-100 text-green-600' : t.statut === 'planifie' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        {t.statut}
                      </span>
                    </div>
                    {t.score !== null && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sc2.color }} />
                        </div>
                        <span className="text-[11px] font-bold shrink-0" style={{ color: sc2.color }}>
                          {t.score}/{t.score_max}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-[#F1F5F9] flex gap-2 flex-wrap flex-shrink-0">
        {candidat.cv_url && (
          <a href={candidat.cv_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
            <Download size={12} /> CV
          </a>
        )}
        {candidat.linkedin_url && (
          <a href={candidat.linkedin_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#EFF6FF] border border-blue-200 rounded-xl text-[12px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE] transition-colors">
            <Link2 size={12} /> LinkedIn
          </a>
        )}
      </div>
    </div>
  )
}

// ── Import Modal ──────────────────────────────────────────────────────────────

interface ImportForm {
  nom: string; prenom: string; email: string; telephone: string
  ville: string; competences: string; type_contrat: string; disponibilite: string
}

function ImportModal({
  tenantId, onClose, onImported,
}: {
  tenantId: string; onClose: () => void; onImported: () => void
}) {
  const [step, setStep] = useState<'upload' | 'form' | 'saving'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm] = useState<ImportForm>({
    nom: '', prenom: '', email: '', telephone: '',
    ville: '', competences: '', type_contrat: 'cdi', disponibilite: '',
  })
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx'

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); prefillFromFilename(f.name) }
  }

  function prefillFromFilename(name: string) {
    const base = name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    const parts = base.split(' ').filter(p => p.length > 1)
    if (parts.length >= 2) {
      setForm(prev => ({ ...prev, prenom: parts[0], nom: parts.slice(1).join(' ') }))
    }
  }

  async function handleSave() {
    if (!form.nom || !form.prenom) { setError('Nom et prénom requis'); return }
    setStep('saving')
    try {
      let cvUrl: string | null = null
      if (file) {
        const { data: upload } = await supabase.storage
          .from('cv-files')
          .upload(`${tenantId}/${Date.now()}_${file.name}`, file, { upsert: true })
        if (upload) {
          const { data: { publicUrl } } = supabase.storage.from('cv-files').getPublicUrl(upload.path)
          cvUrl = publicUrl
        }
      }

      const { data: candidat, error: err } = await supabase.from('candidats').insert({
        tenant_id: tenantId,
        nom:       form.nom,
        prenom:    form.prenom,
        email:     form.email || null,
        telephone: form.telephone || null,
        ville:     form.ville || null,
        competences: form.competences ? form.competences.split(',').map(c => c.trim()).filter(Boolean) : [],
        type_contrat_souhaite: form.type_contrat,
        disponibilite: form.disponibilite || null,
        cv_url:    cvUrl,
        source:    'import',
        statut:    'nouveau',
        score_global: 0,
      }).select('id').single()

      if (err || !candidat) { setError('Erreur lors de l\'enregistrement'); setStep('form'); return }

      onImported()
    } catch {
      setError('Erreur inattendue'); setStep('form')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#F1F5F9]">
          <h2 className="text-[15px] font-bold text-[#0F172A]">
            {step === 'upload' ? 'Importer un CV' : step === 'saving' ? 'Enregistrement…' : 'Informations candidat'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'saving' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                <Upload size={20} className="text-[#F59E0B] animate-bounce" />
              </div>
              <p className="text-[13px] text-[#64748B]">Enregistrement en cours…</p>
            </div>
          )}

          {step === 'upload' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-[#F59E0B] bg-[#FEF3C7]' : 'border-[#E2E8F0] hover:border-[#F59E0B] hover:bg-[#FFFBEB]'}`}
              >
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); prefillFromFilename(f.name) } }} />
                <Upload size={28} className={`mx-auto mb-2 ${dragOver ? 'text-[#F59E0B]' : 'text-[#CBD5E1]'}`} />
                {file ? (
                  <p className="text-[13px] font-semibold text-[#0F172A]">{file.name}</p>
                ) : (
                  <>
                    <p className="text-[13px] font-semibold text-[#374151]">Glisser-déposer un fichier</p>
                    <p className="text-[11px] text-[#94A3B8] mt-1">PDF, Word (.doc, .docx) ou Excel (.xls, .xlsx)</p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {['PDF', 'Word', 'Excel'].map(fmt => (
                  <div key={fmt} className="bg-[#F8FAFC] rounded-xl p-2">
                    <FileText size={16} className="mx-auto mb-1 text-[#94A3B8]" />
                    <p className="text-[10px] font-semibold text-[#64748B]">{fmt}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep('form')}
                className="w-full py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] transition-colors"
              >
                {file ? 'Continuer avec ce fichier' : 'Saisir manuellement'}
              </button>
            </>
          )}

          {step === 'form' && (
            <>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                  <AlertCircle size={13} className="text-red-500 shrink-0" />
                  <p className="text-[12px] text-red-600">{error}</p>
                </div>
              )}
              {file && (
                <div className="flex items-center gap-2 p-2.5 bg-[#F0FDF4] rounded-xl border border-green-200">
                  <FileText size={12} className="text-green-600 shrink-0" />
                  <p className="text-[11px] text-green-700 font-medium truncate">{file.name}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'prenom', label: 'Prénom *', placeholder: 'Jean' },
                  { key: 'nom',    label: 'Nom *',    placeholder: 'Dupont' },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-[11px] font-semibold text-[#374151] mb-1">{label}</label>
                    <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                  </div>
                ))}
              </div>
              {([
                { key: 'email',     label: 'Email',     placeholder: 'jean.dupont@email.com', type: 'email'  },
                { key: 'telephone', label: 'Téléphone', placeholder: '+242 06 123 4567',       type: 'tel'    },
                { key: 'ville',     label: 'Ville',     placeholder: 'Brazzaville',            type: 'text'   },
              ] as const).map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">{label}</label>
                  <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder} type={type}
                    className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Compétences (séparées par virgule)</label>
                <input value={form.competences} onChange={e => setForm(p => ({ ...p, competences: e.target.value }))}
                  placeholder="JavaScript, React, Python…"
                  className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Contrat souhaité</label>
                  <select value={form.type_contrat} onChange={e => setForm(p => ({ ...p, type_contrat: e.target.value }))}
                    className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none bg-white">
                    {['cdi', 'cdd', 'interim', 'stage', 'freelance', 'alternance'].map(t => (
                      <option key={t} value={t}>{t.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Disponible le</label>
                  <input type="date" value={form.disponibilite}
                    onChange={e => setForm(p => ({ ...p, disponibilite: e.target.value }))}
                    className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('upload')}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  Retour
                </button>
                <button onClick={handleSave}
                  className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706]">
                  Enregistrer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ATS Page ─────────────────────────────────────────────────────────────

type View = 'pipeline' | 'candidats'

export default function ATSPage() {
  const router = useRouter()
  const { tenantId, loading: tl } = useTenant()

  const [view, setView]           = useState<View>('pipeline')
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selectedCandidatId, setSelectedCandidatId] = useState<string | null>(null)
  const [profile, setProfile]     = useState<CandidatFull | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [activeStageFilter, setActiveStageFilter] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: cands }, { data: cands2 }] = await Promise.all([
      supabase.from('candidats')
        .select('id,nom,prenom,email,telephone,linkedin_url,score_global,competences,langues,disponibilite,salaire_souhaite,type_contrat_souhaite,mobilite,ville,pays,cv_url,cv_text,notes_internes,source,is_starred,created_at')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('candidatures')
        .select('id,candidat_id,ats_stage,statut,score_ia,created_at,offres_emploi(id,titre)')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(500),
    ])
    setCandidats((cands ?? []) as Candidat[])
    setCandidatures((cands2 ?? []).map(c => ({
      id: c.id, candidat_id: c.candidat_id,
      ats_stage: (c.ats_stage as string | null) ?? stageFromStatut(c.statut ?? 'nouveau'),
      statut: c.statut ?? 'nouveau',
      score_ia: c.score_ia ?? 0,
      created_at: c.created_at,
      offre_titre: (c.offres_emploi as unknown as { titre: string } | null)?.titre ?? null,
      offre_id:    (c.offres_emploi as unknown as { id: string } | null)?.id ?? null,
    })))
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (tenantId) void load() }, [tenantId, load])

  async function loadProfile(candidatId: string) {
    setSelectedCandidatId(candidatId)
    setProfileLoading(true)
    const base = candidats.find(c => c.id === candidatId) ?? null

    const safeD = async <T,>(promise: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> => {
      try { const r = await promise; return (r.data as T[]) ?? [] } catch { return [] }
    }

    const [diplomes, certifications, experiences, tests, entretiens] = await Promise.all([
      safeD<Diplome>(supabase.from('ats_diplomes').select('id,titre,etablissement,domaine,annee,niveau').eq('candidat_id', candidatId).order('annee', { ascending: false })),
      safeD<Certification>(supabase.from('ats_certifications').select('id,titre,organisme,date_obtention,credential_url').eq('candidat_id', candidatId)),
      safeD<Experience>(supabase.from('ats_experiences').select('id,poste,entreprise,secteur,date_debut,date_fin,en_cours,description').eq('candidat_id', candidatId).order('date_debut', { ascending: false })),
      safeD<TestResult>(supabase.from('ats_tests').select('id,nom_test,type_test,score,score_max,date_passation,statut').eq('candidat_id', candidatId)),
      safeD<Entretien>(supabase.from('entretiens').select('id,date_heure,type,statut,notes').eq('candidat_id', candidatId).order('date_heure', { ascending: false })),
    ])

    if (base) {
      setProfile({
        ...base,
        candidatures: candidatures.filter(c => c.candidat_id === candidatId),
        diplomes, certifications, experiences, tests, entretiens,
      })
    }
    setProfileLoading(false)
  }

  async function moveStage(candidatureId: string, newStage: string) {
    await supabase.from('candidatures').update({ ats_stage: newStage }).eq('id', candidatureId)
    setCandidatures(prev => prev.map(c => c.id === candidatureId ? { ...c, ats_stage: newStage } : c))
    if (profile) {
      setProfile(prev => prev ? {
        ...prev,
        candidatures: prev.candidatures.map(c => c.id === candidatureId ? { ...c, ats_stage: newStage } : c),
      } : null)
    }
  }

  async function deleteCandidature(candidatureId: string) {
    await supabase.from('candidatures').delete().eq('id', candidatureId)
    setCandidatures(prev => prev.filter(c => c.id !== candidatureId))
  }

  async function saveNote(candidatId: string, note: string) {
    await supabase.from('candidats').update({ notes_internes: note }).eq('id', candidatId)
    setCandidats(prev => prev.map(c => c.id === candidatId ? { ...c, notes_internes: note } : c))
    if (profile && profile.id === candidatId) setProfile(prev => prev ? { ...prev, notes_internes: note } : null)
  }

  // ── Filtered data ──────────────────────────────────────────────────────────
  const candidatMap = Object.fromEntries(candidats.map(c => [c.id, c]))

  const filteredCandidatures = candidatures.filter(c => {
    if (activeStageFilter && c.ats_stage !== activeStageFilter) return false
    if (!search) return true
    const cand = candidatMap[c.candidat_id]
    if (!cand) return false
    return [cand.prenom, cand.nom, cand.email, c.offre_titre, ...(cand.competences ?? [])]
      .filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  })

  const filteredCandidats = candidats.filter(c => {
    if (!search) return true
    return [c.prenom, c.nom, c.email, ...(c.competences ?? [])]
      .filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  })

  if (tl || loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-14 bg-[#F8FAFC] rounded-2xl" />
      <div className="flex gap-3 overflow-hidden">
        {STAGES.map(s => <div key={s.key} className="w-52 shrink-0 h-96 rounded-xl" style={{ background: s.bg }} />)}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">ATS Pipeline</h1>
          <p className="text-[11px] text-[#64748B]">
            {candidatures.length} candidature{candidatures.length !== 1 ? 's' : ''} · {candidats.length} candidat{candidats.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 w-44" />
          </div>
          <div className="flex bg-white border border-[#E2E8F0] rounded-xl p-0.5">
            {([['pipeline', <Kanban key="k" size={13} />], ['candidats', <Users key="u" size={13} />]] as [View, React.ReactNode][]).map(([v, icon]) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${view === v ? 'bg-[#F59E0B] text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
              >
                {icon} {v === 'pipeline' ? 'Pipeline' : 'Candidats'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Upload size={13} /> Importer
          </button>
          <button onClick={() => router.push('/dashboard/recrutement/offres/nouvelle')}
            className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] shadow-sm">
            <Plus size={14} /> Offre
          </button>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">

        {/* ── PIPELINE VIEW ─── */}
        {view === 'pipeline' && (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Stage filter chips */}
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 flex-shrink-0">
              <button onClick={() => setActiveStageFilter(null)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all ${!activeStageFilter ? 'bg-[#0F172A] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}>
                Tout ({candidatures.length})
              </button>
              {STAGES.map(s => {
                const cnt = candidatures.filter(c => c.ats_stage === s.key).length
                return (
                  <button key={s.key} onClick={() => setActiveStageFilter(s.key === activeStageFilter ? null : s.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-1 ${activeStageFilter === s.key ? 'text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}
                    style={activeStageFilter === s.key ? { background: s.color } : {}}>
                    {s.label} <span className="opacity-70">{cnt}</span>
                  </button>
                )
              })}
            </div>

            {/* Kanban board */}
            <div className="flex gap-3 overflow-x-auto pb-2 flex-1 items-start">
              {STAGES.map(stage => {
                const stageCandidatures = filteredCandidatures.filter(c => c.ats_stage === stage.key)
                return (
                  <div key={stage.key} className="w-52 shrink-0 flex flex-col rounded-xl overflow-hidden border border-[#E2E8F0]"
                    style={{ background: stage.bg }}>
                    {/* Column header */}
                    <div className="px-3 py-2.5 flex items-center justify-between border-b border-[#E2E8F0]"
                      style={{ borderBottomColor: stage.color + '30' }}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                        <p className="text-[11px] font-bold text-[#374151]">{stage.label}</p>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: stage.color }}>
                        {stageCandidatures.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex flex-col gap-2 p-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
                      {stageCandidatures.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 opacity-40">
                          <Users size={20} className="text-[#94A3B8] mb-1" />
                          <p className="text-[9px] text-[#94A3B8]">Aucun candidat</p>
                        </div>
                      ) : (
                        stageCandidatures.map(c => (
                          <KanbanCard
                            key={c.id}
                            candidat={candidatMap[c.candidat_id] ?? null}
                            candidature={c}
                            onClick={() => loadProfile(c.candidat_id)}
                            onMove={newStage => moveStage(c.id, newStage)}
                            onDelete={() => deleteCandidature(c.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── CANDIDATS VIEW ─── */}
        {view === 'candidats' && (
          <div className="flex-1 overflow-y-auto space-y-2 min-w-0">
            {filteredCandidats.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
                <Users size={32} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="text-[13px] font-semibold text-[#64748B]">Aucun candidat dans le vivier</p>
                <button onClick={() => setShowImport(true)}
                  className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706]">
                  <Upload size={13} /> Importer un CV
                </button>
              </div>
            ) : (
              filteredCandidats.map(c => {
                const candCandidatures = candidatures.filter(cc => cc.candidat_id === c.id)
                const bestCandidature = candCandidatures.sort((a, b) => b.score_ia - a.score_ia)[0]
                return (
                  <div key={c.id}
                    onClick={() => loadProfile(c.id)}
                    className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md cursor-pointer transition-all ${selectedCandidatId === c.id ? 'border-[#F59E0B]' : 'border-[#E2E8F0] hover:border-[#F59E0B]/40'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1E293B, #475569)' }}>
                        {initials(c.prenom, c.nom)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[13px] font-bold text-[#0F172A]">{fullName(c)}</p>
                          {c.is_starred && <Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" />}
                        </div>
                        <p className="text-[11px] text-[#94A3B8] truncate">
                          {c.email ?? '—'}{c.ville ? ` · ${c.ville}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {candCandidatures.length > 0 && (
                          <span className="text-[10px] text-[#94A3B8]">{candCandidatures.length} candidature{candCandidatures.length > 1 ? 's' : ''}</span>
                        )}
                        {bestCandidature && STAGE_MAP[bestCandidature.ats_stage] && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: STAGE_MAP[bestCandidature.ats_stage].bg, color: STAGE_MAP[bestCandidature.ats_stage].color }}>
                            {STAGE_MAP[bestCandidature.ats_stage].label}
                          </span>
                        )}
                        <ScoreRing score={c.score_global} size={34} />
                      </div>
                    </div>
                    {(c.competences ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pl-13">
                        {(c.competences ?? []).slice(0, 5).map(comp => (
                          <span key={comp} className="text-[9px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] px-1.5 py-0.5 rounded-md">
                            {comp}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Profile panel (desktop side panel) ─── */}
        {(profile || profileLoading) && (
          <div className="hidden lg:flex w-96 shrink-0 rounded-2xl border border-[#E2E8F0] shadow-lg overflow-hidden flex-col">
            {profileLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <Sparkles size={24} className="text-[#F59E0B] animate-pulse mx-auto" />
                  <p className="text-[12px] text-[#64748B]">Chargement du profil…</p>
                </div>
              </div>
            ) : profile ? (
              <ProfilePanel
                candidat={profile}
                candidatures={profile.candidatures}
                onClose={() => { setProfile(null); setSelectedCandidatId(null) }}
                onMoveStage={moveStage}
                onSaveNote={saveNote}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* ── Profile modal (mobile) ─── */}
      {(profile || profileLoading) && (
        <div className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[92vh] flex flex-col">
            {profileLoading ? (
              <div className="flex items-center justify-center py-16">
                <Sparkles size={24} className="text-[#F59E0B] animate-pulse" />
              </div>
            ) : profile ? (
              <ProfilePanel
                candidat={profile}
                candidatures={profile.candidatures}
                onClose={() => { setProfile(null); setSelectedCandidatId(null) }}
                onMoveStage={moveStage}
                onSaveNote={saveNote}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* ── Import modal ─── */}
      {showImport && (
        <ImportModal
          tenantId={tenantId ?? ''}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); void load() }}
        />
      )}
    </div>
  )
}
