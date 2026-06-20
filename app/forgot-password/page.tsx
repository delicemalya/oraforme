'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Mail, ArrowLeft, MailCheck, ShieldCheck, Key, Lock } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    if (err) { setError(err.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  // ── Email envoyé ─────────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        <LeftPanel />
        <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 bg-white">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
              <MailCheck size={28} className="text-[#DC2626]" />
            </div>
            <h2 className="text-2xl font-black text-[#0F172A] mb-3">Email envoyé !</h2>
            <p className="text-[#64748B] text-sm leading-relaxed mb-2">
              Un lien de réinitialisation a été envoyé à{' '}
              <strong className="text-[#0F172A]">{email}</strong>.
            </p>
            <p className="text-[#94A3B8] text-xs mb-8">Pensez à vérifier votre dossier spam.</p>
            <Link href="/login"
              className="inline-flex items-center gap-2 text-[#DC2626] text-sm font-bold hover:underline">
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulaire ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <LeftPanel />

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 bg-white">
        <div className="w-full max-w-md">

          <Link href="/login"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#94A3B8] hover:text-[#64748B] mb-8 transition-colors">
            <ArrowLeft size={13} /> Retour à la connexion
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-black text-[#0F172A]">Mot de passe oublié ?</h1>
            <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
              Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Adresse email
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="vous@entreprise.com" autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-[12px] text-red-700"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-2xl text-[14px] font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#DC2626' }}>
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Envoyer le lien de réinitialisation'
              }
            </button>
          </form>

          <p className="text-center text-[12px] text-[#94A3B8] mt-8">
            Vous vous en souvenez ?{' '}
            <Link href="/login" className="text-[#DC2626] font-bold hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Panneau gauche commun ─────────────────────────────────────────────────────

function LeftPanel() {
  const tips = [
    { icon: Key,         text: 'Utilisez un mot de passe de 12+ caractères' },
    { icon: ShieldCheck, text: 'Mélangez lettres, chiffres et symboles' },
    { icon: Lock,        text: 'N\'utilisez pas le même mot de passe partout' },
    { icon: Mail,        text: 'Activez la double authentification (2FA)' },
  ]
  return (
    <div
      className="lg:w-[42%] shrink-0 flex flex-col justify-between px-8 py-10 lg:px-12 lg:py-14"
      style={{ background: 'linear-gradient(145deg,#7F1D1D 0%,#DC2626 60%,#EF4444 100%)' }}
    >
      <div>
        { }
        <img src="/logo-white.png" alt="Oraforme" className="h-9 w-auto"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      </div>

      <div className="my-10 lg:my-0">
        <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5 mb-6">
          <span className="text-white text-[11px] font-bold uppercase tracking-widest">Sécurité</span>
        </div>
        <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
          Sécurisez<br />votre compte.
        </h2>
        <p className="text-white/70 text-sm leading-relaxed mb-8">
          Votre compte contient des données sensibles de votre entreprise.
          Choisissez un mot de passe robuste.
        </p>
        <div className="space-y-4">
          {tips.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-white" />
              </div>
              <span className="text-white/85 text-[13px]">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-white/40 text-[11px]">Vos données sont chiffrées et sécurisées.</p>
      </div>
    </div>
  )
}
