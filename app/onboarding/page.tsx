'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, ChevronLeft, Eye, EyeOff, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { createTenantAndProfile } from './actions'
import { PAYS_LIST, LANGUES_LIST, PLAN_CONFIG, type TailleEntreprise, type SecteurId } from '@/lib/plans'

// ── Sector sub-types (with auto-plan) ─────────────────────────────────────────

const SECTOR_SUBTYPES: Record<string, Array<{ id: string; label: string; emoji: string; plan: TailleEntreprise }>> = {
  ecole: [
    { id: 'garderie',   label: 'Garderie / Crèche',     emoji: '🧒', plan: 'tpe' },
    { id: 'primaire',   label: 'École Primaire',         emoji: '📚', plan: 'tpe' },
    { id: 'college',    label: 'Collège',                emoji: '🏫', plan: 'tpe' },
    { id: 'lycee',      label: 'Lycée',                  emoji: '🎓', plan: 'pme' },
    { id: 'universite', label: 'Université / Institut',  emoji: '🏛️', plan: 'grande' },
  ],
  sante: [
    { id: 'cabinet_med', label: 'Cabinet Médical',         emoji: '💊', plan: 'tpe' },
    { id: 'clinique',    label: 'Clinique / Centre Santé', emoji: '🏥', plan: 'pme' },
    { id: 'hopital',     label: 'Hôpital / CHU',           emoji: '🏨', plan: 'grande' },
  ],
  banque: [
    { id: 'microfinance', label: 'Microfinance / COOPEC',  emoji: '💰', plan: 'pme' },
    { id: 'banque_comm',  label: 'Banque Commerciale',     emoji: '🏦', plan: 'grande' },
  ],
  hotel: [
    { id: 'hotel_bud', label: 'Auberge / Guesthouse',     emoji: '🏠', plan: 'tpe' },
    { id: 'hotel_std', label: 'Hôtel Standard',           emoji: '🏨', plan: 'pme' },
    { id: 'hotel_lux', label: 'Hôtel & Resort Luxe',      emoji: '⭐', plan: 'grande' },
  ],
  transport: [
    { id: 'taxi',      label: 'Taxi / VTC',               emoji: '🚖', plan: 'tpe' },
    { id: 'bus',       label: 'Transport Urbain',          emoji: '🚌', plan: 'pme' },
    { id: 'freight',   label: 'Transport National / Fret', emoji: '🚛', plan: 'grande' },
  ],
}

// Default plan when no sub-type
const SECTOR_DEFAULT_PLAN: Record<string, TailleEntreprise> = {
  commerce: 'tpe', boutique: 'tpe', supermarche: 'tpe', petrole: 'tpe',
  restaurant: 'pme', pharmacie: 'pme', btp: 'pme', agriculture: 'pme',
  ong: 'pme', cabinet: 'pme', boisson: 'pme', autre: 'pme',
  ecole: 'pme', sante: 'pme', hotel: 'pme', transport: 'pme', banque: 'grande',
}

const SECTORS = [
  { id: 'commerce',    label: 'Commerce & Distribution', emoji: '🛒' },
  { id: 'restaurant',  label: 'Restaurant & Hôtellerie', emoji: '🍽️' },
  { id: 'ecole',       label: 'École & Université',      emoji: '🎓' },
  { id: 'sante',       label: 'Santé & Clinique',        emoji: '🏥' },
  { id: 'btp',         label: 'BTP & Construction',      emoji: '🏗️' },
  { id: 'transport',   label: 'Transport & Logistique',  emoji: '🚛' },
  { id: 'hotel',       label: 'Hôtel & Tourisme',        emoji: '🏨' },
  { id: 'agriculture', label: 'Agriculture & Élevage',   emoji: '🌾' },
  { id: 'pharmacie',   label: 'Pharmacie',               emoji: '💊' },
  { id: 'banque',      label: 'Banque & Finance',        emoji: '🏦' },
  { id: 'ong',         label: 'ONG & Associations',      emoji: '🤝' },
  { id: 'cabinet',     label: 'Cabinet Comptable',       emoji: '📊' },
  { id: 'boisson',     label: 'Boisson & Distribution',  emoji: '🍺' },
  { id: 'petrole',     label: 'Pétrole & Énergie',       emoji: '⛽' },
  { id: 'supermarche', label: 'Supermarché & GMS',       emoji: '🏪' },
  { id: 'boutique',    label: 'Boutique & Magasin',      emoji: '👗' },
  { id: 'autre',       label: 'Autre activité',          emoji: '⚡' },
]

