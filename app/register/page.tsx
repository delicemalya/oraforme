'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Eye, EyeOff, MailCheck, ArrowRight, ArrowLeft,
  CheckCircle2, User, Mail, Lock, Phone,
} from 'lucide-react'

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

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm]         = useState({ prenom: '', nom: '', email: '', telephone: '', password: '' })
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [showPwd,   setShowPwd]   = useState(false)

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const canSubmit = form.prenom && form.nom && form.email && form.password.length >= 8

  async function handleGoogle() {
    try {
      localStorage.setItem('oraforme_reg', JSON.stringify({
        prenom: form.prenom, nom: form.nom, telephone: form.telephone,
      }))
    } catch { /* ignore */ }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setLoading(true)

    // Store basic info for onboarding pre-fill
    try {
      localStorage.setItem('oraforme_reg', JSON.stringify({
        prenom: form.prenom, nom: form.nom, telephone: form.telephone,
      }))
    } catch { /* ignore */ }

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

    // Session exists → email confirmations disabled → go directly to onboarding
    if (data.session) {
      router.push('/onboarding')
      return
    }

    // Email confirmation required
    setEmailSent(true)
    setLoading(false)
  }

  // ── Email sent screen ──────────────────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC]">
        <div className="w-full max-w-sm text-center bg-white rounded-3xl p-8 border border-[#E2E8F0]">
          <div className="w-16 h-16 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-5">
            <MailCheck size={28} className="text-[#16A34A]" />
          </div>
          <h2 className="text-2xl font-black text-[#0F172A] mb-3">Vérifiez votre email</h2>
          <p className="text-[#64748B] text-[14px] leading-relaxed mb-2">
            Un lien d&apos;activation a été envoyé à
          </p>
          <p className="text-[#0F172A] font-bold text-[14px] mb-6">{form.email}</p>
          <p className="text-[#94A3B8] text-[12px] mb-6">
            Cliquez sur le lien pour activer votre compte. Pensez à vérifier vos spams.
          </p>
          <Link href="/login" className="text-[#16A34A] text-[13px] font-bold hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
      <div
        className="lg:w-[42%] shrink-0 flex flex-col justify-between px-8 py-10 lg:px-12 lg:py-14"
        style={{ background: 'linear-gradient(145deg,#F59E0B 0%,#D97706 60%,#B45309 100%)' }}
      >
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Oraforme" className="h-9 w-auto"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <Link href="/"
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-semibold transition-colors">
            <ArrowLeft size={13} /> Accueil
          </Link>
        </div>

        <div className="mt-10 lg:mt-0">
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5 mb-6">
            <span className="text-white text-[11px] font-bold uppercase tracking-widest">Essai gratuit 30 jours</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
            Lancez votre ERP<br />en 3 minutes.
          </h2>
          <p className="text-white/70 text-[14px] leading-relaxed mb-8">
            Sans carte bancaire. Accès immédiat à tous les modules métier.
          </p>
          {[
            'Comptabilité SYSCOHADA officielle',
            'RH, Paie & Trésorerie intégrés',
            'MIAA+ — Intelligence artificielle métier',
            'Mobile Money (Airtel, MTN, Orange)',
            'Support en français & langues africaines',
          ].map(b => (
            <div key={b} className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={15} className="text-white/75 shrink-0" />
              <span className="text-white/85 text-[13px]">{b}</span>
            </div>
          ))}
        </div>

        <div>
          <p className="text-white/50 text-[12px] mb-3">Déjà un compte ?</p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-white/30 text-white text-[13px] font-bold hover:bg-white/10 hover:border-white/50 transition-all">
            Se connecter <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 bg-white">
        <div className="w-full max-w-md">

          <div className="mb-8">
            <h1 className="text-2xl font-black text-[#0F172A]">Créer votre compte</h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Accès immédiat · 30 jours gratuits · Sans carte bancaire
            </p>
          </div>

          {/* Google */}
          <button type="button" onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] hover:border-gray-300 hover:bg-gray-50 transition-all mb-4 disabled:opacity-50">
            <GoogleIcon /> Continuer avec Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Prénom</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input type="text" required value={form.prenom}
                    onChange={e => upd('prenom', e.target.value)} placeholder="Jean"
                    className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Nom</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input type="text" required value={form.nom}
                    onChange={e => upd('nom', e.target.value)} placeholder="Dupont"
                    className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Email professionnel</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input type="email" required value={form.email}
                  onChange={e => upd('email', e.target.value)}
                  placeholder="vous@entreprise.com" autoComplete="email"
                  className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Téléphone (optionnel)</label>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input type="tel" value={form.telephone}
                  onChange={e => upd('telephone', e.target.value)}
                  placeholder="+242 06 XXX XX XX"
                  className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input type={showPwd ? 'text' : 'password'} required value={form.password}
                  onChange={e => upd('password', e.target.value)}
                  placeholder="8 caractères minimum" autoComplete="new-password"
                  className="w-full pl-8 pr-10 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15" />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {form.password.length > 0 && form.password.length < 8 && (
                <p className="text-[#DC2626] text-[11px] mt-1">8 caractères minimum</p>
              )}
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-[13px]"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !canSubmit}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[14px] text-white transition-all disabled:opacity-40"
              style={{ background: canSubmit && !loading ? '#F59E0B' : '#E2E8F0' }}>
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><CheckCircle2 size={16} /> Créer mon compte gratuit</>
              }
            </button>
          </form>

          <p className="text-center text-[11px] text-[#94A3B8] mt-5">
            En créant votre compte, vous acceptez les{' '}
            <a href="/cgv" className="underline text-[#64748B]">conditions générales</a>.
          </p>
          <p className="text-center text-[12px] text-[#94A3B8] mt-3">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-[#F59E0B] font-bold hover:underline">Se connecter</Link>
          </p>

        </div>
      </div>
    </div>
  )
}
