'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, CheckCircle2, Lock, ShieldCheck } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd,         setShowPwd]         = useState(false)
  const [showCPwd,        setShowCPwd]        = useState(false)
  const [error,           setError]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [done,            setDone]            = useState(false)

  const strength = password.length === 0 ? 0
    : password.length < 8 ? 1
    : password.length < 12 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 4
    : 3

  const strengthLabel = ['', 'Trop court', 'Correct', 'Bon', 'Excellent'][strength]
  const strengthColor = ['', '#EF4444', '#F59E0B', '#16A34A', '#16A34A'][strength]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2500)
  }

  // ── Succès ────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        <LeftPanel />
        <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 bg-white">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={28} className="text-[#16A34A]" />
            </div>
            <h2 className="text-2xl font-black text-[#0F172A] mb-3">Mot de passe mis à jour !</h2>
            <p className="text-[#64748B] text-sm">Vous allez être redirigé vers votre tableau de bord…</p>
            <div className="mt-6 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full animate-[grow_2.5s_linear_forwards]" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulaire ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <LeftPanel />

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 bg-white">
        <div className="w-full max-w-md">

          <div className="mb-8">
            <h1 className="text-2xl font-black text-[#0F172A]">Nouveau mot de passe</h1>
            <p className="text-[13px] text-[#64748B] mt-1">Choisissez un mot de passe sécurisé d&apos;au moins 8 caractères.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mot de passe */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type={showPwd ? 'text' : 'password'} required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 caractères" autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {/* Force indicator */}
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all"
                        style={{ background: i <= strength ? strengthColor : '#E2E8F0' }} />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold shrink-0" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Confirmation */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type={showCPwd ? 'text' : 'password'} required
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all"
                />
                <button type="button" onClick={() => setShowCPwd(!showCPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                  {showCPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
              )}
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
                : <><ShieldCheck size={16} /> Enregistrer le nouveau mot de passe</>
              }
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}

// ── Panneau gauche commun ─────────────────────────────────────────────────────

function LeftPanel() {
  const rules = [
    '8 caractères minimum',
    'Une majuscule et une minuscule',
    'Au moins un chiffre',
    'Un caractère spécial (@, #, $…)',
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
          Nouveau mot<br />de passe.
        </h2>
        <p className="text-white/70 text-sm leading-relaxed mb-8">
          Choisissez un mot de passe fort pour protéger les données de votre entreprise.
        </p>
        <p className="text-white/60 text-[12px] font-bold uppercase tracking-wider mb-3">Un bon mot de passe contient :</p>
        <div className="space-y-2.5">
          {rules.map(r => (
            <div key={r} className="flex items-center gap-3">
              <CheckCircle2 size={14} className="text-white/70 shrink-0" />
              <span className="text-white/85 text-[13px]">{r}</span>
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