const STEPS = [
  { id: 1, label: 'Activité',   sub: 'Votre secteur' },
  { id: 2, label: 'Entreprise', sub: 'Vos informations' },
  { id: 3, label: 'Compte',     sub: 'Administrateur' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step,        setStep]        = useState(1)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [showPwd,      setShowPwd]      = useState(false)
  const [isOAuthUser,  setIsOAuthUser]  = useState(false)
  const [emailPending, setEmailPending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  // Step 1
  const [secteur,  setSecteur]  = useState<SecteurId | ''>('')
  const [sousType, setSousType] = useState('')
  const [pays,     setPays]     = useState('CG')
  const [langue,   setLangue]   = useState('fr')

  // Step 2
  const [societe, setSociete] = useState({ nom: '', telephone: '', adresse: '', niu: '' })

  // Step 3
  const [admin, setAdmin] = useState({ prenom: '', nom: '', email: '', password: '' })

  // Auto-computed plan
  const subtypes        = secteur ? (SECTOR_SUBTYPES[secteur] ?? null) : null
  const selectedSubtype = subtypes?.find(s => s.id === sousType)
  const taille: TailleEntreprise =
    selectedSubtype?.plan ?? (secteur ? (SECTOR_DEFAULT_PLAN[secteur] ?? 'pme') : 'pme')
  const planCfg = PLAN_CONFIG[taille]

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return

      const identities = session.user.identities ?? []
      setIsOAuthUser(identities.some(i => i.provider !== 'email'))

      // Already has profile → skip onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (profile?.tenant_id) { window.location.href = '/dashboard'; return }

      setAdmin(prev => ({ ...prev, email: session.user.email ?? '' }))

      // Pre-fill from register flow
      try {
        const raw = localStorage.getItem('oraforme_reg')
        if (!raw) return
        const reg = JSON.parse(raw) as { sector?: string; prenom?: string; nom?: string; telephone?: string }
        if (reg.prenom) setAdmin(p => ({ ...p, prenom: reg.prenom! }))
        if (reg.nom)    setAdmin(p => ({ ...p, nom: reg.nom! }))
        if (reg.telephone) setSociete(p => ({ ...p, telephone: reg.telephone! }))
        const sectorMap: Record<string, SecteurId> = {
          cabinet: 'cabinet', ecole: 'ecole', universite: 'ecole', hotel: 'hotel',
          restaurant: 'restaurant', pharmacie: 'pharmacie', sante: 'sante',
          supermarche: 'supermarche', boutique: 'boutique', btp: 'btp',
          transport: 'transport', petrole: 'petrole', banque: 'banque',
          commerce: 'commerce', ong: 'ong', agriculture: 'agriculture', autre: 'autre',
        }
        const sId = reg.sector?.split('-')[0]
        if (sId && sectorMap[sId]) {
          const mappedSector = sectorMap[sId]
          setSecteur(mappedSector)
          // Only jump to step 2 if no sub-types needed for this sector
          // Otherwise stay on step 1 so user can pick sub-type
          if (!SECTOR_SUBTYPES[mappedSector]) {
            setStep(2)
          }
        }
      } catch { /* ignore */ }
    })
  }, [])

  function canAdvance(): boolean {
    if (step === 1) return !!secteur && (!subtypes || !!sousType) && !!pays && !!langue
    if (step === 2) return societe.nom.trim().length >= 2
    if (step === 3) return (
      admin.prenom.trim().length >= 1 &&
      admin.nom.trim().length >= 1 &&
      admin.email.includes('@') &&
      (isOAuthUser || admin.password.length >= 8)
    )
    return false
  }

  async function handleSubmit() {
    setLoading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      const { data: signUpData, error: err } = await supabase.auth.signUp({
        email: admin.email,
        password: admin.password,
        options: {
          data: { nom_entreprise: societe.nom },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })
      if (err) { setError(err.message); setLoading(false); return }
      // Email confirmation required — show "check email" screen
      if (!signUpData.session) {
        setPendingEmail(admin.email)
        setEmailPending(true)
        setLoading(false)
        return
      }
    }
    const result = await createTenantAndProfile({
      nomEntreprise:   societe.nom,
      niu:             societe.niu,
      telephone:       societe.telephone,
      adresse:         societe.adresse,
      secteurActivite: secteur as SecteurId,
      taille,
      pays,
      langue,
      prenom:          admin.prenom,
      nom:             admin.nom,
    })
    if (result.error) { setError(result.error); setLoading(false); return }
    localStorage.removeItem('oraforme_reg')
    window.location.href = '/dashboard'
  }

  const selectedSector = SECTORS.find(s => s.id === secteur)

  // ── Email confirmation pending screen ──────────────────────────────────────
  if (emailPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-[#E2E8F0] text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-5">
            <Check size={28} className="text-[#16A34A]" />
          </div>
          <h2 className="text-2xl font-black text-[#0F172A] mb-3">Vérifiez votre email</h2>
          <p className="text-[#64748B] text-[14px] leading-relaxed mb-2">
            Un lien d&apos;activation a été envoyé à
          </p>
          <p className="text-[#0F172A] font-bold text-[14px] mb-6">{pendingEmail}</p>
          <p className="text-[#94A3B8] text-[12px] mb-6">
            Cliquez sur le lien dans l&apos;email pour activer votre compte. Pensez à vérifier les spams.
          </p>
          <a href="/login" className="text-[#F59E0B] text-[13px] font-bold hover:underline">
            ← Retour à la connexion
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">

      {/* ── LEFT SIDEBAR ────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[300px] xl:w-[320px] shrink-0 bg-white border-r border-[#E2E8F0] px-8 py-10 justify-between">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2 mb-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Oraforme" className="h-8 w-auto"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const done    = step > s.id
              const current = step === s.id
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl transition-all"
                  style={{ background: current ? '#FEF3C7' : 'transparent' }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 transition-all ${
                    done    ? 'bg-[#16A34A] text-white' :
                    current ? 'bg-[#F59E0B] text-white' :
                              'bg-[#F1F5F9] text-[#94A3B8]'
                  }`}>
                    {done ? <Check size={13} /> : s.id}
                  </div>
                  <div>
                    <p className={`text-[13px] font-bold ${current ? 'text-[#0F172A]' : done ? 'text-[#16A34A]' : 'text-[#94A3B8]'}`}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-[#CBD5E1]">{s.sub}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary card */}
          {secteur && (
            <div className="mt-8 p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] space-y-3">
              <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Récapitulatif</p>
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedSector?.emoji}</span>
                <div>
                  <p className="text-[13px] font-bold text-[#0F172A]">{selectedSector?.label}</p>
                  {selectedSubtype && (
                    <p className="text-[11px] text-[#64748B]">{selectedSubtype.emoji} {selectedSubtype.label}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                <div>
                  <p className="text-[12px] font-bold text-[#0F172A]">{planCfg.label}</p>
                  <p className="text-[10px] text-[#94A3B8]">{planCfg.subtitle}</p>
                </div>
                <p className="text-[13px] font-black" style={{ color: planCfg.color }}>
                  {new Intl.NumberFormat('fr-FR').format(planCfg.price_fcfa)}
                  <span className="text-[10px] font-normal text-[#94A3B8]"> FCFA</span>
                </p>
              </div>
              {societe.nom && (
                <p className="text-[12px] text-[#475569] font-medium truncate border-t border-[#E2E8F0] pt-1">{societe.nom}</p>
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#CBD5E1] text-center">© 2025 Oraforme · oraforms.com</p>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex gap-1.5">
            {STEPS.map(s => (
              <div key={s.id} className={`h-1.5 w-8 rounded-full transition-all ${
                step >= s.id ? 'bg-[#F59E0B]' : 'bg-[#E2E8F0]'
              }`} />
            ))}
          </div>
          <span className="text-[12px] font-bold text-[#94A3B8]">Étape {step} / {STEPS.length}</span>
        </div>

        <div className="flex-1 flex items-start justify-center px-6 py-8 lg:py-12">
          <div className="w-full max-w-2xl">

            {/* ── STEP 1: Secteur ─────────────────────────────────────────── */}
            {step === 1 && (
              <div>
                <div className="mb-6">
                  <p className="text-[12px] font-bold text-[#F59E0B] uppercase tracking-widest mb-1">Étape 1 sur 3</p>
                  <h1 className="text-[26px] font-black text-[#0F172A]">Votre secteur d&apos;activité</h1>
                  <p className="text-[14px] text-[#64748B] mt-1">Oraforme adapte automatiquement votre ERP.</p>
                </div>

                {/* Sector grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {SECTORS.map(s => (
                    <button key={s.id} type="button"
                      onClick={() => { setSecteur(s.id as SecteurId); setSousType('') }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                        secteur === s.id
                          ? 'border-[#F59E0B] bg-[#FEF3C7]'
                          : 'border-[#E2E8F0] bg-white hover:border-[#F59E0B]/40 hover:bg-[#FFFBEB]'
                      }`}>
                      <span className="text-2xl">{s.emoji}</span>
                      <span className={`text-[12px] font-bold leading-tight ${secteur === s.id ? 'text-[#92400E]' : 'text-[#374151]'}`}>
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Sub-types (appears when sector with subtypes is selected) */}
                {secteur && SECTOR_SUBTYPES[secteur] && (
                  <div className="mb-6 p-4 bg-white rounded-2xl border border-[#E2E8F0]">
                    <p className="text-[12px] font-black text-[#64748B] uppercase tracking-widest mb-3">
                      Quel type de {selectedSector?.label.split(' ')[0].toLowerCase()} ?
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SECTOR_SUBTYPES[secteur].map(st => (
                        <button key={st.id} type="button"
                          onClick={() => setSousType(st.id)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                            sousType === st.id
                              ? 'border-[#F59E0B] bg-[#FEF3C7]'
                              : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#F59E0B]/40'
                          }`}>
                          <span className="text-lg shrink-0">{st.emoji}</span>
                          <div className="min-w-0">
                            <p className={`text-[12px] font-bold truncate ${sousType === st.id ? 'text-[#92400E]' : 'text-[#374151]'}`}>
                              {st.label}
                            </p>
                            <p className="text-[10px]" style={{ color: PLAN_CONFIG[st.plan].color }}>
                              {PLAN_CONFIG[st.plan].label}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pays + Langue */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Pays</label>
                    <select value={pays} onChange={e => setPays(e.target.value)}
                      className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white text-[#0F172A] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15">
                      {PAYS_LIST.map(p => (
                        <option key={p.code} value={p.code}>{p.flag} {p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Langue</label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUES_LIST.map(l => (
                        <button key={l.code} type="button"
                          onClick={() => setLangue(l.code)}
                          className={`px-3 py-1.5 rounded-xl text-[12px] font-bold border-2 transition-all ${
                            langue === l.code
                              ? 'border-[#F59E0B] bg-[#FEF3C7] text-[#92400E]'
                              : 'border-[#E2E8F0] text-[#64748B] hover:border-[#F59E0B]/40'
                          }`}>
                          {l.flag} {l.code.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Plan preview */}
                {secteur && (
                  <div className="mb-6 flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-[#E2E8F0]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: planCfg.color + '20' }}>
                        <Zap size={14} style={{ color: planCfg.color }} />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[#0F172A]">Plan {planCfg.label} inclus</p>
                        <p className="text-[11px] text-[#94A3B8]">{planCfg.subtitle}</p>
                      </div>
                    </div>
                    <p className="text-[16px] font-black shrink-0" style={{ color: planCfg.color }}>
                      {new Intl.NumberFormat('fr-FR').format(planCfg.price_fcfa)}
                      <span className="text-[10px] font-normal text-[#94A3B8] ml-1">FCFA/mois</span>
                    </p>
                  </div>
                )}

                <button
                  onClick={() => { if (canAdvance()) setStep(2) }}
                  disabled={!canAdvance()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: canAdvance() ? '#F59E0B' : '#E2E8F0', color: canAdvance() ? 'white' : '#94A3B8' }}>
                  Continuer <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ── STEP 2: Entreprise ──────────────────────────────────────── */}
            {step === 2 && (
              <div>
                <div className="mb-6">
                  <p className="text-[12px] font-bold text-[#F59E0B] uppercase tracking-widest mb-1">Étape 2 sur 3</p>
                  <h1 className="text-[26px] font-black text-[#0F172A]">Votre entreprise</h1>
                  <p className="text-[14px] text-[#64748B] mt-1">Ces informations apparaîtront sur vos documents.</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4 mb-6">
                  <div>
                    <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                      Nom de l&apos;entreprise <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      value={societe.nom}
                      onChange={e => setSociete(p => ({ ...p, nom: e.target.value }))}
                      placeholder="Ex: École Saint-Joseph de Brazzaville"
                      className="w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Téléphone</label>
                      <input
                        type="tel"
                        value={societe.telephone}
                        onChange={e => setSociete(p => ({ ...p, telephone: e.target.value }))}
                        placeholder="+242 06 xxx xxxx"
                        className="w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">NIU (optionnel)</label>
                      <input
                        type="text"
                        value={societe.niu}
                        onChange={e => setSociete(p => ({ ...p, niu: e.target.value }))}
                        placeholder="Numéro d'Identification Unique"
                        className="w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Adresse</label>
                    <input
                      type="text"
                      value={societe.adresse}
                      onChange={e => setSociete(p => ({ ...p, adresse: e.target.value }))}
                      placeholder="Adresse complète"
                      className="w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-2xl border-2 border-[#E2E8F0] text-[13px] font-bold text-[#64748B] hover:bg-[#F8FAFC] transition-all">
                    <ChevronLeft size={15} /> Retour
                  </button>
                  <button
                    onClick={() => { if (canAdvance()) setStep(3) }}
                    disabled={!canAdvance()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[14px] font-black transition-all disabled:opacity-40"
                    style={{ background: canAdvance() ? '#F59E0B' : '#E2E8F0', color: canAdvance() ? 'white' : '#94A3B8' }}>
                    Continuer <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Compte ──────────────────────────────────────────── */}
            {step === 3 && (
              <div>
                <div className="mb-6">
                  <p className="text-[12px] font-bold text-[#F59E0B] uppercase tracking-widest mb-1">Étape 3 sur 3</p>
                  <h1 className="text-[26px] font-black text-[#0F172A]">Votre compte admin</h1>
                  <p className="text-[14px] text-[#64748B] mt-1">Vous serez le propriétaire de cet espace.</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                        Prénom <span className="text-[#DC2626]">*</span>
                      </label>
                      <input
                        type="text"
                        value={admin.prenom}
                        onChange={e => setAdmin(p => ({ ...p, prenom: e.target.value }))}
                        placeholder="Jean"
                        className="w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                        Nom <span className="text-[#DC2626]">*</span>
                      </label>
                      <input
                        type="text"
                        value={admin.nom}
                        onChange={e => setAdmin(p => ({ ...p, nom: e.target.value }))}
                        placeholder="Dupont"
                        className="w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                      Email professionnel <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="email"
                      value={admin.email}
                      onChange={e => setAdmin(p => ({ ...p, email: e.target.value }))}
                      placeholder="jean@monentreprise.com"
                      readOnly={isOAuthUser}
                      className={`w-full px-4 py-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15 ${isOAuthUser ? 'bg-[#F8FAFC] cursor-not-allowed' : ''}`}
                    />
                  </div>

                  {isOAuthUser ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl">
                      <div className="w-5 h-5 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
                        <Check size={11} className="text-white" />
                      </div>
                      <p className="text-[13px] text-[#15803D] font-medium">Connecté via Google — aucun mot de passe requis</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                        Mot de passe <span className="text-[#DC2626]">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPwd ? 'text' : 'password'}
                          value={admin.password}
                          onChange={e => setAdmin(p => ({ ...p, password: e.target.value }))}
                          placeholder="8 caractères minimum"
                          autoComplete="new-password"
                          className="w-full px-4 py-3 pr-11 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"
                        />
                        <button type="button" onClick={() => setShowPwd(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                          {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {admin.password.length > 0 && admin.password.length < 8 && (
                        <p className="text-[#DC2626] text-[11px] mt-1">8 caractères minimum</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Final recap */}
                <div className="mb-6 p-4 bg-white rounded-2xl border border-[#E2E8F0] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{selectedSector?.emoji}</span>
                    <div>
                      <p className="text-[13px] font-bold text-[#0F172A]">{societe.nom || 'Votre entreprise'}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {selectedSector?.label}
                        {selectedSubtype ? ` · ${selectedSubtype.label}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-black" style={{ color: planCfg.color }}>{planCfg.label}</p>
                    <p className="text-[10px] text-[#94A3B8]">
                      {new Intl.NumberFormat('fr-FR').format(planCfg.price_fcfa)} FCFA/mois
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[13px] text-[#DC2626]">
                    {error}
                  </div>
                )}

                <p className="text-[11px] text-[#94A3B8] text-center mb-4">
                  En créant votre compte, vous acceptez les{' '}
                  <a href="/cgu" className="underline hover:text-[#F59E0B]">conditions générales</a> d&apos;Oraforme.
                </p>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-2xl border-2 border-[#E2E8F0] text-[13px] font-bold text-[#64748B] hover:bg-[#F8FAFC] transition-all">
                    <ChevronLeft size={15} /> Retour
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canAdvance() || loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[14px] font-black transition-all disabled:opacity-40"
                    style={{ background: canAdvance() && !loading ? '#F59E0B' : '#E2E8F0', color: canAdvance() && !loading ? 'white' : '#94A3B8' }}>
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Zap size={16} /> Lancer mon ERP</>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
