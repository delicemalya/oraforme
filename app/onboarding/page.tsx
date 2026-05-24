'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createTenantAndProfile } from './actions'
import { supabase } from '@/lib/supabase'
import { SECTOR_CONFIG, MODULE_META } from '@/lib/modules'

// All purchasable modules (displayed in the module picker)
const ALL_MODULE_KEYS = Object.keys(MODULE_META)

const STEPS = ['Secteur', 'Entreprise', 'Modules', 'Confirmation']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]               = useState(0)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [secteurId, setSecteurId]     = useState('')
  const [selectedMods, setSelectedMods] = useState<string[]>([])
  const [entreprise, setEntreprise]   = useState({
    nom: '', nif: '', pays: 'Congo (Brazzaville)', ville: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login')
    })
  }, [router])

  // Reset modules when sector changes
  useEffect(() => {
    if (secteurId && SECTOR_CONFIG[secteurId]) {
      setSelectedMods(SECTOR_CONFIG[secteurId].dbModules)
    }
  }, [secteurId])

  const secteurCfg  = secteurId ? SECTOR_CONFIG[secteurId] : null
  const uiModules   = secteurCfg?.uiModules ?? []
  const totalMensuel = selectedMods.reduce((s, k) => s + (MODULE_META[k]?.prix ?? 0), 0)

  function toggleMod(key: string) {
    setSelectedMods(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  async function handleFinish() {
    setLoading(true)
    setError('')
    const result = await createTenantAndProfile({
      nomEntreprise:    entreprise.nom,
      nif:              entreprise.nif,
      secteurActivite:  secteurId,
      customModules:    selectedMods,
    })
    if (result.error) { setError(result.error); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Logo + stepper */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="oraforme" className="w-8 h-8" />
            <span className="text-xl font-bold text-[var(--text)]">oraforme</span>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 text-xs ${
                  i === step ? 'text-[#DC2626]' : i < step ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${
                    i < step   ? 'bg-[#DC2626] border-[#DC2626] text-[#DC2626]' :
                    i === step ? 'border-[#DC2626] text-[#DC2626]'              :
                                 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="hidden sm:inline">{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-5 h-px ${i < step ? 'bg-[#DC2626]' : 'bg-[#30363D]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-8">

          {/* ── ÉTAPE 0 : Secteur ─────────────────────────────── */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)] mb-1">Votre secteur d&apos;activité</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Oraforme configure automatiquement les modules adaptés à votre métier.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(SECTOR_CONFIG).map(([id, cfg]) => (
                  <button
                    key={id}
                    onClick={() => setSecteurId(id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                      secteurId === id
                        ? 'border-[#DC2626] bg-[#DC2626]/5 shadow-[0_0_0_1px_#DC262633]'
                        : 'border-[var(--border)] bg-[var(--surface-alt)] hover:border-[#64748B]'
                    }`}
                  >
                    <span className="text-2xl">{cfg.emoji}</span>
                    <span className="text-xs font-medium text-[var(--text)] leading-tight">{cfg.label}</span>
                    {secteurId === id && (
                      <span className="text-xs text-[#DC2626]">{cfg.uiModules.length} modules</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Module preview */}
              {secteurCfg && uiModules.length > 0 && (
                <div className="mt-4 p-3 bg-[#DC2626]/5 border border-[#DC2626]/20 rounded-lg">
                  <p className="text-xs text-[#DC2626] font-medium mb-2">
                    Modules inclus par défaut pour {secteurCfg.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {uiModules.map((m, i) => (
                      <span key={i} className="text-xs bg-[var(--surface-alt)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">
                        {m.emoji} {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <Button onClick={() => setStep(1)} disabled={!secteurId}>
                  Continuer →
                </Button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 1 : Entreprise ──────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)] mb-1">Votre entreprise</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Ces informations apparaîtront sur vos documents officiels.</p>
              <div className="flex flex-col gap-4">
                <Input
                  label="Nom de l'entreprise *"
                  placeholder="Ma Société SARL"
                  value={entreprise.nom}
                  onChange={e => setEntreprise(p => ({ ...p, nom: e.target.value }))}
                />
                <Input
                  label="NIF / Numéro fiscal"
                  placeholder="123456789"
                  value={entreprise.nif}
                  onChange={e => setEntreprise(p => ({ ...p, nif: e.target.value }))}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Pays</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[#DC2626]"
                    value={entreprise.pays}
                    onChange={e => setEntreprise(p => ({ ...p, pays: e.target.value }))}
                  >
                    {['Congo (Brazzaville)', 'Congo (Kinshasa)', 'Gabon', 'Cameroun', "Côte d'Ivoire", 'Sénégal', 'France', 'Autre'].map(p => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Ville"
                  placeholder="Brazzaville"
                  value={entreprise.ville}
                  onChange={e => setEntreprise(p => ({ ...p, ville: e.target.value }))}
                />
              </div>
              <div className="flex justify-between mt-6">
                <Button variant="secondary" onClick={() => setStep(0)}>← Retour</Button>
                <Button onClick={() => setStep(2)} disabled={!entreprise.nom}>Continuer →</Button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : Modules ─────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)] mb-1">Choisissez vos modules</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-5">
                Les modules recommandés pour votre secteur sont déjà sélectionnés.
                Ajoutez ou retirez librement selon vos besoins.
              </p>

              {/* Modules recommandés */}
              {secteurCfg && (
                <div className="mb-4">
                  <p className="text-xs text-[#DC2626] font-medium uppercase tracking-wider mb-2">
                    ✦ Recommandés pour {secteurCfg.label}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {secteurCfg.dbModules.map(key => {
                      const m = MODULE_META[key]
                      if (!m) return null
                      const selected = selectedMods.includes(key)
                      return (
                        <button
                          key={key}
                          onClick={() => toggleMod(key)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                            selected
                              ? 'border-[#DC2626] bg-[#DC2626]/8'
                              : 'border-[var(--border)] bg-[var(--surface-alt)] hover:border-[#64748B]'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                            selected
                              ? 'bg-[#DC2626] border-[#DC2626]'
                              : 'border-[#64748B]'
                          }`}>
                            {selected && <Check size={10} className="text-[#DC2626]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[var(--text)] truncate">
                              {m.emoji} {m.label}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)]">
                              {m.prix.toLocaleString()} F/mois
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Modules supplémentaires */}
              {(() => {
                const extras = ALL_MODULE_KEYS.filter(k => !secteurCfg?.dbModules.includes(k))
                if (extras.length === 0) return null
                return (
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider mb-2">
                      + Modules supplémentaires disponibles
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {extras.map(key => {
                        const m = MODULE_META[key]
                        if (!m) return null
                        const selected = selectedMods.includes(key)
                        return (
                          <button
                            key={key}
                            onClick={() => toggleMod(key)}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                              selected
                                ? 'border-[#2EA043] bg-[#2EA043]/8'
                                : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border)]'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                              selected
                                ? 'bg-[#2EA043] border-[#2EA043]'
                                : 'border-[var(--border)]'
                            }`}>
                              {selected ? <Check size={10} className="text-[#DC2626]" /> : <Plus size={9} className="text-[var(--text-secondary)]" />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-[var(--text-secondary)] truncate">
                                {m.emoji} {m.label}
                              </div>
                              <div className="text-[10px] text-[var(--text-secondary)]">
                                {m.prix.toLocaleString()} F/mois
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Total + modules sélectionnés */}
              <div className="mt-4 p-3 bg-[var(--surface-alt)] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {selectedMods.length} module{selectedMods.length !== 1 ? 's' : ''} sélectionné{selectedMods.length !== 1 ? 's' : ''}
                  </span>
                  {selectedMods.length === 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-[#DC2626] mt-0.5">
                      <X size={9} /> Sélectionnez au moins un module
                    </div>
                  )}
                </div>
                <span className="text-base font-bold text-[#DC2626]">
                  {totalMensuel.toLocaleString()} F<span className="text-xs font-normal text-[var(--text-secondary)]">/mois</span>
                </span>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="secondary" onClick={() => setStep(1)}>← Retour</Button>
                <Button onClick={() => setStep(3)} disabled={selectedMods.length === 0}>Continuer →</Button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 : Confirmation ────────────────────────── */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)] mb-1">Confirmation</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Vérifiez vos informations avant de démarrer.</p>

              <div className="space-y-3">
                <div className="p-4 bg-[var(--surface-alt)] rounded-xl">
                  <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Secteur</p>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {secteurCfg?.emoji} {secteurCfg?.label}
                  </p>
                  {secteurCfg?.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{secteurCfg.description}</p>
                  )}
                </div>

                <div className="p-4 bg-[var(--surface-alt)] rounded-xl">
                  <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Entreprise</p>
                  <p className="text-sm font-semibold text-[var(--text)]">{entreprise.nom}</p>
                  {entreprise.nif && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">NIF : {entreprise.nif}</p>
                  )}
                  <p className="text-xs text-[var(--text-secondary)]">
                    {entreprise.ville && `${entreprise.ville}, `}{entreprise.pays}
                  </p>
                </div>

                <div className="p-4 bg-[var(--surface-alt)] rounded-xl">
                  <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                    Modules activés ({selectedMods.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMods.map(key => {
                      const m = MODULE_META[key]
                      return m ? (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 text-xs bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20 rounded-full px-2.5 py-1"
                        >
                          {m.emoji} {m.label}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>

                <div className="p-4 bg-[var(--surface-alt)] rounded-xl flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Total mensuel estimé</span>
                  <span className="text-xl font-bold text-[#DC2626]">
                    {totalMensuel.toLocaleString()} <span className="text-sm font-normal">FCFA</span>
                  </span>
                </div>
              </div>

              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex justify-between mt-6">
                <Button variant="secondary" onClick={() => setStep(2)}>← Retour</Button>
                <Button onClick={handleFinish} loading={loading}>Accéder au dashboard →</Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
