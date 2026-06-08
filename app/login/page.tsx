'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, CheckCircle2, ArrowRight, Mail, Phone as PhoneIcon, Lock } from 'lucide-react'

type AuthMode  = 'email' | 'phone'
type PhoneStep = 'enter' | 'otp'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20c11 0 19.7-7.7 19.7-20 0-1.3-.1-2.7-.2-3z" fill="#FFC107"/>
      <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.7 0-14.4 4.4-17.7 11.7z" fill="#FF3D00"/>
      <path d="M24 43c5.6 0 10.3-1.9 14-5.1l-6.5-5.5C29.5 34.3 26.9 35 24 35c-6.1 0-11.2-4.1-13.1-9.6l-7 5.4C7.2 38.3 15 43 24 43z" fill="#4CAF50"/>
      <path d="M44.5 20H24v8.5h11.8c-.7 2.2-2.1 4.1-4 5.4l6.5 5.5C41.7 36.3 44.5 30 44.5 23c0-1-.1-2-.2-3z" fill="#1976D2"/>
    </svg>
  )
}

function MsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
      <rect x="0" y="0" width="10" height="10" fill="#F35325"/>
      <rect x="11" y="0" width="10" height="10" fill="#81BC06"/>
      <rect x="0" y="11" width="10" height="10" fill="#05A6F0"/>
      <rect x="11" y="11" width="10" height="10" fill="#FFBA08"/>
    </svg>
  )
}

const LEFT_BENEFITS = [
  '50+ modules ERP intégrés',
  'Comptabilité SYSCOHADA officielle',
  'MIAA+ — Intelligence artificielle métier',
  'Mobile Money & paiements locaux',
  'Support en français & langues africaines',
]

// ── Shared micro-components ───────────────────────────────────────────────────

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="px-4 py-3 rounded-xl text-[12px] text-red-700"
      style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
      {msg}
    </div>
  )
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
}

