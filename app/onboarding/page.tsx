'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, ChevronLeft, Eye, EyeOff, Zap, Sparkles, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { createTenantAndProfile } from './actions'
import { PLAN_CONFIG, type TailleEntreprise, type SecteurId } from '@/lib/plans'

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 'plan' | 'account' | 'sector' | 'subtype' | 'info' | 'creating' | 'welcome' | 'email-sent'

interface OnboardingDraft {
  explicitPlan: TailleEntreprise | null
  secteurId:   string | null   // id dans NEW_SECTORS (ex. 'ecole', 'clinique')
  secteur:     SecteurId | null
  sousType:    string | null
  step:        Step
}

// ── Sector catalogue (14 secteurs mission) ─────────────────────────────────────

interface SectorDef {
  id:       string
  label:    string
  emoji:    string
  secteur:  SecteurId
  sousType: string | null   // null = step subtype sera affiché
}

const NEW_SECTORS: SectorDef[] = [
  { id: 'ecole',        label: 'École & Université', emoji: '🎓', secteur: 'ecole',      sousType: null          },
  { id: 'cabinet',      label: 'Cabinet',            emoji: '📊', secteur: 'cabinet',    sousType: null          },
  { id: 'restaurant',   label: 'Restaurant',         emoji: '🍽️', secteur: 'restaurant', sousType: null          },
  { id: 'hotel',        label: 'Hôtel',              emoji: '🏨', secteur: 'hotel',      sousType: null          },
  { id: 'sante',        label: 'Clinique / Hôpital', emoji: '🏥', secteur: 'sante',      sousType: null          },
  { id: 'pharmacie',    label: 'Pharmacie',          emoji: '💊', secteur: 'pharmacie',  sousType: null          },
  { id: 'commerce',     label: 'Commerce / Boutique',emoji: '🛒', secteur: 'commerce',   sousType: null          },
  { id: 'supermarche',  label: 'Supermarché',        emoji: '🏪', secteur: 'supermarche',sousType: null          },
  { id: 'transport',    label: 'Transport VTC',      emoji: '🚖', secteur: 'transport',  sousType: 'taxi'        },
  { id: 'logistique',   label: 'Logistique / Fret',  emoji: '🚛', secteur: 'transport',  sousType: 'freight'     },
  { id: 'banque',       label: 'Banque',             emoji: '🏦', secteur: 'banque',     sousType: 'banque_comm' },
  { id: 'microfinance', label: 'Microfinance',       emoji: '💰', secteur: 'banque',     sousType: 'microfinance'},
  { id: 'btp',          label: 'BTP & Construction', emoji: '🏗️', secteur: 'btp',        sousType: null          },
  { id: 'agriculture',  label: 'Agriculture',        emoji: '🌾', secteur: 'agriculture',sousType: null          },
  { id: 'ong',          label: 'ONG / Association',  emoji: '🤝', secteur: 'ong',        sousType: null          },
  { id: 'industrie',    label: 'Industrie',          emoji: '🏭', secteur: 'autre',      sousType: 'industrie'   },
  { id: 'boisson',      label: 'Distribution Boisson',emoji: '🍶',secteur: 'boisson',    sousType: null          },
  { id: 'petrole',      label: 'Pétrole & Mines',    emoji: '⛽', secteur: 'petrole',    sousType: null          },
  { id: 'autre',        label: 'Autre activité',     emoji: '⚡', secteur: 'autre',      sousType: null          },
]

