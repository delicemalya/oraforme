// MIAA+ Audit Fiscal Automatique — Phase 3
// Évalue la conformité fiscale d'un tenant à partir des données réelles
// Données importées depuis les moteurs Phase 1 — zéro duplication

import { FISCALITE_CONGO_2026 }                       from './fiscalite-congo'
import { FISCALITE_CAMEROUN_2023 }                    from './fiscalite-cameroun'
import { TAUX_IS as IS_GA, TAUX_TVA as TVA_GA }       from './fiscalite-gabon'
import { TAUX_IS as IS_TD, TAUX_TVA as TVA_TD }       from './fiscalite-tchad'
import { TAUX_IS as IS_CF, TAUX_TVA as TVA_CF }       from './fiscalite-rca'
import { TAUX_IS as IS_GQ, TAUX_TVA as TVA_GQ }       from './fiscalite-guinee-equatoriale'
import { TAUX_IS as IS_CD, TAUX_TVA as TVA_CD }       from './fiscalite-rdc'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface AuditRisque {
  type: string
  severite: 'critique' | 'eleve' | 'moyen' | 'faible'
  description: string
  impact: string
  correction: string
}

export interface AuditFiscalResult {
  score: number
  niveau: 'critique' | 'risque' | 'attention' | 'conforme'
  risques: AuditRisque[]
  recommandations: string[]
  prochainEcheance?: string
}

export interface DonneesTenant {
  chiffreAffaires: number
  dateCreation: Date
  secteur: string
  tvaDeclareeMois?: number[]
  patente?: { declaree: boolean; annee: number }
  is?: { acompte1: boolean; acompte2: boolean; solde: boolean }
  dateDerniereBilan?: Date
}

// ── Configuration fiscale par pays (tirée des imports Phase 1) ─────────────

interface ConfigPaysAudit {
  tvaTaux: number
  isTaux: number
  patenteEcheanceMois: number
  seuilTvaCA?: number
  hasAcomptes: boolean
  devise: string
  nom: string
}

function getConfigAudit(countryCode: string): ConfigPaysAudit {
  const code = countryCode === 'CD_USD' ? 'CD' : countryCode
  switch (code) {
    case 'CG': return {
      tvaTaux:            FISCALITE_CONGO_2026.tva.taux_effectif_ht,
      isTaux:             FISCALITE_CONGO_2026.is.taux_standard,
      patenteEcheanceMois: 3,
      seuilTvaCA:         FISCALITE_CONGO_2026.tva.seuil_assujettissement,
      hasAcomptes:        true,
      devise:             'FCFA',
      nom:                'Congo-Brazzaville',
    }
    case 'CM': return {
      tvaTaux:            FISCALITE_CAMEROUN_2023.tva.taux_effectif,
      isTaux:             0.30,
      patenteEcheanceMois: 2,
      hasAcomptes:        true,
      devise:             'FCFA',
      nom:                'Cameroun',
    }
    case 'GA': return {
      tvaTaux:            TVA_GA.taux_normal,
      isTaux:             IS_GA.taux_normal,
      patenteEcheanceMois: 1,
      hasAcomptes:        true,
      devise:             'XAF',
      nom:                'Gabon',
    }
    case 'TD': return {
      tvaTaux:            TVA_TD.taux_normal,
      isTaux:             IS_TD.taux_normal,
      patenteEcheanceMois: 3,
      hasAcomptes:        false,
      devise:             'XAF',
      nom:                'Tchad',
    }
    case 'CF': return {
      tvaTaux:            TVA_CF.taux_normal,
      isTaux:             IS_CF.regime_general_taux,
      patenteEcheanceMois: 1,
      seuilTvaCA:         TVA_CF.seuil_assujettissement,
      hasAcomptes:        false,
      devise:             'XAF',
      nom:                'RCA',
    }
    case 'GQ': return {
      tvaTaux:            TVA_GQ.taux_normal,
      isTaux:             IS_GQ.taux_normal,
      patenteEcheanceMois: 1,
      hasAcomptes:        false,
      devise:             'XAF',
      nom:                'Guinée Équatoriale',
    }
    case 'CD': return {
      tvaTaux:            TVA_CD.taux_normal,
      isTaux:             IS_CD.taux_normal,
      patenteEcheanceMois: 3,
      seuilTvaCA:         TVA_CD.seuil_assujettissement_cdf,
      hasAcomptes:        false,
      devise:             'CDF',
      nom:                'RD Congo',
    }
    default: return {
      tvaTaux:            0.18,
      isTaux:             0.30,
      patenteEcheanceMois: 3,
      hasAcomptes:        false,
      devise:             'FCFA',
      nom:                countryCode,
    }
  }
}

