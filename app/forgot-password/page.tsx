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
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-10">
            <div className="w-14 h-14 rounded-full bg-[#2EA043]/10 flex items-center justify-center mx-auto mb-5">
              <MailCheck size={28} className="text-[#2EA043]" />
            </div>
            <h2 className="text-lg font-bold text-[#111827] mb-2">Email envoyé</h2>
            <p className="text-sm text-[#4B5563] leading-relaxed mb-4">
              Un lien de réinitialisation a été envoyé à{' '}
              <span className="text-[#111827] font-medium">{email}</span>.
              Vérifiez votre boîte mail (et le dossier spam).
            </p>
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[#F0A30A] hover:underline">
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
          <img src="/logo.svg" alt="oraforme" className="w-8 h-8 mx-auto mb-2" />
          <span className="text-xl font-bold text-[#111827]">oraforme</span>
          <p className="text-[#4B5563] text-sm mt-1">Réinitialiser votre mot de passe</p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8">
          <h1 className="text-base font-semibold text-[#111827] mb-1">Mot de passe oublié ?</h1>
          <p className="text-sm text-[#4B5563] mb-6">
            Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#4B5563]">Email</label>
              <input
                type="email"
                placeholder="vous@entreprise.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-lg bg-[#F0F4FF] border border-[#E2E8F0] text-[#111827] text-sm focus:outline-none focus:border-[#F0A30A] placeholder-[#9CA3AF] transition-colors"
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
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-[#0D1117] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #F0A30A, #d4880a)' }}
            >
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>

          <p className="text-center text-sm text-[#4B5563] mt-6">
            <Link href="/login" className="inline-flex items-center gap-1 text-[#F0A30A] hover:underline">
              <ArrowLeft size={12} /> Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
