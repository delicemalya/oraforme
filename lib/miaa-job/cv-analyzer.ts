import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface CVData {
  nom: string | null
  prenom: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  formation: string | null
  diplomes: string[]
  experiences: {
    poste: string
    entreprise: string
    duree: string
    date_debut: string | null
    date_fin: string | null
    description: string | null
  }[]
  certifications: string[]
  langues: string[]
  competences: string[]
  annees_experience_total: number
  niveau_etudes: string | null
  references: string[]
}

export interface OffreCriteres {
  competences_obligatoires: string[]
  competences_souhaitees: string[]
  langues: string[]
  certifications: string[]
  logiciels: string[]
  experience_min: number
  diplome_requis: string | null
}

export async function analyzeCV(cvText: string): Promise<CVData> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `Tu es un expert RH international.
Analyse ce CV et extrais en JSON strict :
{
  nom, prenom, email, telephone, adresse,
  formation, diplomes: [],
  experiences: [{poste, entreprise, duree,
    date_debut, date_fin, description}],
  certifications: [],
  langues: [],
  competences: [],
  annees_experience_total: number,
  niveau_etudes: string,
  references: []
}
Réponds UNIQUEMENT avec le JSON.
Aucun texte avant ou après.`,
    messages: [{ role: 'user', content: cvText.slice(0, 12000) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude did not return valid JSON')

  const parsed = JSON.parse(jsonMatch[0]) as CVData
  return parsed
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function hasMatch(candidateList: string[], targetList: string[]): boolean {
  return targetList.some(t =>
    candidateList.some(c => normalize(c).includes(normalize(t)) || normalize(t).includes(normalize(c)))
  )
}

function countMatches(candidateList: string[], targetList: string[]): number {
  return targetList.filter(t =>
    candidateList.some(c => normalize(c).includes(normalize(t)) || normalize(t).includes(normalize(c)))
  ).length
}

const DIPLOME_LEVEL: Record<string, number> = {
  'sans diplôme requis': 0,
  'cap/bep': 1,
  'bac': 2,
  'bts/dut': 3,
  'licence': 4,
  'master': 5,
  'mba': 5,
  'doctorat': 6,
}

export function scoreCV(cv: CVData, offre: OffreCriteres): number {
  let score = 0

  // Compétences obligatoires — 40 pts
  const allCvSkills = [...cv.competences, ...cv.certifications]
  if (offre.competences_obligatoires.length > 0) {
    const matched = countMatches(allCvSkills, offre.competences_obligatoires)
    score += Math.round((matched / offre.competences_obligatoires.length) * 40)
  } else {
    score += 40
  }

  // Expérience — 20 pts
  if (offre.experience_min > 0) {
    const ratio = Math.min(cv.annees_experience_total / offre.experience_min, 1)
    score += Math.round(ratio * 20)
  } else {
    score += 20
  }

  // Diplôme — 15 pts
  if (offre.diplome_requis) {
    const reqLevel = DIPLOME_LEVEL[normalize(offre.diplome_requis)] ?? 0
    const cvLevel = Math.max(0, ...cv.diplomes.map(d => DIPLOME_LEVEL[normalize(d)] ?? 0))
    if (cvLevel >= reqLevel) score += 15
    else if (reqLevel > 0 && cvLevel === reqLevel - 1) score += 8
  } else {
    score += 15
  }

  // Langues — 15 pts
  if (offre.langues.length > 0) {
    const matched = countMatches(cv.langues, offre.langues)
    score += Math.round((matched / offre.langues.length) * 15)
  } else {
    score += 15
  }

  // Logiciels + certifications — 10 pts
  const targetExtra = [...(offre.logiciels ?? []), ...(offre.certifications ?? [])]
  if (targetExtra.length > 0) {
    const hasAny = hasMatch(allCvSkills, targetExtra)
    score += hasAny ? 10 : 0
  } else {
    score += 10
  }

  return Math.min(100, Math.max(0, score))
}
