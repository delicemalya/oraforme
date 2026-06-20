'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import {
  PRIMES_CATALOGUE,
  CATEGORIES_PRIMES,
  type PrimeEmploye,
} from './types'
import type { CountryConfig } from '@/lib/countries/types'

interface PrimesLibraryProps {
  primes:    PrimeEmploye[]
  onChange:  (primes: PrimeEmploye[]) => void
  cfg:       CountryConfig
  plan:      'tpe' | 'pme' | 'grande'
}

function genId() {
  return Math.random().toString(36).slice(2)
}

const PERIODICITES: { value: PrimeEmploye['periodicite']; label: string }[] = [
  { value: 'mensuel',      label: 'Mensuel'      },
  { value: 'trimestriel',  label: 'Trimestriel'  },
  { value: 'annuel',       label: 'Annuel'       },
  { value: 'ponctuel',     label: 'Ponctuel'     },
]

const TYPES: { value: PrimeEmploye['type']; label: string }[] = [
  { value: 'fixe',      label: 'Montant fixe'     },
  { value: 'pct_brut',  label: '% salaire brut'   },
  { value: 'pct_base',  label: '% salaire de base' },
]

const MAX_PRIMES: Record<string, number> = { tpe: 4, pme: 23, grande: 999 }

export function PrimesLibrary({ primes, onChange, cfg, plan }: PrimesLibraryProps) {
  const [openCat, setOpenCat] = useState<string | null>('rh')
  const maxPrimes = MAX_PRIMES[plan] ?? 23

  function isActive(code: string) {
    return primes.some(p => p.code === code)
  }

  function toggle(code: string) {
    if (isActive(code)) {
      onChange(primes.filter(p => p.code !== code))
    } else if (primes.length < maxPrimes) {
      const template = PRIMES_CATALOGUE.find(p => p.code === code)!
      // Read taxability from CountryConfig exonerations when available
      const exo = (cfg as any).exonerations
      let imposable = template.imposable
      let soumis_cnss = template.soumis_cnss
      if (exo && code === 'transport' && exo.transport?.actif) {
        imposable = false; soumis_cnss = false
      }
      if (exo && code === 'logement' && exo.logement?.actif) {
        imposable = false; soumis_cnss = false
      }
      onChange([...primes, { ...template, montant: 0, imposable, soumis_cnss }])
    }
  }

  function updatePrime(id: string, field: keyof PrimeEmploye, value: unknown) {
    onChange(primes.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function removePrime(id: string) {
    onChange(primes.filter(p => p.id !== id))
  }

  function addCustom() {
    if (primes.length >= maxPrimes) return
    onChange([...primes, {
      id:               genId(),
      code:             `custom_${genId()}`,
      nom:              '',
      categorie:        'personnalise',
      montant:          0,
      type:             'fixe',
      periodicite:      'mensuel',
      imposable:        true,
      soumis_cnss:      true,
      soumis_irpp:      true,
      conventionnelle:  false,
    }])
  }

  // Primes with id (active)
  const activeWithId = primes.map(p => p.id ? p : { ...p, id: genId() })

  const catsByPlan = plan === 'tpe'
    ? CATEGORIES_PRIMES.filter(c => ['rh', 'logistique', 'social'].includes(c.code))
    : CATEGORIES_PRIMES

  return (
    <div className="space-y-6">
      {/* ─── Primes actives ──────────────────────────────────────────────── */}
      {activeWithId.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">
            Primes sélectionnées ({activeWithId.length}/{maxPrimes === 999 ? '∞' : maxPrimes})
          </h4>
          <div className="space-y-2">
            {activeWithId.map(prime => (
              <div key={prime.id} className="border border-slate-200 rounded-xl p-3 space-y-3 bg-white">
                <div className="flex items-start gap-3">
                  {prime.categorie === 'personnalise' ? (
                    <input
                      className="input flex-1 text-sm font-medium"
                      placeholder="Nom de la prime"
                      value={prime.nom}
                      onChange={e => updatePrime(prime.id!, 'nom', e.target.value)}
                    />
                  ) : (
                    <p className="flex-1 text-sm font-medium text-slate-700 pt-2">{prime.nom}</p>
                  )}
                  <button
                    onClick={() => removePrime(prime.id!)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Montant ({cfg.devise})</label>
                    <input
                      type="number"
                      className="input text-sm w-full"
                      placeholder="0"
                      value={prime.montant || ''}
                      onChange={e => updatePrime(prime.id!, 'montant', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Type</label>
                    <select
                      className="input text-sm w-full"
                      value={prime.type}
                      onChange={e => updatePrime(prime.id!, 'type', e.target.value)}
                    >
                      {TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Périodicité</label>
                    <select
                      className="input text-sm w-full"
                      value={prime.periodicite}
                      onChange={e => updatePrime(prime.id!, 'periodicite', e.target.value)}
                    >
                      {PERIODICITES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prime.imposable}
                        onChange={e => updatePrime(prime.id!, 'imposable', e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      Imposable
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prime.soumis_cnss}
                        onChange={e => updatePrime(prime.id!, 'soumis_cnss', e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      {cfg.cnss.acronyme}
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Catalogue par catégorie ──────────────────────────────────────── */}
      {primes.length < maxPrimes && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Ajouter depuis le catalogue</h4>
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {catsByPlan.map(cat => {
              const catPrimes = PRIMES_CATALOGUE.filter(p => p.categorie === cat.code)
              const isOpen    = openCat === cat.code
              return (
                <div key={cat.code}>
                  <button
                    onClick={() => setOpenCat(isOpen ? null : cat.code)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-sm"
                  >
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span>{cat.emoji}</span>
                      {cat.label}
                      <span className="text-xs text-slate-400 font-normal">({catPrimes.length})</span>
                    </span>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />
                    }
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-2">
                      {catPrimes.map(prime => {
                        const active = isActive(prime.code)
                        return (
                          <button
                            key={prime.code}
                            onClick={() => toggle(prime.code)}
                            disabled={active || primes.length >= maxPrimes}
                            className={[
                              'flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-all',
                              active
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 cursor-default'
                                : 'hover:bg-slate-50 text-slate-600 border border-transparent hover:border-slate-200',
                            ].join(' ')}
                          >
                            <span>{prime.nom}</span>
                            <span className="text-xs text-slate-400">
                              {active ? '✓' : prime.imposable ? 'Impos.' : 'Exo.'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Prime personnalisée ─────────────────────────────────────────── */}
      {plan !== 'tpe' && primes.length < maxPrimes && (
        <button
          onClick={addCustom}
          className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Ajouter une prime personnalisée
        </button>
      )}

      {primes.length >= maxPrimes && maxPrimes !== 999 && (
        <p className="text-xs text-slate-400 text-center py-2">
          Limite {maxPrimes} primes atteinte pour votre plan. Passez à un plan supérieur pour plus.
        </p>
      )}
    </div>
  )
}
