'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, ChevronLeft, Eye, EyeOff, Building2, Users, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { createTenantAndProfile } from './actions'
import {
  SECTEUR_CONFIG, PLAN_CONFIG, PAYS_LIST, LANGUES_LIST,
  type TailleEntreprise, type SecteurId,
} from '@/lib/plans'

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Secteur',   sub: 'Votre activité' },
  { id: 2, label: 'Taille',    sub: 'Votre pack' },
  { id: 3, label: 'Société',   sub: 'Vos informations' },
  { id: 4, label: 'Compte',    sub: 'Accès administrateur' },
]

// ── Slide animation ───────────────────────────────────────────────────────────

const slideVariants = {
  enter:  (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center:               ({ x: 0, opacity: 1 }),
  exit:   (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]     = useState(1)
  const [dir,  setDir]      = useState(1)
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState('')
  const [showPwd, setShowPwd]   = useState(false)

  // Step 1
  const [secteur, setSecteur]   = useState<SecteurId | ''>('')
  const [pays,    setPays]      = useState('CG')
  const [langue,  setLangue]    = useState('fr')

  // Step 2
  const [taille, setTaille]     = useState<TailleEntreprise | ''>('')

  // Step 3
  const [societe, setSociete]   = useState({
    nom: '', telephone: '', adresse: '', nif: '',
  })

  // Step 4
  const [admin, setAdmin]       = useState({
    prenom: '', nom: '', email: '', password: '',
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // User already authed (came from /register) — pre-fill email
        setAdmin(prev => ({ ...prev, email: session.user.email ?? '' }))
      }
    })
  }, [])

  function go(next: number) {
    setDir(next > step ? 1 : -1)
    setStep(next)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function canAdvance(): boolean {
    if (step === 1) return !!secteur && !!pays && !!langue
    if (step === 2) return !!taille
    if (step === 3) return societe.nom.trim().length >= 2
    if (step === 4) return (
      admin.prenom.trim().length >= 1 &&
      admin.nom.trim().length >= 1 &&
      admin.email.includes('@') &&
      admin.password.length >= 8
    )
    return false
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    // If not yet authenticated, create auth account first
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      await supabase.auth.signOut()
      const { error: signUpErr } = await supabase.auth.signUp({
        email:    admin.email,
        password: admin.password,
        options: {
          data: { nom_entreprise: societe.nom },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })
      if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
    }

    const result = await createTenantAndProfile({
      nomEntreprise:   societe.nom,
      nif:             societe.nif,
      telephone:       societe.telephone,
      adresse:         societe.adresse,
      secteurActivite: secteur as SecteurId,
      taille:          taille as TailleEntreprise,
      pays,
      langue,
      prenom:          admin.prenom,
      nom:             admin.nom,
    })

    if (result.error) { setError(result.error); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  const planCfg = taille ? PLAN_CONFIG[taille] : null
  const secteurCfg = secteur ? SECTEUR_CONFIG[secteur] : null
  const paysCfg = PAYS_LIST.find(p => p.code === pays)
  const langueCfg = LANGUES_LIST.find(l => l.code === langue)

  return (
    <div className="min-h-screen flex bg-[#0A0A0F]">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[340px] xl:w-[380px] bg-gradient-to-b from-[#0F0F18] to-[#0A0A0F] border-r border-white/5 p-8 justify-between flex-shrink-0">

        {/* Logo */}
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="oraforme" className="w-7 h-7" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-white font-bold text-lg tracking-tight">oraforme</span>
          </div>

          {/* Step list */}
          <div className="space-y-1">
            {STEPS.map((s, i) => {
              const done    = step > s.id
              const current = step === s.id
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: current ? 'rgba(245,158,11,0.08)' : 'transparent' }}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                    done    ? 'bg-[#16A34A] text-white' :
                    current ? 'bg-[#F59E0B] text-black' :
                              'bg-white/5 text-white/30'
                  }`}>
                    {done ? <Check size={13} /> : s.id}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${current ? 'text-white' : done ? 'text-white/60' : 'text-white/25'}`}>{s.label}</p>
                    <p className={`text-xs ${current ? 'text-white/50' : 'text-white/20'}`}>{s.sub}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Live summary */}
          {(secteur || taille || societe.nom) && (
            <div className="mt-8 p-4 bg-white/3 border border-white/6 rounded-2xl space-y-3">
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest">Récapitulatif</p>
              {secteurCfg && (
                <div className="flex items-center gap-2">
                  <span className="text-xl">{secteurCfg.emoji}</span>
                  <div>
                    <p className="text-white text-[13px] font-semibold">{secteurCfg.label}</p>
                    <p className="text-white/40 text-[11px]">{paysCfg?.flag} {paysCfg?.label} · {langueCfg?.flag} {langueCfg?.label}</p>
                  </div>
                </div>
              )}
              {planCfg && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-[13px] font-bold">{planCfg.label}</p>
                    <p className="text-white/40 text-[11px]">{planCfg.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[14px]" style={{ color: planCfg.color }}>
                      {new Intl.NumberFormat('fr-FR').format(planCfg.price_fcfa)}
                    </p>
                    <p className="text-white/30 text-[10px]">FCFA/mois</p>
                  </div>
                </div>
              )}
              {societe.nom && (
                <p className="text-white/70 text-[13px] font-medium truncate">{societe.nom}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div>
          <p className="text-white/15 text-[11px] text-center">
            © 2025 Oraforme · SaaS africain · oraforms.com
          </p>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="oraforme" className="w-6 h-6" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-white font-bold">oraforme</span>
          </div>
          <div className="flex gap-1">
            {STEPS.map(s => (
              <div key={s.id} className={`h-1.5 rounded-full transition-all ${
                step >= s.id ? 'bg-[#F59E0B]' : 'bg-white/10'
              }`} style={{ width: step === s.id ? 24 : 8 }} />
            ))}
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-xl">

            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
              >

                {/* ── STEP 1: Secteur + Pays + Langue ─────────────────────── */}
                {step === 1 && (
                  <div>
                    <div className="mb-8">
                      <p className="text-[#F59E0B] text-sm font-semibold mb-1">Étape 1 sur 4</p>
                      <h1 className="text-white text-3xl font-bold leading-tight mb-2">Votre secteur d'activité</h1>
                      <p className="text-white/40 text-sm">Oraforme adapte automatiquement votre ERP.</p>
                    </div>

                    {/* Sector grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
                      {(Object.entries(SECTEUR_CONFIG) as [SecteurId, typeof SECTEUR_CONFIG[SecteurId]][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => setSecteur(key)}
                          className={`p-3.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                            secteur === key
                              ? 'border-[#F59E0B] bg-[#F59E0B]/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                              : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
                          }`}
                        >
                          <span className="text-xl block mb-1">{cfg.emoji}</span>
                          <p className={`text-xs font-semibold leading-snug ${secteur === key ? 'text-white' : 'text-white/60'}`}>
                            {cfg.label}
                          </p>
                        </button>
                      ))}
                    </div>

                    {/* Pays + Langue */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Pays</label>
                        <select
                          value={pays}
                          onChange={e => setPays(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-[#F59E0B]/50 appearance-none"
                        >
                          {PAYS_LIST.map(p => (
                            <option key={p.code} value={p.code} className="bg-[#1a1a2e]">
                              {p.flag} {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Langue</label>
                        <div className="flex flex-wrap gap-1.5">
                          {LANGUES_LIST.map(l => (
                            <button
                              key={l.code}
                              onClick={() => setLangue(l.code)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                langue === l.code
                                  ? 'bg-[#F59E0B] text-black'
                                  : 'bg-white/5 text-white/50 hover:bg-white/10'
                              }`}
                            >
                              {l.flag} {l.code.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Taille entreprise ────────────────────────────── */}
                {step === 2 && (
                  <div>
                    <div className="mb-8">
                      <p className="text-[#F59E0B] text-sm font-semibold mb-1">Étape 2 sur 4</p>
                      <h1 className="text-white text-3xl font-bold leading-tight mb-2">Choisissez votre pack</h1>
                      <p className="text-white/40 text-sm">Modules inclus automatiquement selon votre taille.</p>
                    </div>

                    <div className="space-y-3">
                      {(Object.entries(PLAN_CONFIG) as [TailleEntreprise, typeof PLAN_CONFIG[TailleEntreprise]][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => setTaille(key)}
                          className={`w-full p-5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
                            taille === key
                              ? 'shadow-[0_0_30px_rgba(0,0,0,0.3)]'
                              : 'border-white/8 bg-white/3 hover:bg-white/5'
                          }`}
                          style={taille === key ? {
                            border: `1.5px solid ${cfg.color}`,
                            background: `${cfg.color}0d`,
                            boxShadow: `0 0 30px ${cfg.color}20`,
                          } : {}}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-bold text-lg">{cfg.label}</span>
                                {cfg.badge && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: `${cfg.color}25`, color: cfg.color }}>
                                    {cfg.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-white/40 text-xs mb-3">{cfg.subtitle}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {cfg.features.slice(0, 4).map(f => (
                                  <span key={f} className="flex items-center gap-1 text-[11px] text-white/50">
                                    <Check size={10} style={{ color: cfg.color }} />
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-2xl" style={{ color: cfg.color }}>
                                {new Intl.NumberFormat('fr-FR').format(cfg.price_fcfa)}
                              </p>
                              <p className="text-white/30 text-[11px]">FCFA/mois</p>
                              <p className="text-white/20 text-[10px] mt-0.5">
                                {cfg.max_users === -1 ? 'Utilisateurs illimités' : `${cfg.max_users} utilisateurs`}
                              </p>
                            </div>
                          </div>

                          {/* Full features on selection */}
                          {taille === key && (
                            <div className="mt-4 pt-4 border-t border-white/8 grid grid-cols-2 gap-1.5">
                              {cfg.features.map(f => (
                                <span key={f} className="flex items-center gap-1.5 text-[11px] text-white/60">
                                  <Check size={10} style={{ color: cfg.color }} />
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Informations société ─────────────────────────── */}
                {step === 3 && (
                  <div>
                    <div className="mb-8">
                      <p className="text-[#F59E0B] text-sm font-semibold mb-1">Étape 3 sur 4</p>
                      <h1 className="text-white text-3xl font-bold leading-tight mb-2">Votre entreprise</h1>
                      <p className="text-white/40 text-sm">Ces informations apparaîtront sur vos documents.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">
                          Nom de l'entreprise <span className="text-red-400">*</span>
                        </label>
                        <input
                          value={societe.nom}
                          onChange={e => setSociete(s => ({ ...s, nom: e.target.value }))}
                          placeholder="Ex: Société Générale du Congo"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Téléphone</label>
                          <input
                            value={societe.telephone}
                            onChange={e => setSociete(s => ({ ...s, telephone: e.target.value }))}
                            placeholder="+242 06 xxx xxxx"
                            className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">NIF (optionnel)</label>
                          <input
                            value={societe.nif}
                            onChange={e => setSociete(s => ({ ...s, nif: e.target.value }))}
                            placeholder="Numéro fiscal"
                            className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Adresse</label>
                        <input
                          value={societe.adresse}
                          onChange={e => setSociete(s => ({ ...s, adresse: e.target.value }))}
                          placeholder="Adresse complète"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Sector + plan recap */}
                    {secteurCfg && planCfg && (
                      <div className="mt-6 p-4 bg-white/3 border border-white/6 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{secteurCfg.emoji}</span>
                          <div>
                            <p className="text-white text-sm font-semibold">{secteurCfg.label}</p>
                            <p className="text-white/40 text-xs">{paysCfg?.flag} {paysCfg?.label}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" style={{ color: planCfg.color }}>{planCfg.label}</p>
                          <p className="text-white/30 text-xs">{new Intl.NumberFormat('fr-FR').format(planCfg.price_fcfa)} FCFA/mois</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 4: Compte administrateur ────────────────────────── */}
                {step === 4 && (
                  <div>
                    <div className="mb-8">
                      <p className="text-[#F59E0B] text-sm font-semibold mb-1">Étape 4 sur 4</p>
                      <h1 className="text-white text-3xl font-bold leading-tight mb-2">Votre compte admin</h1>
                      <p className="text-white/40 text-sm">Vous serez le propriétaire de cet espace.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Prénom <span className="text-red-400">*</span></label>
                          <input
                            value={admin.prenom}
                            onChange={e => setAdmin(a => ({ ...a, prenom: e.target.value }))}
                            placeholder="Jean"
                            autoComplete="given-name"
                            className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Nom <span className="text-red-400">*</span></label>
                          <input
                            value={admin.nom}
                            onChange={e => setAdmin(a => ({ ...a, nom: e.target.value }))}
                            placeholder="Mpemba"
                            autoComplete="family-name"
                            className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Email professionnel <span className="text-red-400">*</span></label>
                        <input
                          type="email"
                          value={admin.email}
                          onChange={e => setAdmin(a => ({ ...a, email: e.target.value }))}
                          placeholder="jean@monentreprise.com"
                          autoComplete="email"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Mot de passe <span className="text-red-400">*</span></label>
                        <div className="relative">
                          <input
                            type={showPwd ? 'text' : 'password'}
                            value={admin.password}
                            onChange={e => setAdmin(a => ({ ...a, password: e.target.value }))}
                            placeholder="8 caractères minimum"
                            autoComplete="new-password"
                            className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 pr-11 outline-none focus:border-[#F59E0B]/50 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                          >
                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        {admin.password.length > 0 && admin.password.length < 8 && (
                          <p className="text-red-400/70 text-xs mt-1">8 caractères minimum</p>
                        )}
                      </div>
                    </div>

                    {/* Final recap */}
                    <div className="mt-6 p-4 bg-white/3 border border-white/6 rounded-2xl space-y-2">
                      <p className="text-white/30 text-[11px] uppercase tracking-wider font-bold">Résumé de votre abonnement</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {secteurCfg && <span className="text-lg">{secteurCfg.emoji}</span>}
                          <div>
                            <p className="text-white text-sm font-semibold">{societe.nom || 'Votre entreprise'}</p>
                            <p className="text-white/40 text-xs">{secteurCfg?.label} · {paysCfg?.flag} {paysCfg?.label}</p>
                          </div>
                        </div>
                        {planCfg && (
                          <div className="text-right">
                            <p className="font-bold text-lg" style={{ color: planCfg.color }}>
                              {planCfg.label}
                            </p>
                            <p className="text-white/30 text-xs">
                              {new Intl.NumberFormat('fr-FR').format(planCfg.price_fcfa)} FCFA/mois
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-white/20 text-[11px] mt-4 text-center">
                      En créant votre compte, vous acceptez les{' '}
                      <a href="/cgv" className="underline text-white/40">conditions générales</a> d'Oraforme.
                    </p>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* Error */}
            {error && (
              <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 gap-4">
              {step > 1 ? (
                <button
                  onClick={() => go(step - 1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 hover:text-white/80 transition-all"
                >
                  <ChevronLeft size={16} /> Retour
                </button>
              ) : (
                <a href="/login" className="text-white/30 text-sm hover:text-white/60 transition-colors">
                  Déjà un compte ?
                </a>
              )}

              {step < 4 ? (
                <button
                  onClick={() => go(step + 1)}
                  disabled={!canAdvance()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: canAdvance() ? '#F59E0B' : '#F59E0B40',
                    color: canAdvance() ? '#000' : '#000',
                  }}
                >
                  Continuer <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canAdvance() || loading}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: '#F59E0B', color: '#000' }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Création en cours…
                    </>
                  ) : (
                    <>
                      <Zap size={15} /> Lancer mon ERP
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
