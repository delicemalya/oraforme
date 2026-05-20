'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { MailCheck } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    nomEntreprise: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // State shown when Supabase requires email confirmation
  const [emailSent, setEmailSent] = useState(false)

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
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

    // ── CRITICAL FIX 1 ────────────────────────────────────────────────────────
    // Sign out ANY existing session before creating a new account.
    // Without this, if a developer/tester is logged in with a different account
    // and navigates to /register, their session cookie persists through signUp()
    // when email confirmation is ON — causing the new user's onboarding action
    // to authenticate as the WRONG user and redirect to the wrong tenant dashboard.
    await supabase.auth.signOut()
    // ── END CRITICAL FIX 1 ───────────────────────────────────────────────────

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { nom_entreprise: form.nomEntreprise },
        // Tell Supabase where to redirect after the user clicks the confirmation link.
        // This must also be added to "Redirect URLs" in the Supabase dashboard:
        //   Authentication → URL Configuration → Redirect URLs
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // ── CRITICAL FIX 2 ────────────────────────────────────────────────────────
    // When Supabase email confirmation is ENABLED, signUp() returns:
    //   { data: { user, session: null }, error: null }
    // session is null because the user must click the confirmation link first.
    // The previous code checked only `error`, treated null-session as success,
    // and pushed to /onboarding — but no session was established for the new user.
    // The middleware (or the onboarding server action) would then pick up the
    // stale session from an already-logged-in user (the test account).
    //
    // Fix: If session is null → show "check your email" screen. Do NOT redirect.
    if (!data.session) {
      setEmailSent(true)
      setLoading(false)
      return
    }
    // ── END CRITICAL FIX 2 ───────────────────────────────────────────────────

    // Session is established (email confirmation disabled in Supabase settings).
    // The new user is now properly authenticated — proceed to onboarding.
    router.push('/onboarding')
  }

  // ── Email confirmation screen ─────────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-10">
            <div className="w-14 h-14 rounded-full bg-[#F51E33]/10 flex items-center justify-center mx-auto mb-5">
              <MailCheck size={28} className="text-[#F51E33]" />
            </div>
            <h2 className="text-lg font-bold text-[#FFFFFF] mb-2">Vérifiez votre email</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              Un lien de confirmation a été envoyé à{' '}
              <span className="text-[#FFFFFF] font-medium">{form.email}</span>.
              Cliquez sur ce lien pour activer votre compte et démarrer l&apos;installation.
            </p>
            <p className="text-xs text-[var(--text-secondary)] mb-6">
              Pensez à vérifier votre dossier spam si vous ne trouvez pas l&apos;email.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm text-[#F51E33] hover:underline"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back button */}
        <div className="mb-4">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[#FFFFFF] transition-colors">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06z"/></svg>
            Se connecter
          </Link>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="oraforme" className="w-8 h-8" />
            <span className="text-xl font-bold text-[#FFFFFF]">oraforme</span>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">Créez votre espace entreprise</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-8">
          <h1 className="text-lg font-semibold text-[#FFFFFF] mb-6">Créer un compte</h1>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <Input
              label="Nom de l'entreprise"
              type="text"
              placeholder="Ma Société SARL"
              value={form.nomEntreprise}
              onChange={(e) => set('nomEntreprise', e.target.value)}
              required
            />
            <Input
              label="Email professionnel"
              type="email"
              placeholder="vous@entreprise.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
            />
            <Input
              label="Mot de passe"
              type="password"
              placeholder="Min. 8 caractères"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              required
            />
            <Input
              label="Confirmer le mot de passe"
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              required
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full mt-2">
              Créer mon compte
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-[#F51E33] hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
