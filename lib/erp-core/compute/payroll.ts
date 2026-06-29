/**
 * lib/erp-core/compute/payroll.ts
 *
 * UNIQUE source de vérité pour le calcul de la masse salariale.
 * Remplace les 8 versions disparates identifiées dans l'audit ERP Core.
 *
 * RÈGLES :
 *  - Filtre TOUJOURS par (annee === year)
 *  - Filtre optionnellement par (mois === month)
 *  - Utilise les colonnes réelles de bulletins_paie : brut, net, cnss_salarie, cnss_patronal, irpp, mois, annee
 *  - Aucun fallback silencieux sur salaire_base — si pas de bulletins, retourne 0 explicitement
 *  - Fonctions pures : 0 effet de bord, 0 appel DB
 *
 * COLONNES réelles de bulletins_paie (confirmées migration 095) :
 *   id, tenant_id, employe_id, mois INT, annee INT, brut, net,
 *   cnss_salarie, cnss_patronal, irpp, primes, heures_sup, taux_horaire,
 *   mode_paiement, statut ('generee'|'payee'|'annulee'), created_at
 */

import { MONTH_LABELS_FR } from '@/lib/erp-core/filters/context'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BulletinRow {
  mois:          number
  annee:         number
  brut:          number | null
  net:           number | null
  cnss_salarie:  number | null
  cnss_patronal: number | null
  irpp:          number | null
  statut:        string | null
  employe_id?:   string
}

export interface PayrollMonthPoint {
  month:    string   // 'Jan', 'Fév', ...
  mois:     number   // 1-12
  brut:     number
  net:      number
  cnss:     number   // salarie + patronal
  irpp:     number
  effectif: number   // bulletins ce mois
}

export interface PayrollSummary {
  year:           number
  month:          number | null     // null = annuel
  brut:           number            // masse salariale brute
  net:            number            // masse salariale nette
  charges:        number            // charges totales employeur (cnss_patronal + irpp)
  cnss_salarie:   number
  cnss_patronal:  number
  irpp:           number
  effectif:       number            // nombre de bulletins traités
  cout_employeur: number            // brut + cnss_patronal (coût réel employeur)
  has_data:       boolean           // false si aucun bulletin trouvé
  mensuel:        PayrollMonthPoint[]
}

// ── Fonction principale ───────────────────────────────────────────────────────

/**
 * Calcule le résumé de paie à partir d'un tableau de bulletins déjà chargés.
 * La requête DB doit avoir été faite avec .eq('annee', year) en amont.
 *
 * @param bulletins  - Résultat de la requête bulletins_paie (filtrée par tenant + annee)
 * @param year       - Exercice fiscal (pour validation + métadonnée)
 * @param month      - Si fourni, filtre en plus sur mois === month
 */
export function computePayrollSummary(
  bulletins: BulletinRow[],
  year:      number,
  month:     number | null = null,
): PayrollSummary {
  // Double protection : le filtre annee doit être appliqué en DB,
  // on re-vérifie ici pour garantir l'intégrité même si la requête échoue
  const scoped = bulletins.filter(b => {
    if (b.annee !== year) return false
    if (month !== null && b.mois !== month) return false
    return true
  })

  const brut          = sum(scoped, 'brut')
  const net           = sum(scoped, 'net')
  const cnss_salarie  = sum(scoped, 'cnss_salarie')
  const cnss_patronal = sum(scoped, 'cnss_patronal')
  const irpp          = sum(scoped, 'irpp')
  const charges       = cnss_patronal + irpp
  const cout_employeur = brut + cnss_patronal
  const effectif      = scoped.length

  const mensuel: PayrollMonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const moisNum = i + 1
    const mb = scoped.filter(b => b.mois === moisNum)
    return {
      month:    MONTH_LABELS_FR[i],
      mois:     moisNum,
      brut:     sum(mb, 'brut'),
      net:      sum(mb, 'net'),
      cnss:     sum(mb, 'cnss_salarie') + sum(mb, 'cnss_patronal'),
      irpp:     sum(mb, 'irpp'),
      effectif: mb.length,
    }
  })

  return {
    year, month, brut, net, charges,
    cnss_salarie, cnss_patronal, irpp,
    effectif, cout_employeur,
    has_data: effectif > 0,
    mensuel,
  }
}

// ── Sélecteur Supabase ────────────────────────────────────────────────────────

/** Colonnes à passer à .select() pour charger les bulletins ERP Core */
export const BULLETIN_SELECT = 'mois, annee, brut, net, cnss_salarie, cnss_patronal, irpp, statut, employe_id' as const

// ── Helper privé ──────────────────────────────────────────────────────────────

function sum(rows: BulletinRow[], key: keyof BulletinRow): number {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}
