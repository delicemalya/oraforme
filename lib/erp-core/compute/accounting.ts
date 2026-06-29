/**
 * lib/erp-core/compute/accounting.ts
 *
 * UNIQUE source de vérité pour les calculs comptables SYSCOHADA.
 * Remplace la logique inline dans :
 *   - app/api/comptabilite/balance/route.ts
 *   - app/api/comptabilite/grand-livre/route.ts
 *   - app/api/miaa/compliance/route.ts
 *
 * Référentiel : SYSCOHADA révisé 2017 (AUDCIF, Art. 8)
 * Classes 1-5 = Bilan | Classes 6-8 = Compte de résultat
 *
 * COLONNES réelles journal_entries :
 *   id, tenant_id, debit_account, credit_account, montant,
 *   date_operation, libelle, fiscal_year, reference, source, journal_type
 */

import { COMPTES_PLATS, type CompteFlat } from '@/lib/syscohada/plan-comptable'

// ── Types entrée ──────────────────────────────────────────────────────────────

export interface JournalLedgerRow {
  id:             string
  debit_account:  string | null
  credit_account: string | null
  montant:        number | null
  date_operation: string | null
  libelle?:       string | null
  reference?:     string | null
  source?:        string | null
  journal_type?:  string | null
}

// Sélecteur minimal pour computeBalance (pas besoin de libellé/id)
export interface JournalBalanceRow {
  debit_account:  string | null
  credit_account: string | null
  montant:        number | null
  date_operation?: string | null
}

// ── Types sortie ──────────────────────────────────────────────────────────────

export interface AccountAggregation {
  debit:  number
  credit: number
}

export interface BalanceLine {
  numero:          string
  nom:             string
  classe:          number
  type:            string
  total_debit:     number
  total_credit:    number
  solde_debiteur:  number
  solde_crediteur: number
}

export interface BalanceSummary {
  lignes:          BalanceLine[]
  total_debit:     number
  total_credit:    number
  equilibre:       boolean
  ecart:           number
  nb_comptes:      number
  nb_ecritures:    number
  anomalies_solde: string[]
}

export interface GrandLivreCompte {
  numero:       string
  nom:          string
  classe:       number
  type:         string
  total_debit:  number
  total_credit: number
  solde:        number
  mouvements:   JournalLedgerRow[]
  anomalies:    string[]
}

export interface GrandLivreSummary {
  comptes:         GrandLivreCompte[]
  nb_comptes:      number
  nb_ecritures:    number
  total_anomalies: number
}

// ── Sélecteurs Supabase ───────────────────────────────────────────────────────

/** Colonnes pour computeBalance */
export const BALANCE_SELECT = 'debit_account, credit_account, montant, date_operation' as const

/** Colonnes pour computeGrandLivre */
export const GRAND_LIVRE_SELECT =
  'id, date_operation, libelle, debit_account, credit_account, montant, reference, source, journal_type' as const

// ── Comptes TVA SYSCOHADA (Congo/CEMAC) ──────────────────────────────────────
// Source : LF n°42-2025 Congo, Art. 4441/4446 du CGI + migrations 119+131

export const TVA_COLLECTEE_ACCOUNTS  = ['4441', '4442', '441', '441000'] as const
export const TVA_DEDUCTIBLE_ACCOUNTS = ['4445', '4446', '445600', '445700'] as const

// ── Fonction d'agrégation de base ─────────────────────────────────────────────

/**
 * Agrège les écritures du journal par compte débit/crédit.
 * Retourne une Map<numéro_compte, {debit, credit}>.
 * Complexité O(n) sur les écritures.
 */
export function aggregateByAccount(
  entries: JournalBalanceRow[],
): Map<string, AccountAggregation> {
  const map = new Map<string, AccountAggregation>()

  for (const e of entries) {
    const m = e.montant ?? 0
    if (e.debit_account) {
      const acc = map.get(e.debit_account) ?? { debit: 0, credit: 0 }
      acc.debit += m
      map.set(e.debit_account, acc)
    }
    if (e.credit_account) {
      const acc = map.get(e.credit_account) ?? { debit: 0, credit: 0 }
      acc.credit += m
      map.set(e.credit_account, acc)
    }
  }
  return map
}

// ── computeBalance ────────────────────────────────────────────────────────────

/**
 * Calcule la balance générale SYSCOHADA depuis les écritures du journal.
 *
 * @param entries      - Écritures journal_entries (filtrées par tenant + fiscal_year en DB)
 * @param classeFilter - Filtrer une seule classe SYSCOHADA (1-8). null = toutes.
 */
