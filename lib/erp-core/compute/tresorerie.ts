/**
 * lib/erp-core/compute/tresorerie.ts
 *
 * UNIQUE source de vérité pour le calcul de la trésorerie totale.
 * Remplace les 4 versions disparates identifiées dans l'audit ERP Core.
 *
 * COLONNES réelles confirmées :
 *   comptes_bancaires : id, intitule, solde, actif
 *   caisses           : id, nom, solde, actif
 *   mobile_money_wallets : id, nom_titulaire, solde_actuel, actif, devise
 *
 * ATTENTION : mobile_money_wallets.solde_actuel (PAS .solde — colonne inexistante)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BanqueRow {
  id:       string
  intitule: string          // PAS 'nom' — colonne réelle est 'intitule'
  solde:    number | null
  devise?:  string
}

export interface CaisseRow {
  id:     string
  nom:    string
  solde:  number | null
  devise?: string
}

export interface WalletRow {
  id:           string
  nom_titulaire: string     // PAS 'nom' — colonne réelle est 'nom_titulaire'
  solde_actuel:  number | null  // PAS 'solde' — colonne réelle est 'solde_actuel'
  devise?:       string
}

export type CompteType = 'banque' | 'caisse' | 'mobile'

export interface CompteDetail {
  id:     string
  nom:    string
  type:   CompteType
  solde:  number
  devise: string
}

export interface TresoSummary {
  solde_banques:   number
  solde_caisses:   number
  solde_wallets:   number       // mobile money
  tresorie_totale: number       // somme des 3
  par_compte:      CompteDetail[]
}

// ── Sélecteurs Supabase ───────────────────────────────────────────────────────

export const BANQUE_SELECT = 'id, intitule, solde' as const
export const CAISSE_SELECT = 'id, nom, solde' as const
export const WALLET_SELECT = 'id, nom_titulaire, solde_actuel' as const

// ── Fonction principale ───────────────────────────────────────────────────────

/**
 * Calcule la trésorerie totale depuis les 3 sources de comptes.
 * Fonctions pure : 0 appel DB.
 */
export function computeTresorerie(
  banques: BanqueRow[],
  caisses: CaisseRow[],
  wallets: WalletRow[],
): TresoSummary {
  const solde_banques = banques.reduce((s, b) => s + (b.solde ?? 0), 0)
  const solde_caisses = caisses.reduce((s, c) => s + (c.solde ?? 0), 0)
  const solde_wallets = wallets.reduce((s, w) => s + (w.solde_actuel ?? 0), 0)

  const par_compte: CompteDetail[] = [
    ...banques.map(b => ({
      id: b.id, nom: b.intitule, type: 'banque' as const,
      solde: b.solde ?? 0, devise: b.devise ?? 'XAF',
    })),
    ...caisses.map(c => ({
      id: c.id, nom: c.nom, type: 'caisse' as const,
      solde: c.solde ?? 0, devise: c.devise ?? 'XAF',
    })),
    ...wallets.map(w => ({
      id: w.id, nom: w.nom_titulaire, type: 'mobile' as const,
      solde: w.solde_actuel ?? 0, devise: w.devise ?? 'XAF',
    })),
  ]

  return {
    solde_banques,
    solde_caisses,
    solde_wallets,
    tresorie_totale: solde_banques + solde_caisses + solde_wallets,
    par_compte,
  }
}
