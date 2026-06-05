'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Check, Clock, X, ChevronRight, Mail, Briefcase } from 'lucide-react'

interface TrackingData {
  id: string
  statut: string
  created_at: string
  score_ia: number
  offre: { titre: string; localisation: string | null; type_contrat: string | null } | null
  candidat: { nom: string | null; prenom: string | null; email: string | null } | null
  entreprise: string
}

type Statut = 'recu' | 'en_examen' | 'entretien' | 'retenu' | 'rejete'

const STEPS: { key: Statut; label: string; desc: string }[] = [
  { key: 'recu',      label: 'Candidature reçue',       desc: 'Votre dossier a été transmis avec succès' },
  { key: 'en_examen', label: 'Analyse en cours',         desc: 'L\'équipe RH examine votre profil' },
  { key: 'entretien', label: 'Entretien',                desc: 'Vous avez été sélectionné(e) pour un entretien' },
  { key: 'retenu',    label: 'Candidature retenue',      desc: 'Félicitations ! Vous avez été retenu(e)' },
]

const STATUT_ORDER: Record<Statut, number> = { recu: 0, en_examen: 1, entretien: 2, retenu: 3, rejete: -1 }

export default function SuiviPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<TrackingData | null>(null)
  const [status, setStatus] = useState<'loading' | 'found' | 'error'>('loading')

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/jobs/suivi?id=${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setStatus('error'); return }
        setData(d)
        setStatus('found')
      })
      .catch(() => setStatus('error'))
  }, [params.id])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#F59E0B]" />
      </div>
    )
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <X size={24} className="text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-[#0F172A] mb-2">Candidature introuvable</h1>
          <p className="text-sm text-[#64748B]">Ce lien de suivi est invalide ou a expiré.</p>
          <p className="text-xs text-[#94A3B8] mt-4">Propulsé par <span className="font-bold text-[#F59E0B]">oraforme</span></p>
        </div>
      </div>
    )
  }

  const isRejete = data.statut === 'rejete'
  const currentStep = isRejete ? -1 : (STATUT_ORDER[data.statut as Statut] ?? 0)
  const prenom = data.candidat?.prenom ?? ''
  const nom = [data.candidat?.prenom, data.candidat?.nom].filter(Boolean).join(' ') || 'Candidat'

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <span className="text-[15px] font-extrabold text-[#0F172A]">
            oraforme <span className="text-[#F59E0B]">·</span> <span className="font-normal text-[#64748B] text-sm">Suivi candidature</span>
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Hero card */}
        <div className={`rounded-2xl p-6 text-white ${
          isRejete ? 'bg-gradient-to-br from-[#64748B] to-[#475569]'
          : data.statut === 'retenu' ? 'bg-gradient-to-br from-[#16A34A] to-[#15803D]'
          : 'bg-gradient-to-br from-[#0F172A] to-[#1E293B]'
        }`}>
          <p className="text-sm font-medium text-white/70 mb-1">Bonjour {prenom} 👋</p>
          <h1 className="text-xl font-extrabold mb-3">
            {isRejete
              ? 'Suite non donnée à votre candidature'
              : data.statut === 'retenu'
              ? 'Félicitations ! Vous êtes retenu(e) 🎉'
              : data.statut === 'entretien'
              ? 'Vous êtes sélectionné(e) pour un entretien !'
              : 'Candidature en cours d\'examen'}
          </h1>

          <div className="flex flex-wrap gap-3 text-xs text-white/70">
            <span className="flex items-center gap-1"><Briefcase size={11} />{data.offre?.titre ?? 'Poste'}</span>
            <span className="flex items-center gap-1">
              <span className="font-semibold text-white">{data.entreprise}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {new Date(data.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <h2 className="text-sm font-bold text-[#0F172A] mb-5">Progression de votre candidature</h2>

          {isRejete ? (
            <div className="space-y-3">
              {/* recu always done */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
                  <Check size={14} className="text-white" />
                </div>
                <div className="pt-1.5">
                  <p className="text-sm font-semibold text-[#0F172A]">Candidature reçue</p>
                  <p className="text-xs text-[#64748B]">Votre dossier a été transmis avec succès</p>
                </div>
              </div>
              <div className="ml-4 w-0.5 h-4 bg-[#E2E8F0]" />
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#DC2626] flex items-center justify-center shrink-0">
                  <X size={14} className="text-white" />
                </div>
                <div className="pt-1.5">
                  <p className="text-sm font-semibold text-[#DC2626]">Suite non donnée</p>
                  <p className="text-xs text-[#64748B]">Votre profil ne correspond pas aux critères de ce poste</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {STEPS.map((step, idx) => {
                const done = idx < currentStep
                const active = idx === currentStep
                const future = idx > currentStep
                return (
                  <div key={step.key}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        done ? 'bg-[#16A34A]'
                        : active ? 'bg-[#F59E0B] ring-4 ring-[#F59E0B]/20'
                        : 'bg-[#F1F5F9]'
                      }`}>
                        {done
                          ? <Check size={14} className="text-white" />
                          : active
                          ? <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                          : <div className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1]" />
                        }
                      </div>
                      <div className="pt-1.5 pb-3">
                        <p className={`text-sm font-semibold ${
                          done ? 'text-[#16A34A]'
                          : active ? 'text-[#F59E0B]'
                          : 'text-[#94A3B8]'
                        }`}>
                          {step.label}
                          {active && <span className="ml-2 text-[10px] font-bold bg-[#F59E0B]/15 text-[#F59E0B] px-2 py-0.5 rounded-full">En cours</span>}
                        </p>
                        {!future && (
                          <p className="text-xs text-[#64748B] mt-0.5">{step.desc}</p>
                        )}
                      </div>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`ml-4 w-0.5 h-4 ${done || active ? 'bg-[#E2E8F0]' : 'bg-[#F1F5F9]'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Score IA card (if exists) */}
        {data.score_ia > 0 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#0F172A]">Score IA de votre profil</p>
                <p className="text-xs text-[#64748B] mt-0.5">Calculé automatiquement par MIAA Job</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold" style={{
                  color: data.score_ia >= 70 ? '#16A34A' : data.score_ia >= 50 ? '#F59E0B' : '#DC2626',
                }}>
                  {data.score_ia}
                </p>
                <p className="text-xs text-[#94A3B8]">/ 100</p>
              </div>
            </div>
            <div className="mt-3 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${data.score_ia}%`,
                background: data.score_ia >= 70 ? '#16A34A' : data.score_ia >= 50 ? '#F59E0B' : '#DC2626',
              }} />
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-[#FEF3C7] rounded-2xl border border-[#F59E0B]/20 p-5">
          <div className="flex items-start gap-3">
            <Mail size={16} className="text-[#F59E0B] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#92400E] mb-1">Gardez un œil sur votre email</p>
              <p className="text-xs text-[#92400E]/80">
                {data.candidat?.email
                  ? <>Un email de suivi sera envoyé à <strong>{data.candidat.email}</strong></>
                  : 'Des mises à jour vous seront envoyées par email.'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-[#94A3B8] pb-4">
          <span>Ref : {data.id.slice(0, 8).toUpperCase()}</span>
          <span>·</span>
          <span>Propulsé par <span className="font-bold text-[#F59E0B]">oraforme</span></span>
        </div>
      </main>
    </div>
  )
}
