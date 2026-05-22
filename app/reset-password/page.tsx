'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error,           setError]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [done,            setDone]            = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2500)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-10">
            <div className="w-14 h-14 rounded-full bg-[#2EA043]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={28} className="text-[#2EA043]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text)] mb-2">Mot de passe mis à jour</h2>
            <p className="text-sm text-[var(--text-secondary)]">Vous allez être redirigé vers votre tableau de bord...</p>
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
          <img src="/logo-icon.png" alt="oraforme" className="w-8 h-8 mx-auto mb-2" />
          <span className="text-xl font-bold text-[var(--text)]">oraforme</span>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-8">
          <h1 className="text-base font-semibold text-[var(--text)] mb-1">Nouveau mot de passe</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">Choisissez un mot de passe sécurisé d&apos;au moins 8 caractères.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Nouveau mot de passe</label>
              <input
                type="password"
                placeholder="Min. 8 caractères"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[#F51E33] placeholder-[#484F58] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Confirmer le mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[#F51E33] placeholder-[#484F58] transition-colors"
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
              {loading ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
