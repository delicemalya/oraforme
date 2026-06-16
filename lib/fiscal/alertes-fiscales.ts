export interface AlerteFiscale {
  id:          string
  nom:         string
  description: string
  jour:        number
  mois:        number | null   // null = mensuelle
  recurrence:  'mensuelle' | 'annuelle'
  base:        string
}

const ALERTES_FISCALES: AlerteFiscale[] = [
  // IS — Acomptes trimestriels
  { id: 'is-acompte-fev',  nom: 'Acompte IS', description: 'Acompte Impôt sur les Sociétés', jour: 15, mois: 2,    recurrence: 'annuelle',  base: 'Art. 124A CGI' },
  { id: 'is-acompte-mai',  nom: 'Acompte IS', description: 'Acompte Impôt sur les Sociétés', jour: 15, mois: 5,    recurrence: 'annuelle',  base: 'Art. 124A CGI' },
  { id: 'is-acompte-aout', nom: 'Acompte IS', description: 'Acompte Impôt sur les Sociétés', jour: 15, mois: 8,    recurrence: 'annuelle',  base: 'Art. 124A CGI' },
  { id: 'is-acompte-nov',  nom: 'Acompte IS', description: 'Acompte Impôt sur les Sociétés', jour: 15, mois: 11,   recurrence: 'annuelle',  base: 'Art. 124A CGI' },

  // TSS — Taxe Spéciale sur les Sociétés
  { id: 'tss',             nom: 'TSS',         description: 'Taxe Spéciale sur les Sociétés — Art. 168 CGI',       jour: 15, mois: 3,    recurrence: 'annuelle',  base: 'Art. 171 CGI' },

  // IGF — Impôt Global Forfaitaire
  { id: 'igf',             nom: 'IGF',         description: 'Impôt Global Forfaitaire (8% CA) — régime forfaitaire', jour: 31, mois: 3,  recurrence: 'annuelle',  base: 'Annexe XIII CGI' },

  // Taxe d'apprentissage — mensuelle
  { id: 'taxe-apprentissage', nom: "Taxe d'apprentissage", description: "Taxe d'apprentissage sur salaires du mois précédent", jour: 20, mois: null, recurrence: 'mensuelle', base: 'Art. 147bis CGI' },

  // TVA — mensuelle
  { id: 'tva-mensuelle',   nom: 'Déclaration TVA',    description: 'Déclaration et paiement TVA 18%',                        jour: 20, mois: null, recurrence: 'mensuelle', base: 'CGI Congo' },

  // CNSS — mensuelle
  { id: 'cnss-mensuelle',  nom: 'Cotisations CNSS',   description: 'Cotisations CNSS salarié 4% + patronal 20.29%',          jour: 18, mois: null, recurrence: 'mensuelle', base: 'Code du travail Congo' },

  // Patente
  { id: 'patente',         nom: 'Patente',            description: 'Contribution des patentes — Art. 277 CGI',               jour: 31, mois: 3,   recurrence: 'annuelle',  base: 'Art. 277 CGI' },
]

export default ALERTES_FISCALES

// ── Helpers ───────────────────────────────────────────────────────────────────

export interface EcheanceFiscale extends AlerteFiscale {
  dateLimite:  Date
  joursRestants: number
  urgence:     'rouge' | 'orange' | 'normal'
}

/** Retourne la prochaine occurrence d'une alerte à partir d'aujourd'hui */
function prochaineDate(alerte: AlerteFiscale, depuis: Date): Date {
  const annee = depuis.getFullYear()

  if (alerte.recurrence === 'mensuelle') {
    // Même mois, même jour — si passé, passer au mois suivant
    let d = new Date(annee, depuis.getMonth(), alerte.jour, 23, 59, 59)
    if (d <= depuis) d = new Date(annee, depuis.getMonth() + 1, alerte.jour, 23, 59, 59)
    return d
  }

  // Annuelle : mois est 1-indexed dans les données
  const mois = (alerte.mois ?? 1) - 1 // convertir en 0-indexed
  let d = new Date(annee, mois, alerte.jour, 23, 59, 59)
  if (d <= depuis) d = new Date(annee + 1, mois, alerte.jour, 23, 59, 59)
  return d
}

/** Retourne les échéances dans les N prochains jours, triées par date */
export function getEcheances(joursMax = 30): EcheanceFiscale[] {
  const maintenant = new Date()
  const limite     = new Date(maintenant)
  limite.setDate(limite.getDate() + joursMax)

  return ALERTES_FISCALES
    .map(alerte => {
      const dateLimite    = prochaineDate(alerte, maintenant)
      const diff          = dateLimite.getTime() - maintenant.getTime()
      const joursRestants = Math.ceil(diff / (1000 * 60 * 60 * 24))
      const urgence: EcheanceFiscale['urgence'] =
        joursRestants <= 7  ? 'rouge'  :
        joursRestants <= 30 ? 'orange' : 'normal'
      return { ...alerte, dateLimite, joursRestants, urgence }
    })
    .filter(e => e.dateLimite <= limite)
    .sort((a, b) => a.dateLimite.getTime() - b.dateLimite.getTime())
}