// ── Fonction principale d'audit ───────────────────────────────────────────────

export function evaluerConformiteFiscale(
  countryCode: string,
  donnees: DonneesTenant,
): AuditFiscalResult {
  const cfg      = getConfigAudit(countryCode)
  const risques: AuditRisque[] = []
  const now      = new Date()
  const moisActuel = now.getMonth() + 1   // 1-12
  const anneeActuelle = now.getFullYear()

  // ── 1. Audit TVA ────────────────────────────────────────────────────────────

  const assujetti = !cfg.seuilTvaCA || donnees.chiffreAffaires >= cfg.seuilTvaCA
  const moisEcoules = moisActuel - 1  // mois pour lesquels la TVA est déjà exigible
  const moisDeclaresOk = (donnees.tvaDeclareeMois ?? []).filter(m => m <= moisEcoules).length
  const moisManquants  = Math.max(0, moisEcoules - moisDeclaresOk)

  if (assujetti && moisManquants > 0) {
    const svt: AuditRisque['severite'] = moisManquants >= 3 ? 'critique' : moisManquants >= 2 ? 'eleve' : 'moyen'
    risques.push({
      type:        'TVA non déclarée',
      severite:    svt,
      description: `${moisManquants} déclaration(s) TVA manquante(s) sur les ${moisEcoules} mois écoulés de ${anneeActuelle}.`,
      impact:      `Majoration ${(0.25 * 100).toFixed(0)}% + intérêts de retard 1,5%/mois sur chaque mois non déclaré. Risque de contrôle DGI.`,
      correction:  `Déposer immédiatement les déclarations TVA manquantes avec régularisation spontanée pour limiter les pénalités.`,
    })
  }

  if (!assujetti && donnees.chiffreAffaires > 0 && cfg.seuilTvaCA) {
    const pctSeuil = (donnees.chiffreAffaires / cfg.seuilTvaCA) * 100
    if (pctSeuil > 80) {
      risques.push({
        type:        'Seuil TVA proche',
        severite:    'moyen',
        description: `Votre CA (${donnees.chiffreAffaires.toLocaleString('fr-FR')} ${cfg.devise}) représente ${pctSeuil.toFixed(0)}% du seuil TVA (${cfg.seuilTvaCA.toLocaleString('fr-FR')} ${cfg.devise}).`,
        impact:      `Franchissement du seuil = obligation TVA immédiate sur toutes les ventes futures.`,
        correction:  `Anticiper l'assujettissement TVA : paramétrer la facturation et prévenir les clients.`,
      })
    }
  }

  // ── 2. Audit Patente ────────────────────────────────────────────────────────

  const anneePatente = donnees.patente?.annee ?? 0
  const patenteActuelle = anneePatente >= anneeActuelle
  const patenteEnRetard = !patenteActuelle && moisActuel > cfg.patenteEcheanceMois

  if (!patenteActuelle && patenteEnRetard) {
    risques.push({
      type:        'Patente en retard',
      severite:    'eleve',
      description: `La Patente ${anneeActuelle} n'est pas déclarée. L'échéance était le mois ${cfg.patenteEcheanceMois}/${anneeActuelle}.`,
      impact:      'Blocage administratif possible (marchés publics, renouvellements). Pénalités de retard applicables.',
      correction:  `Régulariser immédiatement la Patente ${anneeActuelle} auprès de la DGI ${cfg.nom}.`,
    })
  } else if (!patenteActuelle && !patenteEnRetard) {
    risques.push({
      type:        'Patente à déclarer',
      severite:    'faible',
      description: `La Patente ${anneeActuelle} n'a pas encore été déclarée — l'échéance est le mois ${cfg.patenteEcheanceMois}/${anneeActuelle}.`,
      impact:      "Aucune pénalité si déclarée avant l'échéance.",
      correction:  `Préparer et déposer la Patente ${anneeActuelle} avant le mois ${cfg.patenteEcheanceMois}/${anneeActuelle}.`,
    })
  }

  // ── 3. Audit IS / Acomptes ─────────────────────────────────────────────────

  if (cfg.hasAcomptes && donnees.is) {
    if (!donnees.is.acompte1 && moisActuel > 11) {
      risques.push({
        type:        'Acompte IS 1 non versé',
        severite:    'eleve',
        description: `Le 1er acompte IS (${(0.25 * 100).toFixed(0)}% de l'IS N-1) n'a pas été versé.`,
        impact:      `Majoration de ${(0.10 * 100).toFixed(0)}% + intérêts 1,5%/mois sur l'acompte dû.`,
        correction:  'Verser le 1er acompte immédiatement avec régularisation.',
      })
    }
    if (!donnees.is.acompte2 && moisActuel > 1) {
      risques.push({
        type:        'Acompte IS 2 non versé',
        severite:    'eleve',
        description: `Le 2e acompte IS n'a pas été versé.`,
        impact:      `Majoration de ${(0.10 * 100).toFixed(0)}% + intérêts 1,5%/mois sur l'acompte dû.`,
        correction:  'Verser le 2e acompte avec régularisation.',
      })
    }
    if (!donnees.is.solde && moisActuel > 4) {
      risques.push({
        type:        'Solde IS annuel non déclaré',
        severite:    'critique',
        description: `La déclaration IS annuelle (solde) n'a pas été déposée. L'échéance était le 30 avril.`,
        impact:      "Pénalités de retard, risque de redressement d'office par la DGI.",
        correction:  'Déposer la déclaration IS annuelle immédiatement avec paiement du solde.',
      })
    }
  } else if (!cfg.hasAcomptes && donnees.is && !donnees.is.solde && moisActuel > 4) {
    risques.push({
      type:        'IS annuel non déclaré',
      severite:    'critique',
      description: `La déclaration IS/IBP annuelle n'a pas été déposée. L'échéance était le 30 avril.`,
      impact:      'Pénalités de retard et risque de redressement.',
      correction:  'Déposer la déclaration IS/IBP annuelle immédiatement.',
    })
  }

  // ── 4. Audit Bilan ─────────────────────────────────────────────────────────

  if (donnees.dateDerniereBilan) {
    const msSinceBilan = now.getTime() - donnees.dateDerniereBilan.getTime()
    const joursSinceBilan = msSinceBilan / (1000 * 60 * 60 * 24)
    if (joursSinceBilan > 548) {  // > 18 mois
      risques.push({
        type:        'Bilan non établi',
        severite:    'eleve',
        description: `Le dernier bilan date de ${Math.round(joursSinceBilan / 30)} mois. SYSCOHADA impose un bilan annuel.`,
        impact:      'Non-conformité OHADA. Sanction possible sur les comptes non certifiés.',
        correction:  'Faire établir les états financiers SYSCOHADA par un expert-comptable agréé.',
      })
    }
  }

  // ── 5. Calcul du score ─────────────────────────────────────────────────────

  const critiques  = risques.filter(r => r.severite === 'critique').length
  const eleves     = risques.filter(r => r.severite === 'eleve').length
  const moyens     = risques.filter(r => r.severite === 'moyen').length
  const faibles    = risques.filter(r => r.severite === 'faible').length

  let score = 100
  score -= critiques * 25
  score -= eleves    * 15
  score -= moyens    *  8
  score -= faibles   *  3
  score  = Math.max(0, Math.min(100, score))

  const niveau: AuditFiscalResult['niveau'] =
    score < 40 ? 'critique' :
    score < 60 ? 'risque'   :
    score < 80 ? 'attention' : 'conforme'

  // ── 6. Recommandations ─────────────────────────────────────────────────────

  const recommandations: string[] = []

  if (critiques > 0) {
    recommandations.push('URGENT : régulariser immédiatement les obligations critiques pour éviter un contrôle fiscal.')
  }
  if (moisManquants > 0 && assujetti) {
    recommandations.push(`Déposer les ${moisManquants} déclarations TVA manquantes en mode "déclaration spontanée" pour réduire les pénalités.`)
  }
  if (patenteEnRetard) {
    recommandations.push('Régulariser la Patente en démarche spontanée auprès de la DGI.')
  }
  if (score < 80) {
    recommandations.push('Mettre en place un calendrier fiscal annuel avec alertes automatiques MIAA+.')
    recommandations.push('Désigner un référent fiscal interne ou mandater un expert-comptable.')
  }
  if (score >= 80) {
    recommandations.push('Conformité satisfaisante. Maintenir la rigueur sur les déclarations mensuelles.')
    recommandations.push('Anticiper les échéances annuelles (patente, IS/IBP) avant leur date limite.')
  }

  // ── 7. Prochaine échéance ──────────────────────────────────────────────────

  const prochainEcheance = computeProchainEcheance(cfg, moisActuel, anneeActuelle)

  return { score, niveau, risques, recommandations, prochainEcheance }
}