// Sous-types affichés à l'étape 4 pour les secteurs qui le nécessitent
const SUBTYPES_FOR_DISPLAY: Record<string, Array<{ id: string; label: string; emoji: string; plan: TailleEntreprise; desc?: string }>> = {
  ecole: [
    { id: 'garderie',   label: 'Garderie',          emoji: '🐣', plan: 'tpe',   desc: 'Enfants 0-6 ans' },
    { id: 'primaire',   label: 'École Primaire',    emoji: '📚', plan: 'tpe',   desc: 'CP à CM2' },
    { id: 'college',    label: 'Collège',           emoji: '🏫', plan: 'tpe',   desc: '6e à 3e' },
    { id: 'lycee',      label: 'Lycée',             emoji: '🎒', plan: 'pme',   desc: '2nde à Terminale' },
    { id: 'universite', label: 'Université / ISTA', emoji: '🎓', plan: 'grande',desc: 'LMD · Doctorat' },
  ],
  hotel: [
    { id: 'hotel_bud', label: 'Auberge / Guesthouse',  emoji: '🏠', plan: 'tpe',   desc: 'Petite structure' },
    { id: 'hotel_std', label: 'Hôtel Standard',         emoji: '🏨', plan: 'pme',   desc: '2-3 étoiles' },
    { id: 'hotel_lux', label: 'Resort & Luxe',          emoji: '⭐', plan: 'grande', desc: '4-5 étoiles' },
  ],
  cabinet: [
    { id: 'comptable', label: 'Cabinet Comptable',  emoji: '📊', plan: 'pme', desc: 'Tenue comptable · Bilan · IS' },
    { id: 'fiscal',    label: 'Cabinet Fiscal',     emoji: '🏛️', plan: 'pme', desc: 'TVA · IS · Déclarations DGI' },
    { id: 'audit',     label: "Cabinet d'Audit",    emoji: '🔍', plan: 'pme', desc: 'Audit légal · Commissariat' },
    { id: 'conseil',   label: 'Cabinet Conseil',    emoji: '💡', plan: 'pme', desc: 'Stratégie · Management · RH' },
    { id: 'juridique', label: 'Cabinet Juridique',  emoji: '⚖️', plan: 'pme', desc: 'Droit des affaires · Contrats' },
  ],
  sante: [
    { id: 'clinique',    label: 'Clinique / Polyclinique', emoji: '🏥', plan: 'pme',   desc: 'Soins & consultations' },
    { id: 'hopital',     label: 'Hôpital',                emoji: '🏨', plan: 'grande', desc: 'Centre hospitalier complet' },
    { id: 'cabinet_med', label: 'Cabinet Médical',         emoji: '👨‍⚕️', plan: 'tpe',  desc: 'Médecin généraliste/spécialiste' },
  ],
  restaurant: [
    { id: 'restaurant_std', label: 'Restaurant',        emoji: '🍽️', plan: 'pme', desc: 'Service à table · Cuisine' },
    { id: 'snack',          label: 'Snack / Fast Food',  emoji: '🌮', plan: 'tpe', desc: 'Vente rapide · Emporter' },
    { id: 'brasserie',      label: 'Brasserie / Bar',    emoji: '🍺', plan: 'tpe', desc: 'Boissons & petite restauration' },
  ],
  commerce: [
    { id: 'boutique',          label: 'Boutique',          emoji: '🛍️', plan: 'tpe', desc: 'Vente de détail' },
    { id: 'artisan',           label: 'Artisan',            emoji: '🔨', plan: 'tpe', desc: 'Menuiserie, couture, bijoux...' },
    { id: 'petite_entreprise', label: 'Petite entreprise',  emoji: '💼', plan: 'tpe', desc: 'PME · Services généraux' },
    { id: 'pme_simple',        label: 'PME',                emoji: '🏢', plan: 'pme', desc: 'PME en croissance' },
  ],
}

// Plan auto-dérivé depuis sector/subtype existant
const SECTOR_DEFAULT_PLAN: Record<string, TailleEntreprise> = {
  commerce: 'tpe', boutique: 'tpe', supermarche: 'tpe',
  restaurant: 'pme', pharmacie: 'pme', btp: 'pme', agriculture: 'pme',
  ong: 'pme', cabinet: 'pme', boisson: 'pme', petrole: 'pme', autre: 'pme',
  ecole: 'pme', sante: 'pme', hotel: 'pme', transport: 'pme', banque: 'grande',
}

