'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Eye, EyeOff, MailCheck, ArrowRight, ArrowLeft, CheckCircle2,
  Building2, User, Phone, Mail, Lock, ChevronLeft,
} from 'lucide-react'

// ── Sector list for Business ──────────────────────────────────────────────────

const SECTORS = [
  { id: 'cabinet',      label: 'Cabinet',           emoji: '📊' },
  { id: 'ecole',        label: 'École',             emoji: '🎓' },
  { id: 'universite',   label: 'Université',        emoji: '🏛️' },
  { id: 'hotel',        label: 'Hôtel',             emoji: '🏨' },
  { id: 'restaurant',   label: 'Restaurant',        emoji: '🍽️' },
  { id: 'pharmacie',    label: 'Pharmacie',         emoji: '💊' },
  { id: 'sante',        label: 'Clinique / Hôpital', emoji: '🏥' },
  { id: 'supermarche',  label: 'Supermarché',       emoji: '🛒' },
  { id: 'boutique',     label: 'Magasin',           emoji: '🏪' },
  { id: 'btp',          label: 'Industrie',         emoji: '🏗️' },
  { id: 'transport',    label: 'Transport',         emoji: '🚛' },
  { id: 'logistique',   label: 'Logistique',        emoji: '📦' },
  { id: 'petrole',      label: 'Station-service',   emoji: '⛽' },
  { id: 'banque',       label: 'Banque',            emoji: '🏦' },
  { id: 'microfinance', label: 'Microfinance',      emoji: '💰' },
  { id: 'commerce',     label: 'E-commerce',        emoji: '🌐' },
  { id: 'autre',        label: 'Autre',             emoji: '🏢' },
]

// Special pricing note
const SPECIAL_NOTE: Record<string, { price: string; note?: string }> = {
  cabinet:    { price: '20 000 FCFA/mois', note: '+ 5 000 FCFA / client actif' },
  ecole:      { price: '35 000 FCFA/mois' },
  universite: { price: '56 000 FCFA/mois' },
}

