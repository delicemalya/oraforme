// ── Alerts Engine — threshold-based detection ─────────────────────────────────

import type { BiAlert, DgKpis, RhKpis, EcoleKpis, HotelKpis } from './types'

let _id = 0
function id() { return String(++_id) }

export function buildDgAlerts(kpis: DgKpis): BiAlert[] {
  const alerts: BiAlert[] = []

  if (kpis.tresoTotale < 0) {
    alerts.push({
      id: id(), severity: 'critical',
      title: 'Trésorerie négative',
      description: `Solde total : ${Math.abs(kpis.tresoTotale).toLocaleString('fr-FR')} FCFA de découvert`,
      value: kpis.tresoTotale,
      link: '/dashboard/tresorerie',
    })
  } else if (kpis.tresoTotale < 500_000) {
    alerts.push({
      id: id(), severity: 'warning',
      title: 'Trésorerie faible',
      description: `Solde : ${kpis.tresoTotale.toLocaleString('fr-FR')} FCFA — risque de rupture`,
      value: kpis.tresoTotale,
      link: '/dashboard/tresorerie',
    })
  }

  if (kpis.nbFacturesRetard > 0) {
    alerts.push({
      id: id(), severity: 'warning',
      title: `${kpis.nbFacturesRetard} facture${kpis.nbFacturesRetard > 1 ? 's' : ''} en retard`,
      description: `Créances clients : ${kpis.creancesClients.toLocaleString('fr-FR')} FCFA à recouvrer`,
      value: kpis.creancesClients,
      link: '/dashboard/facturation',
    })
  }

  if (kpis.contratsExpirant30 > 0) {
    alerts.push({
      id: id(), severity: 'info',
      title: `${kpis.contratsExpirant30} contrat${kpis.contratsExpirant30 > 1 ? 's' : ''} expirant dans 30 jours`,
      description: 'Renouvellement ou licenciement à planifier',
      link: '/dashboard/rh/contrats',
    })
  }

  if (kpis.resultatNet < 0) {
    alerts.push({
      id: id(), severity: 'critical',
      title: 'Résultat net négatif',
      description: `Perte de ${Math.abs(kpis.resultatNet).toLocaleString('fr-FR')} FCFA sur l'exercice`,
      value: kpis.resultatNet,
      link: '/dashboard/finance',
    })
  }

  return alerts
}

export function buildRhAlerts(kpis: RhKpis): BiAlert[] {
  const alerts: BiAlert[] = []

  if (kpis.contratsExpirant30 > 0) {
    alerts.push({
      id: id(), severity: 'warning',
      title: `${kpis.contratsExpirant30} contrat${kpis.contratsExpirant30 > 1 ? 's' : ''} expirant sous 30 jours`,
      description: 'Action RH requise — renouveler ou notifier',
      link: '/dashboard/rh/contrats',
    })
  }

  if (kpis.tauxPresence < 80) {
    alerts.push({
      id: id(), severity: 'warning',
      title: `Taux de présence bas : ${kpis.tauxPresence}%`,
      description: 'Nombre d\'absences élevé ce mois — vérifier les justificatifs',
      link: '/dashboard/rh/presences',
    })
  }

  if (kpis.nbDemissions > 0) {
    alerts.push({
      id: id(), severity: 'info',
      title: `${kpis.nbDemissions} démission${kpis.nbDemissions > 1 ? 's' : ''} enregistrée${kpis.nbDemissions > 1 ? 's' : ''}`,
      description: 'Lancer le processus de remplacement si nécessaire',
      link: '/dashboard/rh/recrutement',
    })
  }

  return alerts
}

export function buildEcoleAlerts(kpis: EcoleKpis): BiAlert[] {
  const alerts: BiAlert[] = []

  if (kpis.nbImpayesFamilles > 0) {
    alerts.push({
      id: id(), severity: 'warning',
      title: `${kpis.nbImpayesFamilles} famille${kpis.nbImpayesFamilles > 1 ? 's' : ''} avec impayés`,
      description: `Montant total impayé : ${kpis.montantImpayes.toLocaleString('fr-FR')} FCFA`,
      value: kpis.montantImpayes,
      link: '/dashboard/ecole',
    })
  }

  if (kpis.txPaiement < 70) {
    alerts.push({
      id: id(), severity: 'critical',
      title: `Taux de paiement critique : ${kpis.txPaiement}%`,
      description: 'Plus de 30% des familles n\'ont pas réglé leur scolarité',
      link: '/dashboard/ecole',
    })
  } else if (kpis.txPaiement < 85) {
    alerts.push({
      id: id(), severity: 'warning',
      title: `Taux de paiement à améliorer : ${kpis.txPaiement}%`,
      description: 'Des relances sont recommandées',
      link: '/dashboard/ecole',
    })
  }

  if (kpis.nbAbsences > 50) {
    alerts.push({
      id: id(), severity: 'info',
      title: `${kpis.nbAbsences} absences enregistrées`,
      description: 'Vérifier les motifs et contacter les familles concernées',
      link: '/dashboard/ecole',
    })
  }

  return alerts
}

export function buildHotelAlerts(kpis: HotelKpis): BiAlert[] {
  const alerts: BiAlert[] = []

  if (kpis.tauxOccupation < 40) {
    alerts.push({
      id: id(), severity: 'warning',
      title: `Taux d'occupation faible : ${kpis.tauxOccupation}%`,
      description: 'Moins de 40% des chambres occupées — considérer des promotions',
      link: '/dashboard/hotel',
    })
  }

  return alerts
}