const SUBTYPE_PLAN: Record<string, TailleEntreprise> = {
  // École
  garderie: 'tpe', primaire: 'tpe', college: 'tpe', lycee: 'pme', universite: 'grande',
  // Cabinet
  comptable: 'pme', fiscal: 'pme', audit: 'pme', conseil: 'pme', juridique: 'pme',
  // Santé
  cabinet_med: 'tpe', clinique: 'pme', hopital: 'grande',
  // Banque
  microfinance: 'pme', banque_comm: 'grande',
  // Hôtel
  hotel_bud: 'tpe', hotel_std: 'pme', hotel_lux: 'grande',
  // Transport
  taxi: 'tpe', bus: 'pme', freight: 'grande',
  // Restaurant
  snack: 'tpe', brasserie: 'tpe', restaurant_std: 'pme',
  // Commerce
  boutique: 'tpe', artisan: 'tpe', petite_entreprise: 'tpe', pme_simple: 'pme',
  // Autre
  industrie: 'pme',
}

const PLAN_LEVELS: Record<TailleEntreprise, number> = { tpe: 0, pme: 1, grande: 2 }

function maxPlan(a: TailleEntreprise, b: TailleEntreprise): TailleEntreprise {
  return PLAN_LEVELS[a] >= PLAN_LEVELS[b] ? a : b
}

// ── Draft persistence (localStorage) ──────────────────────────────────────────

const DRAFT_KEY = 'oraforme_onb_v2'

function saveDraft(d: Partial<OnboardingDraft>) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch {}
}

function loadDraft(): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) as OnboardingDraft : null
  } catch { return null }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch {}
}

// ── Progress bar ───────────────────────────────────────────────────────────────

// Steps that count toward the progress bar (excluding creating/welcome/email-sent)
const PROGRESS_STEPS: Step[] = ['plan', 'account', 'sector', 'subtype', 'info']

function progressPct(step: Step, hasSubtype: boolean): number {
  const steps = hasSubtype ? PROGRESS_STEPS : PROGRESS_STEPS.filter(s => s !== 'subtype')
  const idx = steps.indexOf(step)
  if (idx < 0) return 100
  return Math.round(((idx + 1) / steps.length) * 100)
}

// ── Shared input style ─────────────────────────────────────────────────────────

const INPUT = 'w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15 bg-white'

