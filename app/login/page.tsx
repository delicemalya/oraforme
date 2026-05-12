'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

type AuthMode = 'email' | 'phone'
type PhoneStep = 'enter' | 'otp'

// Google SVG icon (inline, no extra dependency)
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

export default function LoginPage() {
  const [mode,      setMode]      = useState<AuthMode>('email')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [otp,       setOtp]       = useState('')
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogleLogin() {
    setError('')
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // Page will redirect — no need to reset loading
  }

  // ── Email / password ──────────────────────────────────────────────────────
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }
    window.location.href = '/dashboard'
  }

  // ── Phone: send OTP ───────────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!phone.trim()) { setError('Entrez votre numéro de téléphone.'); return }
    const normalized = phone.startsWith('+') ? phone : `+242${phone.replace(/^0/, '')}`
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser: false },
    })
    if (err) {
      setError(err.message === 'Signups not allowed for otp'
        ? 'Aucun compte trouvé pour ce numéro.'
        : err.message)
      setLoading(false)
      return
    }
    setPhone(normalized)
    setPhoneStep('otp')
    setLoading(false)
  }

  // ── Phone: verify OTP ────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: err } = await supabase.auth.verifyOtp({
      phone, token: otp.trim(), type: 'sms',
    })
    if (err) {
      setError('Code incorrect ou expiré. Réessayez.')
      setLoading(false)
      return
    }
    if (data.session) window.location.href = '/dashboard'
  }

  function switchMode(m: AuthMode) {
    setMode(m)
    setError('')
    setPhoneStep('enter')
    setOtp('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0D1117]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="oraforme" className="w-8 h-8" />
            <span className="text-xl font-bold text-[#E6EDF3]">oraforme</span>
          </div>
          <p className="text-[#8B949E] text-sm">Connectez-vous à votre espace</p>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-8">

          {/* ── Google OAuth ──────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[#30363D] bg-[#21262D] text-[#E6EDF3] text-sm font-medium hover:border-[#484F58] hover:bg-[#30363D] transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-5"
          >
            <GoogleIcon />
            Continuer avec Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#30363D]" />
            <span className="text-xs text-[#484F58]">ou</span>
            <div className="flex-1 h-px bg-[#30363D]" />
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg bg-[#21262D] p-1 mb-6">
            {(['email', 'phone'] as AuthMode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm rounded-md font-medium transition-all ${
                  mode === m ? 'bg-[#F0A30A] text-[#0D1117]' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                }`}
              >
                {m === 'email' ? '📧 Email' : '📱 Téléphone'}
              </button>
            ))}
          </div>

          {/* ── Email form ────────────────────────────────────────────── */}
          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="vous@entreprise.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[#8B949E]">Mot de passe</label>
                  <Link href="/forgot-password" className="text-xs text-[#F0A30A] hover:underline">
                    Oublié ?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#21262D] border border-[#30363D] text-[#E6EDF3] text-sm focus:outline-none focus:border-[#F0A30A] placeholder-[#484F58] transition-colors"
                />
              </div>
              {error && <ErrorBox message={error} />}
              <Button type="submit" loading={loading} className="w-full mt-2">
                Se connecter
              </Button>
            </form>
          )}

          {/* ── Phone: enter number ───────────────────────────────────── */}
          {mode === 'phone' && phoneStep === 'enter' && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#8B949E]">Numéro de téléphone</label>
                <div className="flex gap-2">
                  <div className="px-3 py-2.5 rounded-lg bg-[#21262D] border border-[#30363D] text-[#8B949E] text-sm shrink-0 flex items-center">
                    🇨🇬 +242
                  </div>
                  <input
                    type="tel"
                    placeholder="06 000 00 00"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#21262D] border border-[#30363D] text-[#E6EDF3] text-sm focus:outline-none focus:border-[#F0A30A] placeholder-[#484F58]"
                    required
                  />
                </div>
                <p className="text-xs text-[#484F58]">
                  Un SMS de vérification sera envoyé à ce numéro.
                </p>
              </div>
              {error && <ErrorBox message={error} />}
              <Button type="submit" loading={loading} className="w-full">
                Recevoir le code →
              </Button>
            </form>
          )}

          {/* ── Phone: enter OTP ─────────────────────────────────────── */}
          {mode === 'phone' && phoneStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="p-3 bg-[#F0A30A]/5 border border-[#F0A30A]/20 rounded-lg text-xs text-[#F0A30A]">
                Code envoyé au <strong>{phone}</strong>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#8B949E]">Code de vérification</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] rounded-lg bg-[#21262D] border border-[#30363D] text-[#E6EDF3] focus:outline-none focus:border-[#F0A30A] placeholder-[#484F58]"
                  required
                />
              </div>
              {error && <ErrorBox message={error} />}
              <Button type="submit" loading={loading} className="w-full">
                Vérifier le code
              </Button>
              <button
                type="button"
                onClick={() => { setPhoneStep('enter'); setOtp(''); setError('') }}
                className="text-xs text-[#8B949E] hover:text-[#E6EDF3] text-center"
              >
                ← Changer de numéro
              </button>
            </form>
          )}

          <p className="text-center text-sm text-[#8B949E] mt-6">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-[#F0A30A] hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  )
}
