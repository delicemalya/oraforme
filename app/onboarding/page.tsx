'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronRight, Eye, EyeOff, Check, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { createTenantAndProfile } from './actions'
import type { TailleEntreprise, SecteurId } from '@/lib/plans'

// ── Step type ─────────────────────────────────────────────────────────────────

type Step = 'plan' | 'sector' | 'form' | 'google-complete' | 'creating' | 'email-sent'

// ── Sector catalogue ──────────────────────────────────────────────────────────

interface SectorOption {
  id:       string
  label:    string
  secteur:  SecteurId
  sousType: string | null
}

// Entrepreneur — 10 secteurs
const SECTORS_TPE: SectorOption[] = [
  { id: 'commerce',    label: 'Commerce / Boutique',    secteur: 'commerce',    sousType: null          },
  { id: 'restaurant',  label: 'Restaurant',              secteur: 'restaurant',  sousType: null          },
  { id: 'pharmacie',   label: 'Pharmacie',               secteur: 'pharmacie',   sousType: null          },
  { id: 'agriculture', label: 'Agriculture',              secteur: 'agriculture', sousType: null          },
  { id: 'boulangerie', label: 'Boulangerie',              secteur: 'commerce',    sousType: 'boulangerie' },
  { id: 'boisson',     label: 'Distribution boissons',    secteur: 'boisson',     sousType: null          },
  { id: 'creche',      label: 'Crèche',                   secteur: 'ecole',       sousType: 'creche'      },
  { id: 'primaire',    label: 'Primaire',                  secteur: 'ecole',       sousType: 'primaire'    },
  { id: 'college',     label: 'Collège',                   secteur: 'ecole',       sousType: 'college'     },
  { id: 'autre',       label: 'Autre activité',            secteur: 'autre',       sousType: null          },
]

// Business — 17 secteurs
const SECTORS_PME: SectorOption[] = [
  { id: 'cabinet-comptable',  label: 'Cabinet Comptable',        secteur: 'cabinet',     sousType: 'comptable'           },
  { id: 'cabinet-fiscal',     label: 'Cabinet Fiscal',           secteur: 'cabinet',     sousType: 'fiscal'              },
  { id: 'cabinet-audit',      label: "Cabinet d'Audit",          secteur: 'cabinet',     sousType: 'audit'               },
  { id: 'cabinet-conseil',    label: 'Cabinet Conseil',          secteur: 'cabinet',     sousType: 'conseil'             },
  { id: 'cabinet-juridique',  label: 'Cabinet Juridique',        secteur: 'cabinet',     sousType: 'juridique'           },
  { id: 'cabinet-avocat',     label: "Cabinet d'Avocats",        secteur: 'cabinet',     sousType: 'avocat'              },
  { id: 'hotel',           label: 'Hôtel',                   secteur: 'hotel',       sousType: null                  },
  { id: 'universite',      label: 'Université',              secteur: 'ecole',       sousType: 'universite'          },
  { id: 'lycee',           label: 'Lycée',                   secteur: 'ecole',       sousType: 'lycee'               },
  { id: 'clinique',        label: 'Clinique',                secteur: 'sante',       sousType: 'clinique'            },
  { id: 'hopital',         label: 'Hôpital',                 secteur: 'sante',       sousType: 'hopital'             },
  { id: 'ong',             label: 'ONG',                     secteur: 'ong',         sousType: null                  },
  { id: 'logistique',      label: 'Logistique',              secteur: 'transport',   sousType: 'logistique'          },
  { id: 'transport',       label: 'Transport',               secteur: 'transport',   sousType: null                  },
  { id: 'supermarche',     label: 'Supermarché',             secteur: 'supermarche', sousType: null                  },
  { id: 'banque',          label: 'Banque',                  secteur: 'banque',      sousType: 'banque_comm'         },
  { id: 'microfinance',    label: 'Microfinance',            secteur: 'banque',      sousType: 'microfinance'        },
  { id: 'industrie',       label: 'Industrie',               secteur: 'autre',       sousType: 'industrie'           },
  { id: 'btp',             label: 'BTP',                     secteur: 'btp',         sousType: null                  },
  { id: 'petrole',         label: 'Pétrole & Mines',         secteur: 'petrole',     sousType: null                  },
  { id: 'grande_distrib',      label: 'Grande distribution',      secteur: 'supermarche', sousType: 'grande_distribution' },
  { id: 'compagnie_assurance', label: 'Compagnie d\'assurance',   secteur: 'assurance',   sousType: 'compagnie'           },
  { id: 'courtier_assurance',  label: 'Courtier en assurance',    secteur: 'assurance',   sousType: 'courtier'            },
  { id: 'agent_assurance',     label: 'Agent d\'assurance',       secteur: 'assurance',   sousType: 'agent'               },
  { id: 'autre_business',      label: 'Autre activité',           secteur: 'autre',       sousType: null                  },
]

