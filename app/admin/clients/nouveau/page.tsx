'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, ArrowLeft, CheckCircle2, XCircle, Loader2, Package,
  Globe, Mail, Phone, MapPin, User, Lock, DollarSign, ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import { MODULE_LABELS, MODULE_PRICES, MODULE_ICONS } from '@/lib/admin-config'

type Plan = 'starter' | 'business' | 'premium'

const PAYS = ['Congo-Brazzaville', 'Côte d\'Ivoire', 'Cameroun', 'Sénégal', 'Gabon', 'RDC', 'Mali', 'Burkina Faso', 'Autre']
const SECTEURS = ['Commerce', 'Services', 'BTP', 'Santé', 'Éducation', 'Restauration', 'Transport', 'Agriculture', 'Finance', 'Technologie', 'Autre']
const DEVISES  = ['FCFA (XAF)', 'EUR (€)', 'USD ($)', 'CDF (FC)']

const PLAN_CONFIG: Record<Plan, { label: string; desc: string; color: string }> = {
  starter:  { label: 'Starter',  desc: 'Jusqu\'à 3 modules', color: '#94A3B8' },
  business: { label: 'Business', desc: 'Jusqu\'à 7 modules',  color: '#3B82F6' },
  premium:  { label: 'Premium',  desc: 'Modules illimités',   color: '#F59E0B' },
}

