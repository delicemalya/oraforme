// ── Fiscalité Oraforme — Types OHADA multi-pays ──────────────────────────────

export type PaysFiscal =
  | 'CG' | 'CD' | 'CM' | 'GA' | 'CF' | 'TD'   // CEMAC / OHADA Afrique C.
  | 'AO' | 'GQ'                                   // Lusophone + Guinée éq.
  | 'ML' | 'BF' | 'NE' | 'NG'                    // Afrique de l'Ouest
  | 'FR' | 'BE' | 'CH'                            // Europe

export type RegimeTVA = 'mensuel' | 'trimestriel' | 'annuel'
export type Periodicite = 'mensuel' | 'trimestriel' | 'annuel'

export interface TranscheIRPP {
  min: number
  max: number  // Infinity = pas de plafond
  taux: number  // 0.10 = 10%
}

export interface ConfigTVA {
  taux_normal: number          // 0.18 = 18%
  taux_reduit?: number
  taux_super_reduit?: number
  taxes_additionnelles: TaxeAdditionnelle[]
  regime: RegimeTVA
  seuil_assujettissement: number  // CA annuel minimum pour être redevable
  echeance_jour: number           // jour du mois pour déposer la déclaration
  echeance_mois_suivant: boolean
}

export interface TaxeAdditionnelle {
  code: string   // 'CA', 'CAAM', etc.
  nom: string
  taux: number
  base: 'tva_collectee' | 'ca_ht' | 'ttc'
}

export interface ConfigCNSS {
  nom: string              // 'CNSS', 'CNPS', 'INSS', 'ONSS', etc.
  acronyme: string
  taux_salarie: number
  taux_patronal: number
  plafond_mensuel: number | null   // null = pas de plafond
  plafond_annuel: number | null
  branches: string[]               // 'retraite', 'maladie', 'AT', 'famille'
  echeance_jour: number
  echeance_mois_suivant: boolean
}

export interface ConfigIRPP {
  nom: string      // 'IRPP', 'IPR', 'IRCEM', 'PAYE', 'ITS', 'IPP'
  abattement_pct: number   // 0.10 = 10% abattement forfaitaire
  tranches: TranscheIRPP[]
  periodicite: Periodicite
  echeance_jour: number
}

export interface ConfigTaxeAnnuelle {
  code: string
  nom: string
  base: string
  taux?: number
  montant_fixe?: number
  echeance_mois: number
  echeance_jour: number
}

export interface PaysConfig {
  code: PaysFiscal
  nom: string
  drapeau: string
  devise: string      // 'FCFA', 'CDF', 'EUR', 'NGN', 'AOA', 'CHF'
  symbole: string     // '₣', '€', '₦', 'Kz'
  systeme_comptable: 'OHADA' | 'SYSCOHADA' | 'PCG' | 'IFRS'
  zone: 'CEMAC' | 'UEMOA' | 'anglophone' | 'UE' | 'autre'
  tva: ConfigTVA
  cnss: ConfigCNSS
  irpp: ConfigIRPP
  taxes_annuelles: ConfigTaxeAnnuelle[]
  notes_importantes: string[]
}

// ── Declaration types ─────────────────────────────────────────────────────────

export type TypeDeclaration =
  | 'tva' | 'cnss' | 'irpp' | 'is' | 'patente' | 'tvts'
  | 'contribution_appui' | 'declaration_annuelle' | 'autre'

export type StatutDeclaration =
  | 'a_faire' | 'en_cours' | 'deposee' | 'payee' | 'en_retard' | 'contestee'

export interface FiscalDeclaration {
  id: string
  tenant_id: string
  type: TypeDeclaration
  pays: PaysFiscal
  periode_mois: number   // 1-12
  periode_annee: number
  montant_base: number
  montant_du: number
  montant_paye: number
  penalites: number
  statut: StatutDeclaration
  date_echeance: string
  date_depot: string | null
  date_paiement: string | null
  reference_depot: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EcheanceFiscale {
  type: TypeDeclaration
  label: string
  pays: PaysFiscal
  periode_label: string
  date_echeance: string
  jours_restants: number
  statut: 'ok' | 'urgent' | 'retard'
  montant_estime?: number
  declaration_id?: string
}

// ── Calculation results ───────────────────────────────────────────────────────

export interface ResultatTVA {
  tva_collectee: number
  tva_deductible: number
  tva_nette: number
  taxes_additionnelles: Record<string, number>
  total_a_payer: number
  credit_tva: number
  ca_ht: number
}

export interface ResultatCNSS {
  salaire_brut_total: number
  base_cotisable: number
  cotisation_salarie: number
  cotisation_patronale: number
  total_cnss: number
  nb_employes: number
  details_branches: Record<string, number>
}

export interface ResultatIRPP {
  revenu_brut: number
  abattement: number
  revenu_imposable: number
  irpp_total: number
  nb_employes: number
  details_tranches: Array<{ tranche: string; montant: number }>
}