// ── Left-panel gradient by step ───────────────────────────────────────────────

const STEP_GRADIENT: Record<Step, string> = {
  plan:            'linear-gradient(145deg,#7F1D1D 0%,#DC2626 60%,#EF4444 100%)',
  sector:          'linear-gradient(145deg,#78350F 0%,#D97706 55%,#F59E0B 100%)',
  form:            'linear-gradient(145deg,#14532D 0%,#16A34A 60%,#22C55E 100%)',
  'google-complete':'linear-gradient(145deg,#14532D 0%,#16A34A 60%,#22C55E 100%)',
  creating:        'linear-gradient(145deg,#14532D 0%,#16A34A 60%,#22C55E 100%)',
  'email-sent':    'linear-gradient(145deg,#14532D 0%,#16A34A 60%,#22C55E 100%)',
}

// Accent color for buttons on the RIGHT panel (matches left panel)
const STEP_ACCENT: Record<Step, string> = {
  plan:            '#DC2626',
  sector:          '#D97706',
  form:            '#16A34A',
  'google-complete':'#16A34A',
  creating:        '#16A34A',
  'email-sent':    '#16A34A',
}

// ── Plan features ─────────────────────────────────────────────────────────────

const PLAN_FEATURES = {
  tpe: ['TPE · ETS · Petite entreprise', '1 à 5 employés', 'Facturation & CRM', 'Trésorerie & Caisse', 'RH & Paie', 'Comptabilité SYSCOHADA'],
  pme: ['PME · Grande entreprise', 'Cabinet · ONG · Université', 'Hôtel · Clinique · Banque', '5 employés et plus', 'Modules premium activés', 'Analytics & BI · MIAA+'],
}

// ── Draft ─────────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'oraforme_onb_v5'

interface Draft {
  plan?:         TailleEntreprise
  sectorId?:     string
  nomEntreprise?: string
  telephone?:    string
}

function saveDraft(d: Draft)  { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d))         } catch {} }
function loadDraft(): Draft|null { try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null } catch { return null } }
function clearDraft()         { try { localStorage.removeItem(DRAFT_KEY)                          } catch {} }

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT = 'w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:ring-2 bg-white transition-all'

