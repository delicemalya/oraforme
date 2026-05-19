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
            <img src="/logo.svg" alt="oraforme" className="w-8 h-8" />
            <span className="text-xl font-bold text-[#E6EDF3]">oraforme</span>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 text-xs ${
                  i === step ? 'text-[#F0A30A]' : i < step ? 'text-[#8B949E]' : 'text-[#484F58]'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${
                    i < step   ? 'bg-[#F0A30A] border-[#F0A30A] text-[#0D1117]' :
                    i === step ? 'border-[#F0A30A] text-[#F0A30A]'              :
                                 'border-[#30363D] text-[#484F58]'
                  }`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="hidden sm:inline">{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-5 h-px ${i < step ? 'bg-[#F0A30A]' : 'bg-[#30363D]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-8">

          {/* ── ÉTAPE 0 : Secteur ─────────────────────────────── */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[#E6EDF3] mb-1">Votre secteur d&apos;activité</h2>
              <p className="text-sm text-[#8B949E] mb-6">
                Oraforme configure automatiquement les modules adaptés à votre métier.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(SECTOR_CONFIG).map(([id, cfg]) => (
                  <button
                    key={id}
                    onClick={() => setSecteurId(id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                      secteurId === id
                        ? 'border-[#F0A30A] bg-[#F0A30A]/5 shadow-[0_0_0_1px_#F0A30A33]'
                        : 'border-[#30363D] bg-[#21262D] hover:border-[#484F58]'
                    }`}
                  >
                    <span className="text-2xl">{cfg.emoji}</span>
                    <span className="text-xs font-medium text-[#E6EDF3] leading-tight">{cfg.label}</span>
                    {secteurId === id && (
                      <span className="text-xs text-[#F0A30A]">{cfg.uiModules.length} modules</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Module preview */}
              {secteurCfg && uiModules.length > 0 && (
                <div className="mt-4 p-3 bg-[#F0A30A]/5 border border-[#F0A30A]/20 rounded-lg">
                  <p className="text-xs text-[#F0A30A] font-medium mb-2">
                    Modules inclus par défaut pour {secteurCfg.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {uiModules.map((m, i) => (
                      <span key={i} className="text-xs bg-[#21262D] text-[#8B949E] px-2 py-0.5 rounded-full">
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
              <h2 className="text-lg font-semibold text-[#E6EDF3] mb-1">Votre entreprise</h2>
              <p className="text-sm text-[#8B949E] mb-6">Ces informations apparaîtront sur vos documents officiels.</p>
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
                  <label className="text-sm font-medium text-[#8B949E]">Pays</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-lg bg-[#21262D] border border-[#30363D] text-[#E6EDF3] text-sm focus:outline-none focus:border-[#F0A30A]"
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
              <h2 className="text-lg font-semibold text-[#E6EDF3] mb-1">Choisissez vos modules</h2>
              <p className="text-sm text-[#8B949E] mb-5">
                Les modules recommandés pour votre secteur sont déjà sélectionnés.
                Ajoutez ou retirez librement selon vos besoins.
              </p>

              {/* Modules recommandés */}
              {secteurCfg && (
                <div className="mb-4">
                  <p className="text-xs text-[#F0A30A] font-medium uppercase tracking-wider mb-2">
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
                              ? 'border-[#F0A30A] bg-[#F0A30A]/8'
                              : 'border-[#30363D] bg-[#21262D] hover:border-[#484F58]'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                            selected
                              ? 'bg-[#F0A30A] border-[#F0A30A]'
                              : 'border-[#484F58]'
                          }`}>
                            {selected && <Check size={10} className="text-[#0D1117]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[#E6EDF3] truncate">
                              {m.emoji} {m.label}
                            </div>
                            <div className="text-[10px] text-[#484F58]">
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
                    <p className="text-xs text-[#8B949E] font-medium uppercase tracking-wider mb-2">
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
                                : 'border-[#21262D] bg-[#0D1117] hover:border-[#30363D]'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                              selected
                                ? 'bg-[#2EA043] border-[#2EA043]'
                                : 'border-[#30363D]'
                            }`}>
                              {selected ? <Check size={10} className="text-[#0D1117]" /> : <Plus size={9} className="text-[#484F58]" />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-[#8B949E] truncate">
                                {m.emoji} {m.label}
                              </div>
                              <div className="text-[10px] text-[#484F58]">
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
              <div className="mt-4 p-3 bg-[#21262D] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#8B949E]">
                    {selectedMods.length} module{selectedMods.length !== 1 ? 's' : ''} sélectionné{selectedMods.length !== 1 ? 's' : ''}
                  </span>
                  {selectedMods.length === 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-[#F01F38] mt-0.5">
                      <X size={9} /> Sélectionnez au moins un module
                    </div>
                  )}
                </div>
                <span className="text-base font-bold text-[#F0A30A]">
                  {totalMensuel.toLocaleString()} F<span className="text-xs font-normal text-[#8B949E]">/mois</span>
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
              <h2 className="text-lg font-semibold text-[#E6EDF3] mb-1">Confirmation</h2>
              <p className="text-sm text-[#8B949E] mb-6">Vérifiez vos informations avant de démarrer.</p>

              <div className="space-y-3">
                <div className="p-4 bg-[#21262D] rounded-xl">
                  <p className="text-xs text-[#8B949E] uppercase tracking-wider mb-2">Secteur</p>
                  <p className="text-sm font-medium text-[#E6EDF3]">
                    {secteurCfg?.emoji} {secteurCfg?.label}
                  </p>
                  {secteurCfg?.description && (
                    <p className="text-xs text-[#484F58] mt-0.5">{secteurCfg.description}</p>
                  )}
                </div>

                <div className="p-4 bg-[#21262D] rounded-xl">
                  <p className="text-xs text-[#8B949E] uppercase tracking-wider mb-2">Entreprise</p>
                  <p className="text-sm font-semibold text-[#E6EDF3]">{entreprise.nom}</p>
                  {entreprise.nif && (
                    <p className="text-xs text-[#8B949E] mt-0.5">NIF : {entreprise.nif}</p>
                  )}
                  <p className="text-xs text-[#8B949E]">
                    {entreprise.ville && `${entreprise.ville}, `}{entreprise.pays}
                  </p>
                </div>

                <div className="p-4 bg-[#21262D] rounded-xl">
                  <p className="text-xs text-[#8B949E] uppercase tracking-wider mb-2">
                    Modules activés ({selectedMods.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMods.map(key => {
                      const m = MODULE_META[key]
                      return m ? (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 text-xs bg-[#F0A30A]/10 text-[#F0A30A] border border-[#F0A30A]/20 rounded-full px-2.5 py-1"
                        >
                          {m.emoji} {m.label}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>

                <div className="p-4 bg-[#21262D] rounded-xl flex items-center justify-between">
                  <span className="text-sm text-[#8B949E]">Total mensuel estimé</span>
                  <span className="text-xl font-bold text-[#F0A30A]">
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