export function computeBalance(
  entries:     JournalBalanceRow[],
  classeFilter?: number | null,
): BalanceSummary {
  const map    = aggregateByAccount(entries)
  const lignes: BalanceLine[]  = []
  const anomalies_solde: string[] = []

  for (const [numero, { debit, credit }] of map.entries()) {
    const classe = parseInt(numero[0]) || 0
    if (classeFilter != null && classe !== classeFilter) continue

    const sc   = lookupCompte(numero)
    const nom  = sc?.nom ?? numero
    const type = sc?.type ?? '—'

    const solde_debiteur  = Math.max(0, debit - credit)
    const solde_crediteur = Math.max(0, credit - debit)
    const solde           = debit - credit

    // Détection solde anormal selon sens SYSCOHADA
    if (sc) {
      const shouldBeDebit = classe >= 6 || (
        classe >= 1 && classe <= 5 && sc.type === 'actif'
      )
      if (shouldBeDebit && solde < 0 && Math.abs(solde) > 1_000) {
        anomalies_solde.push(
          `${numero} ${nom} — solde créditeur anormal (${Math.round(credit - debit).toLocaleString('fr-FR')} FCFA)`,
        )
      }
      // Compte de passif avec solde débiteur
      if (!shouldBeDebit && sc.type === 'passif' && solde > 1_000) {
        anomalies_solde.push(
          `${numero} ${nom} — solde débiteur anormal pour un compte de passif (${Math.round(solde).toLocaleString('fr-FR')} FCFA)`,
        )
      }
    }

    lignes.push({ numero, nom, classe, type, total_debit: debit, total_credit: credit, solde_debiteur, solde_crediteur })
  }

  lignes.sort((a, b) => a.numero.localeCompare(b.numero))

  const total_debit  = lignes.reduce((s, l) => s + l.total_debit, 0)
  const total_credit = lignes.reduce((s, l) => s + l.total_credit, 0)
  const ecart        = Math.abs(total_debit - total_credit)

  return {
    lignes, total_debit, total_credit,
    equilibre:    ecart < 1,
    ecart,
    nb_comptes:   lignes.length,
    nb_ecritures: entries.length,
    anomalies_solde,
  }
}

// ── computeGrandLivre ─────────────────────────────────────────────────────────

/**
 * Construit le Grand Livre SYSCOHADA depuis les écritures du journal.
 * Pour chaque compte : mouvements chronologiques + solde + anomalies OHADA.
 *
 * @param entries       - Écritures journal_entries complètes (avec id, libelle, etc.)
 * @param compteFilter  - Filtrer un compte précis (ex: '411'). null = tous.
 * @param classeFilter  - Filtrer une classe SYSCOHADA (1-8). null = toutes.
 * @param anomaliesOnly - Si true, retourne seulement les comptes avec anomalies.
 */
