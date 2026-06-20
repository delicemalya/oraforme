'use client'

import { useMemo } from 'react'
import { TrendingUp, User, Building2 } from 'lucide-react'
import { getCountryConfig } from '@/lib/countries'
import { calculerIRPP, calculerChargesSociales } from '@/lib/fiscal/universal-tax-engine'
import type { CodePays } from '@/lib/countries/types'
import type { PrimeEmploye } from './types'

interface LivePayPreviewProps {
  codePays:     CodePays
  salaire_base: number
  situation:    'celibataire' | 'marie'
  nb_enfants:   number
  primes:       PrimeEmploye[]
}

function fmt(n: number, devise: string) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise
}

export function LivePayPreview({ codePays, salaire_base, situation, nb_enfants, primes }: LivePayPreviewProps) {
  const cfg = useMemo(() => getCountryConfig(codePays), [codePays])

  const calcul = useMemo(() => {
    if (!salaire_base || salaire_base <= 0) return null
    try {
      const primesImposables    = primes.filter(p => p.imposable && p.montant > 0).reduce((s, p) => s + p.montant, 0)
      const primesNonImposables = primes.filter(p => !p.imposable && p.montant > 0).reduce((s, p) => s + p.montant, 0)
      const brut                = salaire_base + primesImposables + primesNonImposables

      const cnssRes = calculerChargesSociales({ codePays, salaireBrut: salaire_base + primesImposables })
      const irppRes = calculerIRPP({
        codePays,
        salaireBrut:   salaire_base + primesImposables - cnssRes.total_salarie,
        situation,
        nombreEnfants: nb_enfants,
      })

      const net           = brut - cnssRes.total_salarie - irppRes.irpp_net
      const coutEmployeur = salaire_base + primesImposables + cnssRes.total_patronal_net

      return {
        salaire_base,
        primesImposables,
        primesNonImposables,
        brut,
        cnss_salarie:  cnssRes.total_salarie,
        cnss_patronal: cnssRes.total_patronal_net,
        irpp:          irppRes.irpp_net,
        net,
        coutEmployeur,
      }
    } catch {
      return null
    }
  }, [codePays, salaire_base, situation, nb_enfants, primes])

  if (!salaire_base || salaire_base <= 0) {
    return (
      <div className="w-72">
        <div className="card p-4 text-center text-slate-400 text-sm">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Saisissez un salaire pour voir l&apos;aperçu paie
        </div>
      </div>
    )
  }

  return (
    <div className="w-72">
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">
          <TrendingUp className="w-4 h-4 text-amber-500" />
          Aperçu Paie Live
        </div>

        {calcul ? (
          <div className="space-y-1.5 text-sm">
            {[
              { label: 'Salaire de base',   val: calcul.salaire_base,        color: '' },
              { label: 'Primes taxables',   val: calcul.primesImposables,   color: calcul.primesImposables > 0 ? '' : 'text-slate-300' },
              { label: 'Primes exonérées',  val: calcul.primesNonImposables, color: 'text-green-600' },
              { label: 'Salaire brut',      val: calcul.brut,               color: 'font-semibold text-slate-700', sep: true },
              { label: `${cfg.cnss.acronyme} salarié`, val: -calcul.cnss_salarie, color: 'text-red-500' },
              { label: 'IRPP',              val: -calcul.irpp,              color: 'text-red-500' },
              { label: 'Net à payer',       val: calcul.net,                color: 'font-bold text-green-700 text-base', sep: true },
              { label: 'Coût employeur',    val: calcul.coutEmployeur,      color: 'text-slate-500 text-xs' },
            ].map((row, i) => (
              <div key={i}>
                {'sep' in row && row.sep && <div className="border-t border-slate-100 my-2" />}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{row.label}</span>
                  <span className={['font-mono', row.color].join(' ')}>
                    {row.val < 0 ? '− ' : ''}{fmt(Math.abs(row.val), cfg.devise)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-2">
            Calcul indisponible pour {cfg.nom_pays}
          </p>
        )}

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-amber-700">
            <User className="w-3 h-3" />
            {cfg.nom_pays} · {cfg.devise}
          </div>
          <div className="flex items-center gap-1.5 text-amber-600">
            <Building2 className="w-3 h-3" />
            {cfg.cnss.nom} — {cfg.data_confidence === 'verified' ? '✓ Vérifié' : 'À confirmer'}
          </div>
        </div>
      </div>
    </div>
  )
}