// ── Component ──────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  // ── State ──────────────────────────────────────────────────────────────────
  const [step,        setStep]        = useState<Step>('plan')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [isOAuth,     setIsOAuth]     = useState(false)
  const [pendingEmail,setPendingEmail]= useState('')

  // Step plan
  const [explicitPlan, setExplicitPlan] = useState<TailleEntreprise | null>(null)

  // Step account
  const [email,    setEmail]    = useState('')
  const [pwd,      setPwd]      = useState('')
  const [pwdConf,  setPwdConf]  = useState('')
  const [showPwd,  setShowPwd]  = useState(false)

  // Step sector
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null)

  // Step subtype
  const [sousType, setSousType] = useState<string | null>(null)

  // Step info
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [telephone,     setTelephone]     = useState('')

  // Derived
  const selectedSectorDef = NEW_SECTORS.find(s => s.id === selectedSectorId) ?? null
  const needsSubtype       = selectedSectorDef !== null && SUBTYPES_FOR_DISPLAY[selectedSectorDef.secteur] !== undefined && selectedSectorDef.sousType === null
  const effectiveSousType  = selectedSectorDef?.sousType ?? (needsSubtype ? sousType : null)

  const sectorDerivedPlan: TailleEntreprise =
    (effectiveSousType ? SUBTYPE_PLAN[effectiveSousType] : null) ??
    (selectedSectorDef ? SECTOR_DEFAULT_PLAN[selectedSectorDef.secteur] : null) ??
    'pme'

  const finalPlan: TailleEntreprise = explicitPlan ? maxPlan(explicitPlan, sectorDerivedPlan) : sectorDerivedPlan
  const planCfg = PLAN_CONFIG[finalPlan]
  const planUpgraded = explicitPlan && PLAN_LEVELS[sectorDerivedPlan] > PLAN_LEVELS[explicitPlan]

  // ── Init — restore draft + check session ──────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        // No session — start fresh or restore draft
        const draft = loadDraft()
        if (draft?.explicitPlan) setExplicitPlan(draft.explicitPlan)
        if (draft?.secteurId)    setSelectedSectorId(draft.secteurId)
        if (draft?.sousType)     setSousType(draft.sousType)
        if (draft?.step && !['welcome','creating','email-sent'].includes(draft.step)) {
          setStep(draft.step)
        }
        return
      }

      // Session exists
      const identities = session.user.identities ?? []
      setIsOAuth(identities.some(i => i.provider !== 'email'))
      setEmail(session.user.email ?? '')

      // Already has profile → go to dashboard
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (profile?.tenant_id) {
        window.location.href = '/dashboard'
        return
      }

      // Session but no profile → restore draft and jump to sector step
      const draft = loadDraft()
      if (draft?.explicitPlan) setExplicitPlan(draft.explicitPlan)
      if (draft?.secteurId)    setSelectedSectorId(draft.secteurId)
      if (draft?.sousType)     setSousType(draft.sousType)

      // Jump past account step since user is already authenticated
      const nextStep: Step = draft?.secteurId ? (needsSubtype && !draft.sousType ? 'subtype' : 'info') : 'sector'
      setStep(nextStep)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Navigation helpers ─────────────────────────────────────────────────────

  function goTo(s: Step) {
    setError('')
    setStep(s)
  }

  function back() {
    if (step === 'account')  goTo('plan')
    if (step === 'sector')   goTo(isOAuth ? 'plan' : 'account')
    if (step === 'subtype')  goTo('sector')
    if (step === 'info') {
      const d = NEW_SECTORS.find(s => s.id === selectedSectorId)
      const nb = d && SUBTYPES_FOR_DISPLAY[d.secteur] && d.sousType === null
      goTo(nb ? 'subtype' : 'sector')
    }
  }

  // ── Email sign-up ──────────────────────────────────────────────────────────

  async function handleEmailSignup() {
    setLoading(true); setError('')
    if (pwd !== pwdConf) { setError('Les mots de passe ne correspondent pas.'); setLoading(false); return }

    // Save draft so we can restore after email confirmation
    saveDraft({ explicitPlan, step: 'sector', secteurId: null, secteur: null, sousType: null })

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password: pwd,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    })
    if (err) { setError(err.message); setLoading(false); return }

    if (!data.session) {
      // Email confirmation required
      setPendingEmail(email)
      goTo('email-sent')
      setLoading(false)
      return
    }

    // Instant session (email confirmation disabled)
    goTo('sector')
    setLoading(false)
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  async function handleGoogle() {
    saveDraft({ explicitPlan, step: 'sector', secteurId: null, secteur: null, sousType: null })
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    })
  }

  // ── Final submit ───────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!selectedSectorDef) return
    setStep('creating')

    const result = await createTenantAndProfile({
      nomEntreprise:   nomEntreprise.trim() || 'Mon entreprise',
      telephone:       telephone || undefined,
      secteurActivite: selectedSectorDef.secteur,
      sousType:        effectiveSousType || undefined,
      taille:          finalPlan,
      pays:            'CG',
      langue:          'fr',
      prenom:          '',
      nom:             '',
    })

    if (result.error) {
      setError(result.error)
      setStep('info')
      return
    }

    clearDraft()
    setStep('welcome')
  }, [selectedSectorDef, nomEntreprise, telephone, effectiveSousType, finalPlan])

  // Auto-trigger creation when reaching 'creating' step
  useEffect(() => {
    if (step === 'creating') handleCreate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Redirect after welcome ─────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 'welcome') return
    const t = setTimeout(() => { window.location.href = '/dashboard' }, 3000)
    return () => clearTimeout(t)
  }, [step])

  // ── Sector selection handler ───────────────────────────────────────────────

  function selectSector(def: SectorDef) {
    setSelectedSectorId(def.id)
    setSousType(null)
    saveDraft({ explicitPlan, secteurId: def.id, secteur: def.secteur, sousType: null, step: 'sector' })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const pct = progressPct(step, needsSubtype)

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-start px-4 py-8">

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Oraforme" className="h-8 w-auto"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      </div>

      {/* ── Progress bar (steps 1-5 only) ─────────────────────────────────── */}
      {!['creating','welcome','email-sent'].includes(step) && (
        <div className="w-full max-w-md mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider">
              {step === 'plan'    ? 'Votre offre'          :
               step === 'account'? 'Votre compte'         :
               step === 'sector' ? 'Votre secteur'        :
               step === 'subtype'? 'Type d\'établissement':
                                   'Informations'}
            </span>
            <span className="text-[12px] font-black text-[#F59E0B]">{pct}%</span>
          </div>
          <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div className="h-full bg-[#F59E0B] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="w-full max-w-md">

        {/* ════════════════════════════════════════════════════════════════
            ÉTAPE 1 — Choix de l'offre
        ════════════════════════════════════════════════════════════════ */}
        {step === 'plan' && (
          <div>
            <h1 className="text-[24px] font-black text-[#0F172A] mb-1">Choisissez votre offre</h1>
            <p className="text-[14px] text-[#64748B] mb-8">30 jours gratuits · Sans carte bancaire</p>

            <div className="space-y-3 mb-8">

              {/* Entrepreneur */}
              <button type="button"
                onClick={() => setExplicitPlan('tpe')}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                  explicitPlan === 'tpe'
                    ? 'border-[#F59E0B] bg-[#FEF3C7]'
                    : 'border-[#E2E8F0] bg-white hover:border-[#F59E0B]/40'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <p className={`text-[16px] font-black ${explicitPlan === 'tpe' ? 'text-[#92400E]' : 'text-[#0F172A]'}`}>
                        Entrepreneur
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">TPE · Petite activité</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-[#F59E0B]">
                      {new Intl.NumberFormat('fr-FR').format(PLAN_CONFIG.tpe.price_fcfa)}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">FCFA/mois</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['Facturation', 'CRM', 'Trésorerie', 'RH', 'Dépenses', 'Rapports'].map(f => (
                    <span key={f} className="px-2 py-0.5 bg-white border border-[#E2E8F0] rounded-lg text-[11px] text-[#475569]">{f}</span>
                  ))}
                </div>
                {explicitPlan === 'tpe' && (
                  <div className="flex items-center gap-1.5 mt-3 text-[#16A34A] text-[12px] font-bold">
                    <Check size={13} /> Sélectionné
                  </div>
                )}
              </button>

              {/* Business */}
              <button type="button"
                onClick={() => setExplicitPlan('pme')}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden ${
                  explicitPlan === 'pme'
                    ? 'border-[#F59E0B] bg-[#FEF3C7]'
                    : 'border-[#E2E8F0] bg-white hover:border-[#F59E0B]/40'
                }`}>
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-black rounded-full">
                    POPULAIRE
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💼</span>
                    <div>
                      <p className={`text-[16px] font-black ${explicitPlan === 'pme' ? 'text-[#92400E]' : 'text-[#0F172A]'}`}>
                        Business
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">PME · Activité en croissance</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-[#F59E0B]">
                      {new Intl.NumberFormat('fr-FR').format(PLAN_CONFIG.pme.price_fcfa)}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">FCFA/mois</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['Tout Entrepreneur', '+Comptabilité', '+Stock', '+Achats', '+Workflows', 'MIAA+'].map(f => (
                    <span key={f} className={`px-2 py-0.5 rounded-lg text-[11px] ${f.startsWith('+') ? 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/30' : 'bg-white border border-[#E2E8F0] text-[#475569]'}`}>{f}</span>
                  ))}
                </div>
                {explicitPlan === 'pme' && (
                  <div className="flex items-center gap-1.5 mt-3 text-[#16A34A] text-[12px] font-bold">
                    <Check size={13} /> Sélectionné
                  </div>
                )}
              </button>
            </div>

            <button
              onClick={() => { if (explicitPlan) goTo('account') }}
              disabled={!explicitPlan}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: explicitPlan ? '#F59E0B' : '#E2E8F0', color: explicitPlan ? 'white' : '#94A3B8' }}>
              Continuer <ChevronRight size={16} />
            </button>

            <p className="text-center text-[12px] text-[#94A3B8] mt-4">
              Déjà un compte ?{' '}
              <a href="/login" className="text-[#F59E0B] font-bold hover:underline">Se connecter</a>
            </p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ÉTAPE 2 — Création compte
        ════════════════════════════════════════════════════════════════ */}
        {step === 'account' && (
          <div>
            <button onClick={back} className="flex items-center gap-1.5 text-[#64748B] text-[13px] font-bold mb-6 hover:text-[#0F172A]">
              <ChevronLeft size={14} /> Retour
            </button>

            <h1 className="text-[24px] font-black text-[#0F172A] mb-1">Créez votre compte</h1>
            <p className="text-[14px] text-[#64748B] mb-6">Vous serez propriétaire de l&apos;espace.</p>

            {/* Google OAuth */}
            <button type="button" onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-[#E2E8F0] bg-white text-[14px] font-bold text-[#374151] hover:bg-[#F8FAFC] hover:border-[#D1D5DB] transition-all mb-4">
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20c11 0 19.7-7.7 19.7-20 0-1.3-.1-2.7-.2-3z" fill="#FFC107"/>
                <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.7 0-14.4 4.4-17.7 11.7z" fill="#FF3D00"/>
                <path d="M24 43c5.6 0 10.3-1.9 14-5.1l-6.5-5.5C29.5 34.3 26.9 35 24 35c-6.1 0-11.2-4.1-13.1-9.6l-7 5.4C7.2 38.3 15 43 24 43z" fill="#4CAF50"/>
                <path d="M44.5 20H24v8.5h11.8c-.7 2.2-2.1 4.1-4 5.4l6.5 5.5C41.7 36.3 44.5 30 44.5 23c0-1-.1-2-.2-3z" fill="#1976D2"/>
              </svg>
              Continuer avec Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-[12px] text-[#94A3B8] font-medium">ou</span>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="vous@entreprise.com" className={INPUT} />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Mot de passe</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={pwd}
                    onChange={e => setPwd(e.target.value)}
                    placeholder="8 caractères minimum"
                    autoComplete="new-password"
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
                <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Confirmer le mot de passe</label>
                <input type="password" value={pwdConf} onChange={e => setPwdConf(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  autoComplete="new-password"
                  className={INPUT} />
                {pwdConf.length > 0 && pwd !== pwdConf && (
                  <p className="text-[#DC2626] text-[11px] mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[13px] text-[#DC2626]">
                {error}
              </div>
            )}

            <button
              onClick={handleEmailSignup}
              disabled={!email.includes('@') || pwd.length < 8 || pwd !== pwdConf || loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: (!email.includes('@') || pwd.length < 8 || pwd !== pwdConf || loading) ? '#E2E8F0' : '#F59E0B',
                color:      (!email.includes('@') || pwd.length < 8 || pwd !== pwdConf || loading) ? '#94A3B8' : 'white',
              }}>
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <>Créer mon compte <ChevronRight size={16} /></>
              }
            </button>

            <p className="text-center text-[11px] text-[#94A3B8] mt-4">
              En créant un compte vous acceptez les{' '}
              <a href="/cgu" className="underline hover:text-[#F59E0B]">conditions générales</a>.
            </p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            EMAIL ENVOYÉ
        ════════════════════════════════════════════════════════════════ */}
        {step === 'email-sent' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-5">
              <Check size={28} className="text-[#16A34A]" />
            </div>
            <h2 className="text-[22px] font-black text-[#0F172A] mb-2">Vérifiez votre email</h2>
            <p className="text-[14px] text-[#64748B] mb-2">
              Un lien d&apos;activation a été envoyé à
            </p>
            <p className="text-[14px] font-black text-[#0F172A] mb-5">{pendingEmail}</p>
            <p className="text-[12px] text-[#94A3B8] mb-6">
              Cliquez sur le lien dans l&apos;email pour activer votre compte.<br />
              Pensez à vérifier les spams.
            </p>
            <a href="/login" className="text-[#F59E0B] text-[13px] font-bold hover:underline">
              ← Retour à la connexion
            </a>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ÉTAPE 3 — Choix du secteur
        ════════════════════════════════════════════════════════════════ */}
        {step === 'sector' && (
          <div>
            {!isOAuth && (
              <button onClick={back} className="flex items-center gap-1.5 text-[#64748B] text-[13px] font-bold mb-6 hover:text-[#0F172A]">
                <ChevronLeft size={14} /> Retour
              </button>
            )}

            <h1 className="text-[24px] font-black text-[#0F172A] mb-1">Votre secteur d&apos;activité</h1>
            <p className="text-[14px] text-[#64748B] mb-6">Oraforme s&apos;adapte automatiquement.</p>

            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {NEW_SECTORS.map(s => (
                <button key={s.id} type="button"
                  onClick={() => selectSector(s)}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                    selectedSectorId === s.id
                      ? 'border-[#F59E0B] bg-[#FEF3C7]'
                      : 'border-[#E2E8F0] bg-white hover:border-[#F59E0B]/40 hover:bg-[#FFFBEB]'
                  }`}>
                  <span className="text-xl shrink-0">{s.emoji}</span>
                  <span className={`text-[13px] font-bold leading-tight ${selectedSectorId === s.id ? 'text-[#92400E]' : 'text-[#374151]'}`}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (!selectedSectorDef) return
                if (needsSubtype) goTo('subtype')
                else goTo('info')
              }}
              disabled={!selectedSectorId}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: selectedSectorId ? '#F59E0B' : '#E2E8F0', color: selectedSectorId ? 'white' : '#94A3B8' }}>
              Continuer <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ÉTAPE 4 — Sous-type (conditionnel)
        ════════════════════════════════════════════════════════════════ */}
        {step === 'subtype' && selectedSectorDef && (
          <div>
            <button onClick={back} className="flex items-center gap-1.5 text-[#64748B] text-[13px] font-bold mb-6 hover:text-[#0F172A]">
              <ChevronLeft size={14} /> Retour
            </button>

            <h1 className="text-[24px] font-black text-[#0F172A] mb-1">
              {selectedSectorDef.emoji} Quel type ?
            </h1>
            <p className="text-[14px] text-[#64748B] mb-6">Précisez votre type d&apos;établissement.</p>

            <div className="space-y-2.5 mb-6">
              {(SUBTYPES_FOR_DISPLAY[selectedSectorDef.secteur] ?? []).map(st => {
                const stPlanCfg = PLAN_CONFIG[st.plan]
                return (
                  <button key={st.id} type="button"
                    onClick={() => setSousType(st.id)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                      sousType === st.id
                        ? 'border-[#F59E0B] bg-[#FEF3C7]'
                        : 'border-[#E2E8F0] bg-white hover:border-[#F59E0B]/40'
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{st.emoji}</span>
                      <div className="text-left">
                        <p className={`text-[14px] font-bold ${sousType === st.id ? 'text-[#92400E]' : 'text-[#374151]'}`}>
                          {st.label}
                        </p>
                        {st.desc && <p className="text-[11px] text-[#94A3B8]">{st.desc}</p>}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: stPlanCfg.color + '20', color: stPlanCfg.color }}>
                      {stPlanCfg.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => { if (sousType) { saveDraft({ explicitPlan, secteurId: selectedSectorId, secteur: selectedSectorDef.secteur, sousType, step: 'info' }); goTo('info') }}}
              disabled={!sousType}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: sousType ? '#F59E0B' : '#E2E8F0', color: sousType ? 'white' : '#94A3B8' }}>
              Continuer <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ÉTAPE 5 — Informations minimales
        ════════════════════════════════════════════════════════════════ */}
        {step === 'info' && (
          <div>
            <button onClick={back} className="flex items-center gap-1.5 text-[#64748B] text-[13px] font-bold mb-6 hover:text-[#0F172A]">
              <ChevronLeft size={14} /> Retour
            </button>

            <h1 className="text-[24px] font-black text-[#0F172A] mb-1">Votre entreprise</h1>
            <p className="text-[14px] text-[#64748B] mb-6">
              Le minimum requis. Vous complèterez le reste après.
            </p>

            {/* Plan summary card */}
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-[#E2E8F0] mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{selectedSectorDef?.emoji}</span>
                <div>
                  <p className="text-[13px] font-bold text-[#0F172A]">{selectedSectorDef?.label}</p>
                  <p className="text-[11px]" style={{ color: planCfg.color }}>
                    Plan {planCfg.label}
                    {planUpgraded && <span className="ml-1 text-[#F59E0B]">· auto-ajusté</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={12} style={{ color: planCfg.color }} />
                <p className="text-[13px] font-black" style={{ color: planCfg.color }}>
                  {new Intl.NumberFormat('fr-FR').format(planCfg.price_fcfa)}
                  <span className="text-[10px] font-normal text-[#94A3B8]"> FCFA</span>
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  Nom de l&apos;entreprise <span className="text-[#DC2626]">*</span>
                </label>
                <input type="text" value={nomEntreprise}
                  onChange={e => setNomEntreprise(e.target.value)}
                  placeholder={`Ex: ${selectedSectorDef?.label ?? 'Mon entreprise'} de Brazzaville`}
                  className={INPUT} />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  Téléphone <span className="text-[#94A3B8] font-normal">(optionnel)</span>
                </label>
                <input type="tel" value={telephone}
                  onChange={e => setTelephone(e.target.value)}
                  placeholder="+242 06 xxx xxxx"
                  className={INPUT} />
              </div>
            </div>

            {/* Deferred info hint */}
            <div className="flex items-start gap-3 p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl mb-6">
              <span className="text-base shrink-0">⏰</span>
              <p className="text-[12px] text-[#92400E]">
                <strong>Vous avez 72h</strong> pour compléter les informations de votre entreprise
                (logo, adresse, dirigeant, documents...). Vous pouvez le faire depuis le dashboard.
              </p>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[13px] text-[#DC2626]">
                {error}
              </div>
            )}

            <button
              onClick={() => { if (nomEntreprise.trim().length >= 2) goTo('creating') }}
              disabled={nomEntreprise.trim().length < 2 || loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: nomEntreprise.trim().length >= 2 ? '#F59E0B' : '#E2E8F0',
                color:      nomEntreprise.trim().length >= 2 ? 'white' : '#94A3B8',
              }}>
              <Zap size={16} /> Lancer mon ERP
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ÉTAPE 6 — Création en cours
        ════════════════════════════════════════════════════════════════ */}
        {step === 'creating' && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-3xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center mx-auto mb-6">
              <div className="w-10 h-10 border-3 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" />
            </div>
            <h2 className="text-[22px] font-black text-[#0F172A] mb-3">Création de votre espace...</h2>
            <div className="space-y-2 max-w-xs mx-auto">
              {[
                'Création de votre compte',
                'Configuration des modules',
                'Activation de l\'essai gratuit',
                'Préparation du dashboard',
              ].map((txt, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px] text-[#64748B]">
                  <div className="w-4 h-4 rounded-full bg-[#F59E0B]/20 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  </div>
                  {txt}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ÉTAPE 7 — Bienvenue
        ════════════════════════════════════════════════════════════════ */}
        {step === 'welcome' && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-3xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-6">
              <Sparkles size={36} className="text-[#16A34A]" />
            </div>
            <h1 className="text-[28px] font-black text-[#0F172A] mb-2">Bienvenue sur Oraforme</h1>
            <p className="text-[16px] font-bold text-[#16A34A] mb-1">Votre essai gratuit est activé !</p>
            <p className="text-[14px] text-[#64748B] mb-8">
              Vous pouvez compléter les informations de votre entreprise à tout moment.
            </p>

            <div className="space-y-3 mb-8">
              {[
                { emoji: '✅', text: 'Espace de travail créé' },
                { emoji: '🚀', text: 'Modules configurés pour votre secteur' },
                { emoji: '⏰', text: '72h pour finaliser votre profil entreprise' },
              ].map(({ emoji, text }) => (
                <div key={text} className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#E2E8F0] text-left">
                  <span className="text-base shrink-0">{emoji}</span>
                  <p className="text-[13px] font-medium text-[#374151]">{text}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 justify-center text-[13px] text-[#94A3B8] mb-6">
              <div className="w-4 h-4 border-2 border-[#94A3B8]/30 border-t-[#F59E0B] rounded-full animate-spin" />
              Redirection vers le dashboard...
            </div>

            <button onClick={() => { window.location.href = '/dashboard' }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black bg-[#F59E0B] text-white hover:bg-[#D97706] transition-all">
              <Building2 size={16} /> Accéder au dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