export function computeGrandLivre(
  entries:      JournalLedgerRow[],
  compteFilter?: string | null,
  classeFilter?: string | null,
  anomaliesOnly  = false,
): GrandLivreSummary {
  // Grouper par compte avec mouvements complets
  const map = new Map<string, {
    debits:      JournalLedgerRow[]
    credits:     JournalLedgerRow[]
    total_debit: number
    total_credit: number
  }>()

  for (const e of entries) {
    if (e.debit_account) {
      const k = e.debit_account
      if (!map.has(k)) map.set(k, { debits: [], credits: [], total_debit: 0, total_credit: 0 })
      const g = map.get(k)!
      g.debits.push(e)
      g.total_debit += e.montant ?? 0
    }
    if (e.credit_account) {
      const k = e.credit_account
      if (!map.has(k)) map.set(k, { debits: [], credits: [], total_debit: 0, total_credit: 0 })
      const g = map.get(k)!
      g.credits.push(e)
      g.total_credit += e.montant ?? 0
    }
  }

  const comptes: GrandLivreCompte[] = []

  for (const [numero, data] of map.entries()) {
    const classe = parseInt(numero[0]) || 0
    if (classeFilter && String(classe) !== classeFilter) continue
    if (compteFilter && !numero.startsWith(compteFilter)) continue

    const sc   = lookupCompte(numero)
    const nom  = sc?.nom ?? numero
    const type = sc?.type ?? '—'
    const solde = data.total_debit - data.total_credit

    // Dédupliquer par id et trier chronologiquement
    const seen = new Map<string, JournalLedgerRow>()
    for (const e of [...data.debits, ...data.credits]) seen.set(e.id, e)
    const mouvements = Array.from(seen.values()).sort(
      (a, b) => (a.date_operation ?? '').localeCompare(b.date_operation ?? ''),
    )

    // Détection anomalies SYSCOHADA (Art. 17 AUDCIF)
    const anomalies: string[] = []

    const sanslibelle = mouvements.filter(m => !m.libelle?.trim())
    if (sanslibelle.length > 0) {
      anomalies.push(`${sanslibelle.length} écriture(s) sans libellé (SYSCOHADA Art. 17 AUDCIF)`)
    }
    if (classe >= 6 && solde < 0) {
      anomalies.push(`Compte de charges ${numero} avec solde créditeur (${Math.round(-solde).toLocaleString('fr-FR')} FCFA) — écriture inversée ?`)
    }
    if (classe === 7 && solde > 0) {
      anomalies.push(`Compte de produits ${numero} avec solde débiteur (${Math.round(solde).toLocaleString('fr-FR')} FCFA) — écriture inversée ?`)
    }
    if (numero.startsWith('4441') && solde < 0) {
      anomalies.push(`TVA facturée (4441) avec solde débiteur — probable erreur d'écriture`)
    }

    const compte: GrandLivreCompte = {
      numero, nom, classe, type,
      total_debit: data.total_debit, total_credit: data.total_credit,
      solde, mouvements, anomalies,
    }

    if (!anomaliesOnly || anomalies.length > 0) comptes.push(compte)
  }

  comptes.sort((a, b) => a.numero.localeCompare(b.numero))

  return {
    comptes,
    nb_comptes:      comptes.length,
    nb_ecritures:    entries.length,
    total_anomalies: comptes.reduce((s, c) => s + c.anomalies.length, 0),
  }
}

// ── computeTVAFromJournal ─────────────────────────────────────────────────────

export interface TVAMonthPoint {
  mois:           number
  tva_collectee:  number   // crédit comptes 4441/4442
  tva_deductible: number   // débit comptes 4445/4446
  tva_nette:      number   // collectée - déductible
  a_payer:        number   // max(0, tva_nette)
  credit_tva:     number   // max(0, -tva_nette) — report sur période suivante
  nb_ecritures:   number
}

export interface TVASummary {
  year:         number
  mensuel:      TVAMonthPoint[]
  total_collectee:  number
  total_deductible: number
  total_a_payer:    number
  total_credit:     number
}

/**
 * Calcule la TVA collectée et déductible depuis les écritures du grand livre.
 * Source SYSCOHADA : 4441/4442 (TVA collectée) · 4445/4446 (TVA déductible)
 * LF Congo 2026 Art. n°42-2025 — comptes conformes migrations 119+131.
 */
export function computeTVAFromJournal(
  entries: JournalBalanceRow[],
  year:    number,
): TVASummary {
  const mensuel: TVAMonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const moisNum = i + 1
    const mvs = entries.filter(e => {
      if (!e.date_operation) return false
      const m = parseInt(e.date_operation.slice(5, 7))
      return m === moisNum
    })

    const tva_collectee = mvs
      .filter(e => TVA_COLLECTEE_ACCOUNTS.some(a => e.credit_account === a))
      .reduce((s, e) => s + (e.montant ?? 0), 0)

    const tva_deductible = mvs
      .filter(e => TVA_DEDUCTIBLE_ACCOUNTS.some(a => e.debit_account === a))
      .reduce((s, e) => s + (e.montant ?? 0), 0)

    const tva_nette = tva_collectee - tva_deductible

    return {
      mois:          moisNum,
      tva_collectee,
      tva_deductible,
      tva_nette,
      a_payer:       Math.max(0, tva_nette),
      credit_tva:    Math.max(0, -tva_nette),
      nb_ecritures:  mvs.length,
    }
  })

  return {
    year,
    mensuel,
    total_collectee:  mensuel.reduce((s, m) => s + m.tva_collectee, 0),
    total_deductible: mensuel.reduce((s, m) => s + m.tva_deductible, 0),
    total_a_payer:    mensuel.reduce((s, m) => s + m.a_payer, 0),
    total_credit:     mensuel.reduce((s, m) => s + m.credit_tva, 0),
  }
}

// ── Helper privé ──────────────────────────────────────────────────────────────

function lookupCompte(numero: string): CompteFlat | undefined {
  return COMPTES_PLATS.find(c => c.numero === numero)
}
