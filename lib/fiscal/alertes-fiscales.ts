// Dynamic fiscal alerts — country-aware, delegates to lib/fiscalite/engine.ts

import { calculerEcheancier } from '@/lib/fiscalite/engine'
import { PAYS_CONFIGS } from '@/lib/fiscalite/pays'
import type { PaysFiscal } from '@/lib/fiscalite/types'

export interface EcheanceFiscale {
  id:            string
  nom:           string
  description:   string
  base:          string
  recurrence:    'mensuelle' | 'annuelle'
  dateLimite:    Date
  joursRestants: number
  urgence:       'rouge' | 'orange' | 'normal'
}

const TYPE_NOMS: Partial<Record<string, string>> = {
  tva:     'Déclaration TVA',
  irpp:    'Retenues salariales (IRPP)',
  is:      'Impôt sur les Sociétés',
  patente: 'Patente / Droit de Patente',
  tvts:    'Taxe sur Véhicules de Tourisme',
  autre:   'Déclaration fiscale',
}

const MENSUEL_TYPES = new Set(['tva', 'cnss'])

/**
 * Retourne les échéances fiscales pour les N prochains jours.
 * @param joursMax  Horizon en jours (défaut 30)
 * @param pays      Code pays ISO — détecté automatiquement depuis PaysContext
 */
export function getEcheances(joursMax = 30, pays = 'CG'): EcheanceFiscale[] {
  const validPays: PaysFiscal = (pays in PAYS_CONFIGS) ? pays as PaysFiscal : 'CG'
  const cfg = PAYS_CONFIGS[validPays]
  const annee = new Date().getFullYear()

  // Current + next year so December échéances (due January) are included
  const raw = [
    ...calculerEcheancier(validPays, annee),
    ...calculerEcheancier(validPays, annee + 1),
  ]

  const seen = new Set<string>()

  return raw
    .filter(e => e.jours_restants >= 0 && e.jours_restants <= joursMax)
    .map(e => {
      const id = `${e.type}_${e.date_echeance}`
      const nom = e.type === 'cnss'
        ? `Cotisations ${cfg.cnss.acronyme}`
        : (TYPE_NOMS[e.type] ?? TYPE_NOMS['autre']!)

      const urgence: EcheanceFiscale['urgence'] =
        e.statut === 'urgent' || e.statut === 'retard' ? 'rouge' :
        e.jours_restants <= 30 ? 'orange' : 'normal'

      return {
        id,
        nom,
        description:   e.label,
        base:          `${cfg.nom} — ${cfg.systeme_comptable}`,
        recurrence:    (MENSUEL_TYPES.has(e.type) ? 'mensuelle' : 'annuelle') as 'mensuelle' | 'annuelle',
        dateLimite:    new Date(e.date_echeance),
        joursRestants: e.jours_restants,
        urgence,
      }
    })
    .filter(e => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    .sort((a, b) => a.dateLimite.getTime() - b.dateLimite.getTime())
}
