'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, MailCheck, ArrowRight, Zap } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' })
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showPwd,   setShowPwd]   = useState(false)

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setLoading(true)

    // Sign out any existing session before creating a new account
    await supabase.auth.signOut()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Email confirmation enabled — show confirmation screen
    if (!data.session) {
      setEmailSent(true)
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  // ── Email confirmation screen ─────────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#0A0A0F]">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center mx-auto mb-6">
            <MailCheck size={28} className="text-[#F59E0B]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Vérifiez votre email</h2>
          <p className="text-white/40 text-sm leading-relaxed mb-6">
            Un lien de confirmation a été envoyé à{' '}
            <span className="text-white font-medium">{form.email}</span>.
            Cliquez sur ce lien pour activer votre compte.
          </p>
          <p className="text-white/25 text-xs mb-6">Pensez à vérifier votre dossier spam.</p>
          <Link href="/login" className="text-[#F59E0B] text-sm hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  // ── Register form ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0A0A0F]">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="oraforme" className="w-9 h-9 mx-auto mb-3"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <h1 className="text-2xl font-bold text-white">Créer votre compte</h1>
          <p className="text-white/40 text-sm mt-1">Votre ERP africain en 4 minutes</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Email professionnel</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="vous@entreprise.com"
              required
              autoComplete="email"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Mot de passe</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="8 caractères minimum"
                required
                autoComplete="new-password"
                className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 pr-11 outline-none focus:border-[#F59E0B]/50 transition-colors"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">Confirmer le mot de passe</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={e => set('confirmPassword', e.target.value)}
              placeholder="Répétez le mot de passe"
              required
              autoComplete="new-password"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm rounded-xl px-4 py-3 outline-none focus:border-[#F59E0B]/50 transition-colors"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.email || !form.password || !form.confirmPassword}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
            style={{ background: '#F59E0B', color: '#000' }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <><Zap size={15} /> Créer mon compte</>
            )}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-[#F59E0B] hover:underline font-semibold">
            Se connecter
          </Link>
        </p>

        <p className="text-center text-white/15 text-[11px] mt-4">
          En créant votre compte, vous acceptez les{' '}
          <a href="/cgv" className="underline">conditions générales</a>.
        </p>
      </div>
    </div>
  )
}
