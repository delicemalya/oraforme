import type { CVData, OffreCriteres } from './cv-analyzer'

export interface ScoreDetail {
  diplome: number               // max 20
  experience: number            // max 20
  competences_obligatoires: number  // max 25
  competences_souhaitees: number    // max 10
  langues: number               // max 10
  certifications: number        // max 8
  stabilite: number             // max 7
  total: number                 // 0-100
  categorie: 'Exceptionnel' | 'Excellent' | 'Bon' | 'Moyen' | 'Faible'
}

const DIPLOME_LEVEL: Record<string, number> = {
  'sans diplome requis': 0,
  'cap/bep': 1,
  'bac': 2,
  'bts/dut': 3,
  'licence': 4,
  'master': 5,
  'mba': 5,
  'doctorat': 6,
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function countMatches(candidateList: string[], targetList: string[]): number {
  return targetList.filter(t =>
    candidateList.some(c =>
      normalize(c).includes(normalize(t)) || normalize(t).includes(normalize(c))
    )
  ).length
}

function parseDureeEnMois(duree: string): number {
  if (!duree) return 0
  const lower = duree.toLowerCase()
  const annMatch = lower.match(/(\d+)\s*an/)
  const moisMatch = lower.match(/(\d+)\s*mois/)
  const annees = annMatch ? parseInt(annMatch[1]) : 0
  const mois = moisMatch ? parseInt(moisMatch[1]) : 0
  return annees * 12 + mois
}

export function calculerScore(cv: CVData, offre: OffreCriteres): ScoreDetail {
  // 1. Diplôme — 20 pts
  let diplome = 0
  if (offre.diplome_requis) {
    const reqLevel = DIPLOME_LEVEL[normalize(offre.diplome_requis)] ?? 0
    const cvLevel = cv.diplomes.length > 0
      ? Math.max(...cv.diplomes.map(d => DIPLOME_LEVEL[normalize(d)] ?? 0))
      : 0
    if (cvLevel >= reqLevel) diplome = 20
    else if (reqLevel > 0 && cvLevel === reqLevel - 1) diplome = 12
    else if (reqLevel > 1 && cvLevel === reqLevel - 2) diplome = 5
  } else {
    diplome = 20
  }

  // 2. Expérience — 20 pts
  let experience = 0
  if (offre.experience_min > 0) {
    const ratio = cv.annees_experience_total / offre.experience_min
    experience = Math.round(Math.min(ratio, 1) * 20)
  } else {
    experience = 20
  }

  // 3. Compétences obligatoires — 25 pts
  const allSkills = [...cv.competences, ...cv.certifications]
  let competences_obligatoires = 0
  if (offre.competences_obligatoires.length > 0) {
    const matched = countMatches(allSkills, offre.competences_obligatoires)
    competences_obligatoires = Math.round((matched / offre.competences_obligatoires.length) * 25)
  } else {
    competences_obligatoires = 25
  }

  // 4. Compétences souhaitées — 10 pts
  let competences_souhaitees = 0
  if (offre.competences_souhaitees.length > 0) {
    const matched = countMatches(allSkills, offre.competences_souhaitees)
    competences_souhaitees = Math.round((matched / offre.competences_souhaitees.length) * 10)
  } else {
    competences_souhaitees = 10
  }

  // 5. Langues requises — 10 pts
  let langues = 0
  if (offre.langues.length > 0) {
    const matched = countMatches(cv.langues, offre.langues)
    langues = Math.round((matched / offre.langues.length) * 10)
  } else {
    langues = 10
  }

  // 6. Certifications & logiciels — 8 pts
  let certifications = 0
  const targetExtra = [...(offre.certifications ?? []), ...(offre.logiciels ?? [])]
  if (targetExtra.length > 0) {
    const matched = countMatches([...cv.certifications, ...cv.competences], targetExtra)
    certifications = Math.round((Math.min(matched, targetExtra.length) / targetExtra.length) * 8)
  } else {
    certifications = 8
  }

  // 7. Stabilité professionnelle — 7 pts (moyenne durée par poste)
  let stabilite = 4 // neutral si pas de données
  if (cv.experiences.length > 0) {
    const dureesMois = cv.experiences
      .map(e => parseDureeEnMois(e.duree ?? ''))
      .filter(d => d > 0)
    if (dureesMois.length > 0) {
      const moyenne = dureesMois.reduce((a, b) => a + b, 0) / dureesMois.length
      if (moyenne >= 24) stabilite = 7       // ≥ 2 ans : excellent
      else if (moyenne >= 12) stabilite = 5  // 1-2 ans : bon
      else if (moyenne >= 6) stabilite = 3   // 6-12 mois : moyen
      else stabilite = 1                      // < 6 mois : faible
    }
  }

  const total = Math.min(100, Math.max(0,
    diplome + experience + competences_obligatoires + competences_souhaitees + langues + certifications + stabilite
  ))

  let categorie: ScoreDetail['categorie']
  if (total >= 90) categorie = 'Exceptionnel'
  else if (total >= 80) categorie = 'Excellent'
  else if (total >= 70) categorie = 'Bon'
  else if (total >= 60) categorie = 'Moyen'
  else categorie = 'Faible'

  return { diplome, experience, competences_obligatoires, competences_souhaitees, langues, certifications, stabilite, total, categorie }
}