function inputStyle(step: Step) {
  const color = STEP_ACCENT[step]
  return INPUT + ` focus:border-[${color}]`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step,         setStep]         = useState<Step>('plan')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [pendingEmail, setPendingEmail] = useState('')

  // Step 1
  const [plan, setPlan] = useState<TailleEntreprise | null>(null)

  // Step 2
  const [sectorId, setSectorId] = useState('')

  // Step 3 — email/password form
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [telephone,     setTelephone]     = useState('')
  const [email,         setEmail]         = useState('')
  const [pwd,           setPwd]           = useState('')
  const [pwdConfirm,    setPwdConfirm]    = useState('')
  const [showPwd,       setShowPwd]       = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)

  // Step google-complete
  const [gcNom, setGcNom] = useState('')
  const [gcTel, setGcTel] = useState('')

  // ── Derived ────────────────────────────────────────────────────────────────
  const sectors      = plan === 'tpe' ? SECTORS_TPE : SECTORS_PME
  const selectedSect = [...SECTORS_TPE, ...SECTORS_PME].find(s => s.id === sectorId) ?? null
  const pwdMatch     = pwd === pwdConfirm
  const accent       = STEP_ACCENT[step]

  // ── Init: detect OAuth return vs fresh visit ───────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        const draft = loadDraft()
        if (draft?.plan) setPlan(draft.plan)
        return
      }

      // Already onboarded?
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (profile?.tenant_id) { window.location.href = '/dashboard'; return }

      const provider = (session.user.app_metadata?.provider as string | undefined) ?? 'email'
      const draft    = loadDraft()

      if (provider !== 'email') {
        // OAuth return → restore draft + go to google-complete
        if (draft?.plan)          setPlan(draft.plan)
        if (draft?.nomEntreprise) setGcNom(draft.nomEntreprise)
        if (draft?.telephone)     setGcTel(draft.telephone)
        if (draft?.sectorId)      setSectorId(draft.sectorId)
        setStep('google-complete')

      } else if (draft?.plan && draft?.sectorId && draft?.nomEntreprise) {
        // Email confirmation return with full draft → auto-create
        const sect = [...SECTORS_TPE, ...SECTORS_PME].find(s => s.id === draft.sectorId)
        if (sect) {
          setStep('creating')
          const result = await createTenantAndProfile({
            nomEntreprise:   draft.nomEntreprise,
            telephone:       draft.telephone || undefined,
            secteurActivite: sect.secteur,
            sousType:        sect.sousType || undefined,
            taille:          draft.plan,
            pays:            'CG',
            langue:          'fr',
            prenom:          '',
            nom:             '',
          })
          if (result.error) { setError(result.error); setStep('form'); return }
          clearDraft()
          window.location.href = '/dashboard'
        }
      }
    })
  }, [])

  // ── Create tenant ──────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (
    opts: { nom: string; tel?: string; secteur: SecteurId; sousType?: string | null; taille: TailleEntreprise },
    fallback: Step
  ) => {
    const result = await createTenantAndProfile({
      nomEntreprise:   opts.nom.trim() || 'Mon entreprise',
      telephone:       opts.tel || undefined,
      secteurActivite: opts.secteur,
      sousType:        opts.sousType || undefined,
      taille:          opts.taille,
      pays:            'CG',
      langue:          'fr',
      prenom:          '',
      nom:             '',
    })
    if (result.error) { setError(result.error); setStep(fallback); return }
    clearDraft()
    window.location.href = '/dashboard'
  }, [])

  // ── Email sign-up ──────────────────────────────────────────────────────────
  async function handleEmailSignup() {
    if (!plan || !selectedSect) return
    if (pwd !== pwdConfirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true); setError('')

    const { data, error: err } = await supabase.auth.signUp({
      email, password: pwd,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    })
    if (err) { setError(err.message); setLoading(false); return }

    if (!data.session) {
      saveDraft({ plan, sectorId, nomEntreprise, telephone })
      setPendingEmail(email)
      setStep('email-sent')
      setLoading(false)
      return
    }

    setStep('creating')
    setLoading(false)
    await handleCreate({ nom: nomEntreprise, tel: telephone, secteur: selectedSect.secteur, sousType: selectedSect.sousType, taille: plan }, 'form')
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────
  async function handleGoogle() {
    if (!plan) { setError('Veuillez d\'abord choisir une offre'); return }
    saveDraft({ plan, ...(sectorId ? { sectorId } : {}), ...(nomEntreprise.trim() ? { nomEntreprise: nomEntreprise.trim() } : {}), ...(telephone.trim() ? { telephone: telephone.trim() } : {}) })
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    })
  }

  // ── Google-complete submit ─────────────────────────────────────────────────
  async function handleGoogleComplete() {
    if (!plan || !selectedSect) return
    setLoading(true); setError('')
    setStep('creating')
    await handleCreate({ nom: gcNom, tel: gcTel || undefined, secteur: selectedSect.secteur, sousType: selectedSect.sousType, taille: plan }, 'google-complete')
    setLoading(false)
  }

  // ── Creating screen ────────────────────────────────────────────────────────
  if (step === 'creating') return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)' }}>
      <div className="text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center mx-auto mb-5">
          <Loader2 size={26} className="animate-spin" style={{ color: '#16A34A' }} />
        </div>
        <h2 className="text-[20px] font-black text-[#0F172A] mb-1">Création de votre espace…</h2>
        <p className="text-[13px] text-[#64748B]">Vos modules sont en cours d&apos;activation. Quelques secondes.</p>
      </div>
    </div>
  )

  // ── Email-sent screen ──────────────────────────────────────────────────────
  if (step === 'email-sent') return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-5">
          <Check size={28} style={{ color: '#16A34A' }} strokeWidth={3} />
        </div>
        <h2 className="text-[22px] font-black text-[#0F172A] mb-2">Vérifiez votre email</h2>
        <p className="text-[14px] text-[#64748B] mb-2">Un lien d&apos;activation a été envoyé à</p>
        <p className="text-[15px] font-black text-[#0F172A] mb-5">{pendingEmail}</p>
        <p className="text-[12px] text-[#94A3B8] mb-6">
          Cliquez sur le lien pour activer votre compte.<br />
          Vérifiez vos spams si nécessaire.
        </p>
        <Link href="/login" className="text-[#16A34A] text-[13px] font-bold hover:underline">
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  )

  // ── Left panel meta ────────────────────────────────────────────────────────
  const leftTitle =
    step === 'plan'    ? 'Choisissez\nvotre offre' :
    step === 'sector'  ? 'Votre secteur\nd\'activité' :
    'Créez\nvotre espace'

  const leftDesc =
    step === 'plan'   ? 'Deux offres conçues pour chaque niveau d\'activité. Commencez gratuitement.' :
    step === 'sector' ? `Offre ${plan === 'tpe' ? 'Entrepreneur' : 'Business'} sélectionnée. Choisissez maintenant votre secteur.` :
    step === 'google-complete' ? 'Quelques infos pour finaliser votre espace Oraforme.' :
    'Votre espace professionnel est à quelques secondes.'

  const STEP_IDX = { plan: 0, sector: 1, form: 2, 'google-complete': 2, creating: 2, 'email-sent': 2 }
  const currentIdx = STEP_IDX[step]

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT PANEL — color changes per step ──────────────────────────── */}
      <div
        className="lg:w-[42%] shrink-0 flex flex-col justify-between px-8 py-8 lg:px-12 lg:py-14 transition-all duration-500"
        style={{ background: STEP_GRADIENT[step] }}
      >
        {/* Logo + retour */}
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Oraforme" className="h-8 w-auto"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <Link href="/"
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-semibold transition-colors">
            <ArrowLeft size={13} /> Accueil
          </Link>
        </div>

        {/* Main content */}
        <div className="my-7 lg:my-0">
          <div className="inline-flex items-center bg-white/20 rounded-full px-3 py-1.5 mb-5">
            <span className="text-white text-[11px] font-bold uppercase tracking-widest">
              Inscription gratuite · 30 jours offerts
            </span>
          </div>
          <h2 className="text-2xl lg:text-[36px] font-black text-white leading-tight mb-3 lg:mb-4 whitespace-pre-line">
            {leftTitle}
          </h2>
          <p className="text-white/75 text-[13px] lg:text-[14px] leading-relaxed">
            {leftDesc}
          </p>

          {/* Plan features — shown on plan step, desktop only */}
          {step === 'plan' && (
            <div className="hidden lg:block mt-6">
              {['50+ modules ERP intégrés', 'Comptabilité SYSCOHADA', 'IA MIAA+ intégrée', 'Support francophone'].map(b => (
                <div key={b} className="flex items-center gap-3 mb-2.5">
                  <CheckCircle2 size={14} className="text-white/75 shrink-0" />
                  <span className="text-white/85 text-[13px]">{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* Selected plan summary — shown on sector/form steps */}
          {step !== 'plan' && plan && (
            <div className="hidden lg:block mt-5">
              <div className="bg-white/15 rounded-2xl p-4">
                <p className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-2">Offre sélectionnée</p>
                <p className="text-white font-black text-[15px] mb-1">
                  {plan === 'tpe' ? 'Entrepreneur — 15 000 FCFA/mois' : 'Business — 25 000 FCFA/mois'}
                </p>
                {selectedSect && (
                  <p className="text-white/70 text-[13px]">
                    Secteur : {selectedSect.label}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress dots — 3 steps */}
          <div className="flex items-center gap-2 mt-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width:      i === currentIdx ? 28 : 8,
                  background: i < currentIdx ? 'rgba(255,255,255,0.8)' : i === currentIdx ? 'white' : 'rgba(255,255,255,0.3)',
                }} />
            ))}
          </div>
        </div>

        {/* Bottom CTA — desktop only */}
        <div className="hidden lg:block">
          <p className="text-white/50 text-[12px] mb-3">Déjà un compte ?</p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-white/30 text-white text-[13px] font-bold hover:bg-white/10 hover:border-white/50 transition-all">
            Se connecter <ChevronRight size={14} />
          </Link>
          <p className="text-white/40 text-[11px] mt-2">Sans carte bancaire · Annulable à tout moment</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 lg:px-16 bg-white">
        <div className="w-full max-w-md">

          {/* ════════════════════════════════════════════════════════════
              ÉTAPE 1 — Choix de l'offre
          ════════════════════════════════════════════════════════════ */}
          {step === 'plan' && (
            <div>
              <h1 className="text-[22px] font-black text-[#0F172A] mb-1">Quelle offre vous convient ?</h1>
              <p className="text-[13px] text-[#64748B] mb-7">Choisissez selon votre taille et votre activité.</p>

              <div className="space-y-3 mb-7">

                {/* Entrepreneur */}
                <button type="button" onClick={() => setPlan('tpe')}
                  className="w-full p-5 rounded-2xl border-2 text-left transition-all"
                  style={{
                    borderColor: plan === 'tpe' ? '#DC2626' : '#E2E8F0',
                    background:  plan === 'tpe' ? '#FEF2F2' : 'white',
                  }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[16px] font-black" style={{ color: plan === 'tpe' ? '#991B1B' : '#0F172A' }}>
                          Entrepreneur
                        </p>
                        <span className="text-[11px] font-black text-[#DC2626]">15 000 FCFA/mois</span>
                      </div>
                      <div className="space-y-1">
                        {PLAN_FEATURES.tpe.map(f => (
                          <p key={f} className="text-[11px] text-[#64748B] leading-tight flex items-center gap-1.5">
                            <span style={{ color: plan === 'tpe' ? '#DC2626' : '#CBD5E1' }}>·</span> {f}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5">
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{ borderColor: plan === 'tpe' ? '#DC2626' : '#CBD5E1', background: plan === 'tpe' ? '#DC2626' : 'white' }}>
                        {plan === 'tpe' && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Business */}
                <button type="button" onClick={() => setPlan('pme')}
                  className="w-full p-5 rounded-2xl border-2 text-left relative transition-all"
                  style={{
                    borderColor: plan === 'pme' ? '#D97706' : '#E2E8F0',
                    background:  plan === 'pme' ? '#FFFBEB' : 'white',
                  }}>
                  <span className="absolute top-3 right-12 px-2 py-0.5 bg-[#D97706] text-white text-[10px] font-black rounded-full uppercase">
                    Populaire
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[16px] font-black" style={{ color: plan === 'pme' ? '#92400E' : '#0F172A' }}>
                          Business
                        </p>
                        <span className="text-[11px] font-black text-[#D97706]">25 000 FCFA/mois</span>
                      </div>
                      <div className="space-y-1">
                        {PLAN_FEATURES.pme.map(f => (
                          <p key={f} className="text-[11px] text-[#64748B] leading-tight flex items-center gap-1.5">
                            <span style={{ color: plan === 'pme' ? '#D97706' : '#CBD5E1' }}>·</span> {f}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5">
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{ borderColor: plan === 'pme' ? '#D97706' : '#CBD5E1', background: plan === 'pme' ? '#D97706' : 'white' }}>
                        {plan === 'pme' && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => { if (plan) setStep('sector') }}
                disabled={!plan}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: accent }}>
                Continuer <ChevronRight size={16} />
              </button>

              <p className="text-center text-[12px] text-[#94A3B8] mt-5">
                Déjà un compte ?{' '}
                <Link href="/login" className="font-bold hover:underline" style={{ color: accent }}>Se connecter</Link>
              </p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              ÉTAPE 2 — Choix du secteur
          ════════════════════════════════════════════════════════════ */}
          {step === 'sector' && (
            <div>
              {/* Breadcrumb */}
              <button onClick={() => setStep('plan')} className="flex items-center gap-1.5 mb-5 group">
                <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full text-white"
                  style={{ background: '#DC2626' }}>
                  {plan === 'tpe' ? 'Entrepreneur' : 'Business'}
                </span>
                <span className="text-[11px] text-[#94A3B8] group-hover:text-[#64748B]">← Changer</span>
              </button>

              <h1 className="text-[22px] font-black text-[#0F172A] mb-1">Votre secteur d&apos;activité</h1>
              <p className="text-[13px] text-[#64748B] mb-6">
                {plan === 'tpe'
                  ? 'Secteurs disponibles pour l\'offre Entrepreneur.'
                  : 'Secteurs disponibles pour l\'offre Business.'}
              </p>

              <div className="grid grid-cols-2 gap-2 mb-7">
                {sectors.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => setSectorId(s.id)}
                    className="px-3 py-3 rounded-xl border-2 text-left text-[12px] font-semibold transition-all leading-tight"
                    style={{
                      borderColor: sectorId === s.id ? accent : '#E2E8F0',
                      background:  sectorId === s.id ? (plan === 'tpe' ? '#FEF2F2' : '#FFFBEB') : 'white',
                      color:       sectorId === s.id ? (plan === 'tpe' ? '#991B1B' : '#92400E') : '#0F172A',
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => { if (sectorId) setStep('form') }}
                disabled={!sectorId}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: accent }}>
                Continuer <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              ÉTAPE 3 — Création du compte
          ════════════════════════════════════════════════════════════ */}
          {step === 'form' && (
            <div>
              {/* Breadcrumb */}
              <button onClick={() => setStep('sector')} className="flex items-center gap-1.5 mb-5 group">
                <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full text-white"
                  style={{ background: accent }}>
                  {selectedSect?.label ?? (plan === 'tpe' ? 'Entrepreneur' : 'Business')}
                </span>
                <span className="text-[11px] text-[#94A3B8] group-hover:text-[#64748B]">← Changer</span>
              </button>

              <h1 className="text-[22px] font-black text-[#0F172A] mb-1">Créez votre espace</h1>
              <p className="text-[13px] text-[#64748B] mb-6">Votre tableau de bord vous attend.</p>

              {/* Google OAuth */}
              <button type="button" onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] hover:border-gray-300 hover:bg-gray-50 transition-all mb-4">
                <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                  <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20c11 0 19.7-7.7 19.7-20 0-1.3-.1-2.7-.2-3z" fill="#FFC107"/>
                  <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.7 0-14.4 4.4-17.7 11.7z" fill="#FF3D00"/>
                  <path d="M24 43c5.6 0 10.3-1.9 14-5.1l-6.5-5.5C29.5 34.3 26.9 35 24 35c-6.1 0-11.2-4.1-13.1-9.6l-7 5.4C7.2 38.3 15 43 24 43z" fill="#4CAF50"/>
                  <path d="M44.5 20H24v8.5h11.8c-.7 2.2-2.1 4.1-4 5.4l6.5 5.5C41.7 36.3 44.5 30 44.5 23c0-1-.1-2-.2-3z" fill="#1976D2"/>
                </svg>
                Continuer avec Google
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              <div className="space-y-3 mb-4">

                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Nom de l&apos;entreprise <span className="text-[#DC2626]">*</span>
                  </label>
                  <input type="text" value={nomEntreprise} onChange={e => setNomEntreprise(e.target.value)}
                    placeholder="Ma société SARL"
                    className={INPUT}
                    style={{ '--tw-ring-color': accent } as React.CSSProperties} />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Téléphone <span className="text-[#DC2626]">*</span>
                  </label>
                  <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
                    placeholder="+242 06 xxx xxxx" className={INPUT} />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Adresse email <span className="text-[#DC2626]">*</span>
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="vous@entreprise.com" className={INPUT} />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Mot de passe <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={pwd}
                      onChange={e => setPwd(e.target.value)}
                      placeholder="8 caractères minimum" autoComplete="new-password"
                      className={INPUT + ' pr-11'} />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {pwd.length > 0 && pwd.length < 8 && (
                    <p className="text-[#DC2626] text-[11px] mt-1">8 caractères minimum</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Confirmer le mot de passe <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={pwdConfirm}
                      onChange={e => setPwdConfirm(e.target.value)}
                      placeholder="Répétez le mot de passe" autoComplete="new-password"
                      className={INPUT + ' pr-11'} />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {pwdConfirm.length > 0 && !pwdMatch && (
                    <p className="text-[#DC2626] text-[11px] mt-1">Les mots de passe ne correspondent pas.</p>
                  )}
                  {pwdConfirm.length > 0 && pwdMatch && pwd.length >= 8 && (
                    <p className="text-[#16A34A] text-[11px] mt-1 flex items-center gap-1">
                      <Check size={11} strokeWidth={3} /> Mots de passe identiques
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl text-[12px] text-red-700"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>{error}</div>
              )}

              <button onClick={handleEmailSignup}
                disabled={
                  !nomEntreprise.trim() || !telephone.trim() ||
                  !email.includes('@') || pwd.length < 8 ||
                  !pwdMatch || loading
                }
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: accent }}>
                {loading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <>Créer mon espace Oraforme <ChevronRight size={16} /></>}
              </button>

              <p className="text-center text-[11px] text-[#94A3B8] mt-4">
                En créant un compte vous acceptez les{' '}
                <a href="/cgu" className="underline hover:opacity-80" style={{ color: accent }}>conditions générales</a>.
              </p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              ÉTAPE GOOGLE — Complétion après OAuth
          ════════════════════════════════════════════════════════════ */}
          {step === 'google-complete' && (
            <div>
              <div className="mb-5">
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wide text-white"
                  style={{ background: accent }}>
                  {plan === 'tpe' ? 'Entrepreneur' : 'Business'}
                  {selectedSect ? ` · ${selectedSect.label}` : ''}
                </span>
              </div>

              <h1 className="text-[22px] font-black text-[#0F172A] mb-1">Presque là !</h1>
              <p className="text-[13px] text-[#64748B] mb-6">
                Complétez les informations de votre entreprise pour finaliser.
              </p>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Nom de l&apos;entreprise <span className="text-[#DC2626]">*</span>
                  </label>
                  <input type="text" value={gcNom} onChange={e => setGcNom(e.target.value)}
                    placeholder="Ma société SARL" className={INPUT} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Téléphone
                  </label>
                  <input type="tel" value={gcTel} onChange={e => setGcTel(e.target.value)}
                    placeholder="+242 06 xxx xxxx" className={INPUT} />
                </div>

                {/* If sector was not saved in draft, show selector */}
                {!sectorId && plan && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                      Secteur d&apos;activité <span className="text-[#DC2626]">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(plan === 'tpe' ? SECTORS_TPE : SECTORS_PME).map(s => (
                        <button key={s.id} type="button"
                          onClick={() => setSectorId(s.id)}
                          className="px-3 py-2.5 rounded-xl border-2 text-left text-[11px] font-semibold transition-all"
                          style={{
                            borderColor: sectorId === s.id ? accent : '#E2E8F0',
                            background:  sectorId === s.id ? '#F0FDF4' : 'white',
                            color:       sectorId === s.id ? '#14532D'  : '#0F172A',
                          }}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl text-[12px] text-red-700"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>{error}</div>
              )}

              <button onClick={handleGoogleComplete}
                disabled={!gcNom.trim() || (!sectorId && !selectedSect) || loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: accent }}>
                {loading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <>Accéder à mon tableau de bord <ChevronRight size={16} /></>}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