const inputBase = "w-full pl-9 pr-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all"

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [mode,      setMode]      = useState<AuthMode>('email')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const [phone,     setPhone]     = useState('')
  const [otp,       setOtp]       = useState('')
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  async function handleGoogleLogin() {
    setError(''); setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleMicrosoftLogin() {
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) { setError('Microsoft non configuré. Utilisez email ou Google.'); setLoading(false) }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!phone.trim()) { setError('Entrez votre numéro de téléphone.'); return }
    const normalized = phone.startsWith('+') ? phone : `+242${phone.replace(/^0/, '')}`
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: normalized, options: { shouldCreateUser: false },
    })
    if (err) {
      setError(err.message === 'Signups not allowed for otp'
        ? 'Aucun compte trouvé pour ce numéro.' : err.message)
      setLoading(false); return
    }
    setPhone(normalized); setPhoneStep('otp'); setLoading(false)
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { data, error: err } = await supabase.auth.verifyOtp({
      phone, token: otp.trim(), type: 'sms',
    })
    if (err) { setError('Code incorrect ou expiré. Réessayez.'); setLoading(false); return }
    if (data.session) window.location.href = '/dashboard'
  }

  function switchMode(m: AuthMode) { setMode(m); setError(''); setPhoneStep('enter'); setOtp('') }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT PANEL (rouge) ─────────────────────────────────────────────── */}
      <div
        className="lg:w-[42%] shrink-0 flex flex-col justify-between px-8 py-10 lg:px-12 lg:py-14"
        style={{ background: 'linear-gradient(145deg,#7F1D1D 0%,#DC2626 60%,#EF4444 100%)' }}
      >
        {/* Logo */}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Oraforme" className="h-9 w-auto"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>

        {/* Main content */}
        <div className="my-10 lg:my-0">
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5 mb-6">
            <span className="text-white text-[11px] font-bold uppercase tracking-widest">Espace membre</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
            Bon retour !
          </h2>
          <p className="text-white/70 text-sm leading-relaxed mb-8">
            Votre espace de gestion Oraforme vous attend.<br />
            Pilotez votre entreprise intelligemment.
          </p>
          {LEFT_BENEFITS.map(b => (
            <div key={b} className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={15} className="text-white/75 shrink-0" />
              <span className="text-white/85 text-[13px]">{b}</span>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div>
          <p className="text-white/50 text-[12px] mb-3">Pas encore de compte ?</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-white/30 text-white text-[13px] font-bold hover:bg-white/10 hover:border-white/50 transition-all">
            COMMENCER GRATUITEMENT <ArrowRight size={14} />
          </Link>
          <p className="text-white/40 text-[11px] mt-2">30 jours gratuits · Sans carte bancaire</p>
        </div>
      </div>

      {/* ── RIGHT PANEL (blanc) ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 bg-white">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-[#0F172A]">Connexion</h1>
            <p className="text-[13px] text-[#64748B] mt-1">Accédez à votre espace Oraforme</p>
          </div>

          {/* OAuth */}
          <div className="space-y-3 mb-6">
            <button type="button" onClick={handleGoogleLogin} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50">
              <GoogleIcon /> Continuer avec Google
            </button>
            <button type="button" onClick={handleMicrosoftLogin} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50">
              <MsIcon /> Continuer avec Microsoft
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-[#F1F5F9] mb-6">
            {(['email', 'phone'] as AuthMode[]).map(m => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
                style={{
                  background: mode === m ? '#DC2626' : 'transparent',
                  color:      mode === m ? 'white'   : '#64748B',
                }}>
                {m === 'email' ? <><Mail size={13} /> Email</> : <><PhoneIcon size={13} /> Téléphone</>}
              </button>
            ))}
          </div>

          {/* ── Email form ─────────────────────────────────────────────── */}
          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="vous@entreprise.com" autoComplete="email" className={inputBase} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Mot de passe</label>
                  <Link href="/forgot-password" className="text-[11px] text-[#DC2626] hover:underline font-semibold">Oublié ?</Link>
                </div>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input type={showPwd ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password"
                    className="w-full pl-9 pr-10 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && <ErrBox msg={error} />}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-2xl text-[14px] font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#DC2626' }}>
                {loading ? <Spinner /> : 'Se connecter'}
              </button>
            </form>
          )}

          {/* ── Phone: entrer numéro ───────────────────────────────────── */}
          {mode === 'phone' && phoneStep === 'enter' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Numéro de téléphone</label>
                <div className="flex gap-2">
                  <span className="px-3 py-2.5 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] text-[13px] shrink-0 flex items-center">
                    🇨🇬 +242
                  </span>
                  <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="06 000 00 00"
                    className="flex-1 px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15" />
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1.5">Un SMS de vérification sera envoyé à ce numéro.</p>
              </div>
              {error && <ErrBox msg={error} />}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-2xl text-[14px] font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#DC2626' }}>
                {loading ? <Spinner /> : 'Recevoir le code →'}
              </button>
            </form>
          )}

          {/* ── Phone: saisir OTP ────────────────────────────────────── */}
          {mode === 'phone' && phoneStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="px-4 py-3 rounded-xl text-[12px] text-red-700"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                Code envoyé au <strong>{phone}</strong>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Code de vérification</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  value={otp} onChange={e => setOtp(e.target.value)} placeholder="000 000" required
                  className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] border border-[#E2E8F0] rounded-xl text-[#0F172A] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15" />
              </div>
              {error && <ErrBox msg={error} />}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-2xl text-[14px] font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#DC2626' }}>
                {loading ? <Spinner /> : 'Vérifier le code'}
              </button>
              <button type="button" onClick={() => { setPhoneStep('enter'); setOtp(''); setError('') }}
                className="w-full text-[12px] text-[#94A3B8] hover:text-[#64748B] text-center">
                ← Changer de numéro
              </button>
            </form>
          )}

          <p className="text-center text-[12px] text-[#94A3B8] mt-8">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-[#DC2626] font-bold hover:underline">Créer un compte</Link>
          </p>

        </div>
      </div>
    </div>
  )
}
