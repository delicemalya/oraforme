import { redirect } from 'next/navigation'

// These types are kept for backward-compat with _lib/ecole-dashboard-client.tsx
export type EcoleRole =
  | 'DIRECTION_GENERALE' | 'RAF' | 'SCOLARITE' | 'RH_PAIE'
  | 'FORMATEUR' | 'ETUDIANT' | 'PARENT' | 'DTI' | 'DAAC'

export type EcoleKpis = {
  nbEtudiants:          number
  nbActifs:             number
  nbEnseignants:        number
  nbAbsencesJour:       number
  nbExamensAvenir:      number
  nbNotifs:             number
  revenuMois:           number
  nbPaiementsEnAttente: number
  montantImpayes:       number
  soldeTresorerie:      number
  nbEmployes:           number
  nbHeurePending:       number
  myHeuresTotales:      number
  myHeuresValidees:     number
  myNotesMoyenne:       number | null
  myAbsences:           number
  myPaiementOk:         boolean | null
}

export default function EcoleDashboardPage() {
  redirect('/dashboard')
}