export default function NouvelleEntreprisePage() {
  const { t } = useLocale()
  const router = useRouter()

  const [step, setStep]     = useState(1) // 1 = info, 2 = admin, 3 = modules, 4 = confirmation
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  // Step 1: Company info
  const [company, setCompany] = useState({
    nom_entreprise: '',
    secteur: '',
    pays: 'Congo-Brazzaville',
    ville: '',
    telephone: '',
    email_contact: '',
    plan: 'starter' as Plan,
    devise: 'FCFA (XAF)',
    logo_url: '',
  })

  // Step 2: Admin user
  const [admin, setAdmin] = useState({
    prenom: '',
    nom: '',
    email: '',
    password: '',
    password_confirm: '',
  })

  // Step 3: Modules
  const [selectedModules, setSelectedModules] = useState<string[]>([])

  function toggleModule(id: string) {
    const maxModules = company.plan === 'starter' ? 3 : company.plan === 'business' ? 7 : 99
    if (selectedModules.includes(id)) {
      setSelectedModules(prev => prev.filter(m => m !== id))
    } else {
      if (selectedModules.length >= maxModules) {
        showToast(`Plan ${company.plan} limité à ${maxModules} module(s)`, false)
        return
      }
      setSelectedModules(prev => [...prev, id])
    }
  }

  const mrrEstimate = selectedModules.reduce((s, m) => s + (MODULE_PRICES[m] ?? 0), 0)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 5000)
  }

  function validateStep1() {
    if (!company.nom_entreprise) return 'Nom entreprise obligatoire'
    if (!company.secteur)        return 'Secteur obligatoire'
    if (!company.email_contact)  return 'Email obligatoire'
    return null
  }

  function validateStep2() {
    if (!admin.prenom) return 'Prénom obligatoire'
    if (!admin.nom)    return 'Nom obligatoire'
    if (!admin.email)  return 'Email admin obligatoire'
    if (!admin.password || admin.password.length < 8) return 'Mot de passe: 8 caractères minimum'
    if (admin.password !== admin.password_confirm)    return 'Mots de passe différents'
    return null
  }

  function nextStep() {
    if (step === 1) {
      const err = validateStep1()
      if (err) { showToast(err, false); return }
    }
    if (step === 2) {
      const err = validateStep2()
      if (err) { showToast(err, false); return }
    }
    setStep(s => s + 1)
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/tenant/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          admin,
          modules: selectedModules,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur création')
      showToast(`Entreprise "${company.nom_entreprise}" créée avec succès !`)
      setTimeout(() => router.push(`/admin/clients/${data.tenantId}`), 1500)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur', false)
    } finally {
      setSaving(false)
    }
  }

  const STEPS = ['Infos entreprise', 'Admin principal', 'Modules', 'Confirmation']

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-[13px] font-semibold ${toast.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/clients" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} className="text-gray-500" />
        </Link>
        <div>
          <h1 className="text-[20px] font-bold text-gray-900">Créer une entreprise cliente</h1>
          <p className="text-sm text-gray-500">Inscription manuelle d&apos;un nouveau tenant</p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              step === i + 1 ? 'bg-amber-50' : ''
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                i + 1 < step  ? 'bg-green-500 text-white' :
                i + 1 === step ? 'bg-amber-500 text-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span className={`text-[12px] font-semibold hidden sm:block ${
                i + 1 === step ? 'text-amber-700' : i + 1 < step ? 'text-green-600' : 'text-gray-400'
              }`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i + 1 < step ? 'bg-green-400' : 'bg-gray-100'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — Company info */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Building2 size={15} className="text-blue-600" />
            </div>
            <h2 className="text-[15px] font-bold text-gray-900">Informations entreprise</h2>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Nom de l&apos;entreprise *</label>
            <input
              value={company.nom_entreprise}
              onChange={e => setCompany(c => ({ ...c, nom_entreprise: e.target.value }))}
              placeholder="Ex: SARL BatiCongo"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Secteur *</label>
              <div className="relative">
                <select
                  value={company.secteur}
                  onChange={e => setCompany(c => ({ ...c, secteur: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400 appearance-none"
                >
                  <option value="">Choisir…</option>
                  {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Pays</label>
              <div className="relative">
                <select
                  value={company.pays}
                  onChange={e => setCompany(c => ({ ...c, pays: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400 appearance-none"
                >
                  {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><MapPin size={11} />Ville</label>
              <input
                value={company.ville}
                onChange={e => setCompany(c => ({ ...c, ville: e.target.value }))}
                placeholder="Ex: Brazzaville"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Phone size={11} />{t('common.phone')}</label>
              <input
                value={company.telephone}
                onChange={e => setCompany(c => ({ ...c, telephone: e.target.value }))}
                placeholder="+242 06 XXX XXXX"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Mail size={11} />Email contact *</label>
            <input
              type="email"
              value={company.email_contact}
              onChange={e => setCompany(c => ({ ...c, email_contact: e.target.value }))}
              placeholder="contact@entreprise.com"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><DollarSign size={11} />Devise</label>
              <div className="relative">
                <select
                  value={company.devise}
                  onChange={e => setCompany(c => ({ ...c, devise: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400 appearance-none"
                >
                  {DEVISES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Globe size={11} />URL Logo (optionnel)</label>
              <input
                value={company.logo_url}
                onChange={e => setCompany(c => ({ ...c, logo_url: e.target.value }))}
                placeholder="https://…"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Plan selection */}
          <div>
            <label className="text-[12px] font-semibold text-gray-700 mb-2 block">Plan d&apos;abonnement</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(PLAN_CONFIG) as Plan[]).map(p => {
                const cfg = PLAN_CONFIG[p]
                return (
                  <button
                    key={p} type="button"
                    onClick={() => { setCompany(c => ({ ...c, plan: p })); setSelectedModules([]) }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      company.plan === p ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full mb-2" style={{ background: cfg.color }} />
                    <p className="text-[13px] font-bold text-gray-900">{cfg.label}</p>
                    <p className="text-[10px] text-gray-400">{cfg.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={nextStep}
            className="w-full py-3 rounded-xl bg-amber-500 text-white text-[14px] font-bold hover:bg-amber-600 transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Step 2 — Admin user */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <User size={15} className="text-purple-600" />
            </div>
            <h2 className="text-[15px] font-bold text-gray-900">Administrateur principal</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Prénom *</label>
              <input
                value={admin.prenom}
                onChange={e => setAdmin(a => ({ ...a, prenom: e.target.value }))}
                placeholder="Jean"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Nom *</label>
              <input
                value={admin.nom}
                onChange={e => setAdmin(a => ({ ...a, nom: e.target.value }))}
                placeholder="Dupont"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Mail size={11} />Email admin *</label>
            <input
              type="email"
              value={admin.email}
              onChange={e => setAdmin(a => ({ ...a, email: e.target.value }))}
              placeholder="admin@entreprise.com"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Lock size={11} />Mot de passe *</label>
            <input
              type="password"
              value={admin.password}
              onChange={e => setAdmin(a => ({ ...a, password: e.target.value }))}
              placeholder="8 caractères minimum"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Confirmer mot de passe *</label>
            <input
              type="password"
              value={admin.password_confirm}
              onChange={e => setAdmin(a => ({ ...a, password_confirm: e.target.value }))}
              placeholder="Répéter le mot de passe"
              className={`w-full px-3 py-2.5 rounded-xl border text-[13px] outline-none focus:border-amber-400 ${
                admin.password_confirm && admin.password !== admin.password_confirm ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            />
            {admin.password_confirm && admin.password !== admin.password_confirm && (
              <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-[12px] text-blue-700">
              💡 Un email d&apos;invitation sera envoyé à <strong>{admin.email || 'l&apos;adresse saisie'}</strong> avec les identifiants d&apos;accès.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-[14px] font-semibold hover:bg-gray-50 transition-colors">
              ← Retour
            </button>
            <button onClick={nextStep} className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-[14px] font-bold hover:bg-amber-600 transition-colors">
              Suivant →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Modules */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <Package size={15} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">Modules activés</h2>
                <p className="text-[11px] text-gray-400">
                  Plan {PLAN_CONFIG[company.plan].label} — {PLAN_CONFIG[company.plan].desc}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-bold text-amber-700">{selectedModules.length} sélectionné(s)</p>
              <p className="text-[11px] text-gray-400">MRR: {new Intl.NumberFormat('fr-FR').format(mrrEstimate)} FCFA</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(MODULE_LABELS).map(([id, label]) => {
              const selected = selectedModules.includes(id)
              const maxMods = company.plan === 'starter' ? 3 : company.plan === 'business' ? 7 : 99
              const disabled = !selected && selectedModules.length >= maxMods
              return (
                <button
                  key={id} type="button"
                  onClick={() => toggleModule(id)}
                  disabled={disabled}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                    selected   ? 'border-amber-400 bg-amber-50' :
                    disabled   ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed' :
                    'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{MODULE_ICONS[id]}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{label}</p>
                    <p className="text-[10px] text-gray-400">{new Intl.NumberFormat('fr-FR').format(MODULE_PRICES[id] ?? 0)} FCFA/mois</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-[14px] font-semibold hover:bg-gray-50 transition-colors">
              ← Retour
            </button>
            <button onClick={nextStep} className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-[14px] font-bold hover:bg-amber-600 transition-colors">
              Récapitulatif →
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Confirmation */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={15} className="text-green-600" />
            </div>
            <h2 className="text-[15px] font-bold text-gray-900">Récapitulatif & Confirmation</h2>
          </div>

          {/* Company recap */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Entreprise</p>
            </div>
            <div className="p-4 space-y-2">
              {[
                ['Nom',    company.nom_entreprise],
                ['Secteur',company.secteur],
                ['Pays',   company.pays + (company.ville ? `, ${company.ville}` : '')],
                ['Email',  company.email_contact],
                ['Plan',   PLAN_CONFIG[company.plan].label],
                ['Devise', company.devise],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between py-1">
                  <span className="text-[12px] text-gray-500">{l}</span>
                  <span className="text-[13px] font-semibold text-gray-900">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Admin recap */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Administrateur</p>
            </div>
            <div className="p-4 space-y-2">
              {[
                ['Nom complet', `${admin.prenom} ${admin.nom}`],
                ['Email',       admin.email],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between py-1">
                  <span className="text-[12px] text-gray-500">{l}</span>
                  <span className="text-[13px] font-semibold text-gray-900">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Modules recap */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Modules ({selectedModules.length})</p>
              <p className="text-[12px] font-bold text-amber-700">{new Intl.NumberFormat('fr-FR').format(mrrEstimate)} FCFA/mois</p>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {selectedModules.length === 0 && <p className="text-[12px] text-gray-400">Aucun module sélectionné</p>}
              {selectedModules.map(m => (
                <span key={m} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[12px] font-semibold text-amber-700">
                  {MODULE_ICONS[m]} {MODULE_LABELS[m]}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[13px] font-semibold text-amber-900 mb-1">Ce qui va se passer :</p>
            <ul className="space-y-1">
              {[
                '✅ Création du compte tenant dans Supabase',
                '✅ Création du compte admin avec email/mot de passe',
                '✅ Attribution des modules sélectionnés',
                '✅ Envoi des accès par email (si Resend configuré)',
              ].map(s => (
                <li key={s} className="text-[12px] text-amber-800">{s}</li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-[14px] font-semibold hover:bg-gray-50 transition-colors">
              ← Retour
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-2 px-8 py-3 rounded-xl bg-green-500 text-white text-[14px] font-bold hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Création en cours…' : '🚀 Créer l\'entreprise'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
