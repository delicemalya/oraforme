/**
 * lib/erp-core/compute/ebitda.ts
 *
 * Calcul de l'EBITDA et du Résultat Net selon SYSCOHADA révisé.
 * PREMIÈRE IMPLÉMENTATION — inexistant avant l'audit ERP Core.
 *
 * Source : journal_entries (grand livre comptable)
 * Méthode : Compte de résultat SYSCOHADA (classes 6 / 7)
 *
 * EBITDA = Produits d'exploitation (70-75) − Charges d'exploitation (60-65)
 *          (avant dotations aux amortissements classe 68, avant IS)
 *
 * COLONNES réelles journal_entries :
 *   debit_account, credit_account, montant, fiscal_year, tenant_id
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JournalRow {
  debit_account:  string | null
  credit_account: string | null
  montant:        number | null
  fiscal_year:    number | null
}

export interface EBITDASummary {
  year:                    number
  produits_exploitation:   number   // Classe 70-75 SYSCOHADA (crédit)
  charges_exploitation:    number   // Classe 60-65 SYSCOHADA (débit)
  amortissements:          number   // Classe 68 (débit)
  charges_financieres:     number   // Classe 67 (débit)
  produits_financiers:     number   // Classe 77 (crédit)
  ebitda:                  number   // produits - charges avant amort/IS
  ebit:                    number   // ebitda - amortissements
  resultat_avant_is:       number   // ebit + produits financiers - charges financières
  is_estime:               number   // IS estimé selon taux pays
  resultat_net:            number   // résultat_avant_is - is_estime
  marge_ebitda_pct:        number   // ebitda / produits_exploitation * 100
  marge_nette_pct:         number   // resultat_net / produits_exploitation * 100
  has_data:                boolean
}

// ── Sélecteur Supabase ────────────────────────────────────────────────────────

export const JOURNAL_SELECT = 'debit_account, credit_account, montant, fiscal_year' as const

// ── Fonction principale ───────────────────────────────────────────────────────

/**
 * Calcule l'EBITDA et le résultat net depuis les écritures du grand livre.
 *
 * @param entries  - journal_entries filtrés par tenant (pas besoin de filtrer par year ici)
 * @param year     - exercice fiscal
 * @param tauxIS   - taux IS (défaut 28% Congo — passer le taux réel du pays)
 */
export function computeEBITDA(
  entries: JournalRow[],
  year:    number,
  tauxIS   = 0.28,
): EBITDASummary {
  const yr = entries.filter(e => e.fiscal_year === year)

  const sumD = (prefix: string) =>
    yr.filter(e => e.debit_account?.startsWith(prefix)).reduce((s, e) => s + (e.montant ?? 0), 0)
  const sumC = (prefix: string) =>
    yr.filter(e => e.credit_account?.startsWith(prefix)).reduce((s, e) => s + (e.montant ?? 0), 0)

  // Produits d'exploitation (classe 7 hors 77)
  const produits_exploitation =
    sumC('70') + sumC('71') + sumC('72') + sumC('73') + sumC('74') + sumC('75')

  // Charges d'exploitation (classe 6 hors 67-68)
  const charges_exploitation =
    sumD('60') + sumD('61') + sumD('62') + sumD('63') + sumD('64') + sumD('65') + sumD('66')

  const amortissements     = sumD('68')
  const charges_financieres = sumD('67')
  const produits_financiers = sumC('77')

  const ebitda             = produits_exploitation - charges_exploitation
  const ebit               = ebitda - amortissements
  const resultat_avant_is  = ebit + produits_financiers - charges_financieres
  const is_estime          = Math.max(0, Math.round(resultat_avant_is * tauxIS))
  const resultat_net       = resultat_avant_is - is_estime

  const marge_ebitda_pct   = produits_exploitation > 0
    ? Math.round((ebitda / produits_exploitation) * 100) : 0
  const marge_nette_pct    = produits_exploitation > 0
    ? Math.round((resultat_net / produits_exploitation) * 100) : 0

  return {
    year, produits_exploitation, charges_exploitation,
    amortissements, charges_financieres, produits_financiers,
    ebitda, ebit, resultat_avant_is, is_estime, resultat_net,
    marge_ebitda_pct, marge_nette_pct,
    has_data: yr.length > 0,
  }
}
