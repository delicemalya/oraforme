'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MailCheck, ArrowLeft } from 'lucide-react'

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

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-10">
            <div className="w-14 h-14 rounded-full bg-[#2EA043]/10 flex items-center justify-center mx-auto mb-5">
              <MailCheck size={28} className="text-[#2EA043]" />
            </div>
            <h2 className="text-lg font-bold text-[#FFFFFF] mb-2">Email envoyé</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              Un lien de réinitialisation a été envoyé à{' '}
              <span className="text-[#FFFFFF] font-medium">{email}</span>.
              Vérifiez votre boîte mail (et le dossier spam).
            </p>
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[#F51E33] hover:underline">
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="oraforme" className="w-8 h-8 mx-auto mb-2" />
          <span className="text-xl font-bold text-[#FFFFFF]">oraforme</span>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Réinitialiser votre mot de passe</p>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-8">
          <h1 className="text-base font-semibold text-[#FFFFFF] mb-1">Mot de passe oublié ?</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Email</label>
              <input
                type="email"
                placeholder="vous@entreprise.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-lg bg-[#1a2d50] border border-[var(--border)] text-[#FFFFFF] text-sm focus:outline-none focus:border-[#F51E33] placeholder-[#484F58] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-[#F51E33] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#F51E33' }}
            >
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            <Link href="/login" className="inline-flex items-center gap-1 text-[#F51E33] hover:underline">
              <ArrowLeft size={12} /> Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