// ── Détection anomalies TVA ───────────────────────────────────────────────────

export function detecterAnomaliesTVA(
  montantTVACollectee: number,
  montantTVADeductible: number,
  chiffreAffaires: number,
  countryCode: string,
): AuditRisque[] {
  if (chiffreAffaires <= 0) return []

  const cfg     = getConfigAudit(countryCode)
  const risques: AuditRisque[] = []
  const ratioCollectee = montantTVACollectee / chiffreAffaires
  const seuilMin = cfg.tvaTaux * 0.4  // si ratio < 40% du taux normal = anomalie

  if (ratioCollectee < seuilMin && montantTVACollectee > 0) {
    risques.push({
      type:        'Ratio TVA/CA anormalement bas',
      severite:    'eleve',
      description: `TVA collectée / CA = ${(ratioCollectee * 100).toFixed(1)}% alors que le taux normal est ${(cfg.tvaTaux * 100).toFixed(1)}%. Ratio attendu minimum : ${(seuilMin * 100).toFixed(1)}%.`,
      impact:      "Signal fort de sous-facturation ou d'omissions de TVA — cible prioritaire lors d'un contrôle DGI.",
      correction:  'Revoir les factures émises et vérifier si toutes les ventes ont été soumises à TVA. Corriger les éventuelles erreurs de taux.',
    })
  }

  if (montantTVACollectee === 0 && chiffreAffaires > 0) {
    const seuil = cfg.seuilTvaCA ?? 0
    if (chiffreAffaires >= seuil) {
      risques.push({
        type:        'TVA collectée nulle malgré CA significatif',
        severite:    'critique',
        description: `Aucune TVA collectée déclarée alors que le CA (${chiffreAffaires.toLocaleString('fr-FR')} ${cfg.devise}) dépasse le seuil d'assujettissement.`,
        impact:      'Très haut risque de redressement fiscal. La DGI peut reconstituer le CA et appliquer TVA + pénalités.',
        correction:  "Vérifier le statut TVA de l'entreprise. Si assujettie, régulariser toutes les déclarations manquantes immédiatement.",
      })
    }
  }

  const ratioDeductible = montantTVADeductible / (montantTVACollectee || 1)
  if (ratioDeductible > 0.95 && montantTVADeductible > 0) {
    risques.push({
      type:        'TVA déductible très élevée par rapport à la collectée',
      severite:    'moyen',
      description: `TVA déductible = ${(ratioDeductible * 100).toFixed(0)}% de la TVA collectée. Crédit de TVA chronique susceptible d'attirer un contrôle.`,
      impact:      "Risque de vérification des pièces justificatives d'achats par la DGI.",
      correction:  "S'assurer que toutes les déductions sont justifiées par des factures originales d'achats professionnels.",
    })
  }

  return risques
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeProchainEcheance(cfg: ConfigPaysAudit, moisActuel: number, annee: number): string {
  const moisNoms = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  // TVA toujours mensuelle — prochaine : 15 du mois prochain
  const moisProchain = moisActuel === 12 ? 1 : moisActuel + 1
  const anneeProchain = moisActuel === 12 ? annee + 1 : annee
  return `TVA mensuelle : avant le 15 ${moisNoms[moisProchain]} ${anneeProchain} — Patente ${annee} : avant fin ${moisNoms[cfg.patenteEcheanceMois]} ${annee}`
}