// Left panel benefits per offer
const BENEFITS = {
  entrepreneur: [
    'Tous les modules Oraforme inclus',
    'Comptabilité SYSCOHADA complète',
    'RH, Paie, Trésorerie, Stock',
    'MIAA+ Standard (IA intégrée)',
    '30 jours d\'essai gratuit',
  ],
  business: [
    'Modules premium + automatisations',
    'Analytics avancés & BI',
    'MIAA+ Premium (IA avancée)',
    'Fonctionnalités métier spécialisées',
    '30 jours d\'essai gratuit',
  ],
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const [step,  setStep]  = useState<0 | 1>(0)
  const [offer, setOffer] = useState<'entrepreneur' | 'business' | null>(null)
  const [sector, setSector]   = useState('')
  const [form,   setForm]     = useState({ prenom: '', nom: '', email: '', telephone: '', password: '' })
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [showPwd,   setShowPwd]   = useState(false)

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const specialNote = sector ? SPECIAL_NOTE[sector] : null
  const canStep0 = offer !== null
  const canStep1 = form.prenom && form.nom && form.email && form.password.length >= 8
    && (offer === 'entrepreneur' || sector !== '')

  // ── Register handler ───────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setLoading(true)

    // Map offer → taille + store registration context for onboarding
    const taille = offer === 'business' ? 'pme' : 'tpe'
    const regData = {
      offer, taille, sector: offer === 'business' ? sector : '',
      prenom: form.prenom, nom: form.nom, telephone: form.telephone,
    }
    try { localStorage.setItem('oraforme_reg', JSON.stringify(regData)) } catch { /* ignore */ }

    await supabase.auth.signOut()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        data: { prenom: form.prenom, nom: form.nom },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setEmailSent(true)
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────
  async function handleGoogle() {
    const taille = offer === 'business' ? 'pme' : 'tpe'
    try {
      localStorage.setItem('oraforme_reg', JSON.stringify({
        offer, taille, sector: offer === 'business' ? sector : '',
        prenom: '', nom: '', telephone: '',
      }))
    } catch { /* ignore */ }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    })
  }

  // ── Email sent screen ──────────────────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC]">
        <div className="w-full max-w-sm text-center bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-5">
            <MailCheck size={28} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-3">Vérifiez votre email</h2>
          <p className="text-[#64748B] text-sm leading-relaxed mb-2">
            Un lien d&apos;activation a été envoyé à <strong className="text-[#0F172A]">{form.email}</strong>.
          </p>
          <p className="text-[#94A3B8] text-xs mb-6">Pensez à vérifier votre dossier spam.</p>
          <Link href="/login" className="text-green-600 text-sm hover:underline font-semibold">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT PANEL (green) ──────────────────────────────────────────────── */}
      <div
        className="lg:w-[42%] shrink-0 flex flex-col justify-between px-8 py-10 lg:px-12 lg:py-14"
        style={{ background: step === 0
          ? 'linear-gradient(145deg,#15803D 0%,#16A34A 60%,#22C55E 100%)'
          : 'linear-gradient(145deg,#92400E 0%,#D97706 55%,#F59E0B 100%)' }}
      >
        {/* Logo + retour */}
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Oraforme" className="h-9 w-auto"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <Link href="/"
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-semibold transition-colors">
            <ArrowLeft size={13} /> Accueil
          </Link>
        </div>

        {/* Content */}
        <div className="mt-10 lg:mt-0">
          {step === 0 && (
            <>
              <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
                Commencez votre<br />essai gratuit de 30 jours.
              </h2>
              <p className="text-white/70 text-sm leading-relaxed mb-8">
                Aucune carte bancaire requise. Accès immédiat à tous les modules.
              </p>
              {['Comptabilité SYSCOHADA officielle', 'RH, Paie & Trésorerie intégrés', 'MIAA+ — Assistant IA métier', 'Mobile Money (Airtel, MTN, Orange)', 'Support en français & langues locales'].map(b => (
                <div key={b} className="flex items-center gap-3 mb-3">
                  <CheckCircle2 size={16} className="text-white/80 shrink-0" />
                  <span className="text-white/85 text-[13px]">{b}</span>
                </div>
              ))}
            </>
          )}

          {step === 1 && offer && (
            <>
              <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5 mb-5">
                <span className="text-white text-[11px] font-bold uppercase tracking-widest">
                  Offre choisie
                </span>
              </div>
              <h2 className="text-3xl font-black text-white mb-1">
                {offer === 'entrepreneur' ? 'Entrepreneur' : 'Business'}
              </h2>
              <p className="text-white/60 text-lg font-semibold mb-6">
                {offer === 'entrepreneur' ? '15 000 FCFA / mois' : '25 000 FCFA / mois'}
              </p>
              {(BENEFITS[offer] ?? []).map(b => (
                <div key={b} className="flex items-start gap-3 mb-3">
                  <CheckCircle2 size={15} className="text-white/80 shrink-0 mt-0.5" />
                  <span className="text-white/85 text-[13px] leading-snug">{b}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mt-8">
          {[0, 1].map(i => (
            <div key={i}
              className="rounded-full transition-all"
              style={{
                width:  step === i ? 20 : 8,
                height: 8,
                background: step === i ? 'white' : 'rgba(255,255,255,0.35)',
              }} />
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL (white) ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 bg-white">
        <div className="w-full max-w-md">

          {/* ── STEP 0: Offer selection ─────────────────────────────────────── */}
          {step === 0 && (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                    <Building2 size={14} className="text-green-600" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8]">Étape 1 / 2</span>
                </div>
                <h1 className="text-2xl font-black text-[#0F172A] mt-3">Choisissez votre offre</h1>
                <p className="text-[13px] text-[#64748B] mt-1">
                  Commencez gratuitement — 30 jours d&apos;essai, sans carte bancaire.
                </p>
              </div>

              {/* Offer cards */}
              <div className="space-y-3 mb-6">
                {([
                  {
                    key: 'entrepreneur' as const,
                    label: 'Entrepreneur',
                    price: '15 000 FCFA / mois',
                    sub: 'Pour indépendants, TPE et petites structures',
                    icon: User,
                  },
                  {
                    key: 'business' as const,
                    label: 'Business',
                    price: '25 000 FCFA / mois',
                    sub: 'Pour PME, cabinets et secteurs spécialisés',
                    icon: Building2,
                  },
                ] as { key: 'entrepreneur'|'business'; label: string; price: string; sub: string; icon: typeof User }[]).map(o => {
                  const active = offer === o.key
                  const Icon = o.icon
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setOffer(o.key)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all"
                      style={{
                        borderColor: active ? '#16A34A' : '#E2E8F0',
                        background: active ? '#F0FDF4' : '#FAFAFA',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: active ? '#16A34A' : '#F1F5F9' }}
                      >
                        <Icon size={18} style={{ color: active ? 'white' : '#94A3B8' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-bold text-[#0F172A]">{o.label}</span>
                          <span className="text-[12px] font-bold" style={{ color: active ? '#16A34A' : '#64748B' }}>
                            {o.price}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">{o.sub}</p>
                      </div>
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: active ? '#16A34A' : '#CBD5E1' }}
                      >
                        {active && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Special pricing hint */}
              <div className="p-3 rounded-xl mb-6" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <p className="text-[11px] font-semibold text-[#92400E] mb-1">Tarifs spéciaux :</p>
                <div className="space-y-0.5 text-[11px] text-[#78350F]">
                  <div>Cabinet comptable : <strong>20 000 FCFA / mois</strong> + 5 000 / client actif</div>
                  <div>École (primaire / collège / lycée) : <strong>35 000 FCFA / mois</strong></div>
                  <div>Université : <strong>56 000 FCFA / mois</strong></div>
                </div>
              </div>

              <button
                type="button"
                disabled={!canStep0}
                onClick={() => setStep(1)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canStep0 ? '#16A34A' : '#E2E8F0', color: 'white' }}
              >
                Continuer <ArrowRight size={16} />
              </button>

              <p className="text-center text-[12px] text-[#94A3B8] mt-5">
                Déjà un compte ?{' '}
                <Link href="/login" className="text-green-600 font-semibold hover:underline">Se connecter</Link>
              </p>
            </>
          )}

          {/* ── STEP 1: Registration form ───────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleSubmit}>
              <div className="mb-7">
                <button type="button" onClick={() => setStep(0)}
                  className="flex items-center gap-1.5 text-[12px] text-[#94A3B8] hover:text-[#0F172A] mb-4 transition-colors">
                  <ChevronLeft size={14} /> Changer d&apos;offre
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8]">Étape 2 / 2</span>
                </div>
                <h1 className="text-2xl font-black text-[#0F172A] mt-2">Créer votre compte</h1>
                <p className="text-[13px] text-[#64748B] mt-1">Accès immédiat — 30 jours d&apos;essai gratuit</p>
              </div>

              {/* OAuth */}
              <button
                type="button"
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-gray-200 text-[13px] font-semibold text-[#0F172A] hover:border-gray-300 hover:bg-gray-50 transition-all mb-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                Continuer avec Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Prénom</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="text" required value={form.prenom}
                      onChange={e => upd('prenom', e.target.value)}
                      placeholder="Jean"
                      className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-gray-200 rounded-xl text-[#0F172A] placeholder-gray-300 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Nom</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="text" required value={form.nom}
                      onChange={e => upd('nom', e.target.value)}
                      placeholder="Dupont"
                      className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-gray-200 rounded-xl text-[#0F172A] placeholder-gray-300 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Email professionnel</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="email" required value={form.email}
                    onChange={e => upd('email', e.target.value)}
                    placeholder="vous@entreprise.com"
                    autoComplete="email"
                    className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-gray-200 rounded-xl text-[#0F172A] placeholder-gray-300 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Téléphone</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="tel" value={form.telephone}
                    onChange={e => upd('telephone', e.target.value)}
                    placeholder="+242 06 XXX XX XX"
                    className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-gray-200 rounded-xl text-[#0F172A] placeholder-gray-300 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type={showPwd ? 'text' : 'password'} required value={form.password}
                    onChange={e => upd('password', e.target.value)}
                    placeholder="8 caractères minimum"
                    autoComplete="new-password"
                    className="w-full pl-8 pr-10 py-2.5 text-[13px] border border-gray-200 rounded-xl text-[#0F172A] placeholder-gray-300 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Sector selection (Business only) */}
              {offer === 'business' && (
                <div className="mb-4">
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                    Secteur d&apos;activité <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {SECTORS.map((s, i) => {
                      const uniqueKey = `${s.id}-${s.label}`
                      const isSelected = sector === uniqueKey || (i === 0 && sector === s.id)
                      return (
                        <button
                          key={uniqueKey}
                          type="button"
                          onClick={() => setSector(uniqueKey)}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all"
                          style={{
                            borderColor: sector === uniqueKey ? '#D97706' : '#E2E8F0',
                            background: sector === uniqueKey ? '#FFFBEB' : '#FAFAFA',
                          }}
                        >
                          <span className="text-lg leading-none">{s.emoji}</span>
                          <span className="text-[9px] font-semibold leading-tight"
                            style={{ color: sector === uniqueKey ? '#92400E' : '#64748B' }}>
                            {s.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {/* Special pricing note */}
                  {sector && (() => {
                    const sId = SECTORS.find(s => `${s.id}-${s.label}` === sector)?.id
                    const note = sId ? SPECIAL_NOTE[sId] : null
                    if (!note) return null
                    return (
                      <div className="mt-2 px-3 py-2 rounded-xl text-[11px]"
                        style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                        Tarif spécial : <strong>{note.price}</strong>
                        {note.note && <span className="ml-1">{note.note}</span>}
                      </div>
                    )
                  })()}
                </div>
              )}

              {error && (
                <div className="px-4 py-3 rounded-xl text-[13px] mb-4"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !canStep1}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#D97706', color: 'white' }}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle2 size={16} /> Créer mon compte gratuit</>
                }
              </button>

              <p className="text-center text-[11px] text-[#94A3B8] mt-4">
                En créant votre compte, vous acceptez les{' '}
                <a href="/cgv" className="underline text-[#64748B]">conditions générales</a>.
              </p>

              <p className="text-center text-[12px] text-[#94A3B8] mt-3">
                Déjà un compte ?{' '}
                <Link href="/login" className="text-green-600 font-semibold hover:underline">Se connecter</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
