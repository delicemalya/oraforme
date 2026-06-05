import Anthropic from '@anthropic-ai/sdk'
import type { CVData, OffreCriteres } from './cv-analyzer'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface QuestionsEntretien {
  questions_generales: string[]
  questions_techniques: string[]
  cas_pratiques: string[]
  tests_metier: string[]
  criteres_evaluation: {
    communication: string
    technique: string
    leadership: string
  }
}

export interface PredictionPerformance {
  potentiel_reussite: number
  risque_depart_12mois: number
  risque_echec_essai: number
  niveau_adaptation: 'Élevé' | 'Moyen' | 'Faible'
  recommandation: 'Embaucher' | "Liste d'attente" | 'Rejeter'
  justification: string
}

export async function genererQuestionsEntretien(
  cv: CVData,
  offre: OffreCriteres & { titre?: string },
): Promise<QuestionsEntretien> {
  const context = `Poste : ${offre.titre ?? 'Non précisé'}
Compétences requises : ${offre.competences_obligatoires.join(', ') || 'Non précisées'}
Expérience min : ${offre.experience_min} ans
Diplôme requis : ${offre.diplome_requis ?? 'Non précisé'}

Candidat : ${cv.prenom ?? ''} ${cv.nom ?? ''}
Niveau : ${cv.niveau_etudes ?? 'Non précisé'}
Expérience : ${cv.annees_experience_total} ans
Compétences : ${cv.competences.join(', ') || 'Non précisées'}
Diplômes : ${cv.diplomes.join(', ') || 'Non précisés'}
Langues : ${cv.langues.join(', ') || 'Non précisées'}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `Tu es un recruteur senior international.
Génère des questions d'entretien adaptées au poste et au profil du candidat.
Réponds UNIQUEMENT en JSON strict.`,
    messages: [{
      role: 'user',
      content: `${context}

Génère exactement ce JSON (5 questions générales, 4 techniques, 3 cas pratiques, 3 tests métier) :
{
  "questions_generales": ["question1","question2","question3","question4","question5"],
  "questions_techniques": ["question1","question2","question3","question4"],
  "cas_pratiques": ["mise en situation 1","mise en situation 2","mise en situation 3"],
  "tests_metier": ["exercice 1","exercice 2","exercice 3"],
  "criteres_evaluation": {
    "communication": "Observer si le candidat...",
    "technique": "Vérifier que le candidat...",
    "leadership": "Évaluer si le candidat..."
  }
}`,
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  return JSON.parse(clean) as QuestionsEntretien
}

export function calculerPrediction(scoreCv: number, scoreEntretien: number): PredictionPerformance {
  const global = Math.round(scoreCv * 0.4 + scoreEntretien * 0.6)

  const potentiel = Math.min(95, Math.max(20, global))
  const risqueDepart = Math.max(5, Math.min(75, 85 - global + 10))
  const risqueEchec = Math.max(5, Math.min(70, 80 - global))

  const niveauAdaptation: 'Élevé' | 'Moyen' | 'Faible' =
    global >= 70 ? 'Élevé' : global >= 50 ? 'Moyen' : 'Faible'

  const recommandation: 'Embaucher' | "Liste d'attente" | 'Rejeter' =
    global >= 70 ? 'Embaucher' : global >= 55 ? "Liste d'attente" : 'Rejeter'

  const justification = `Score CV : ${scoreCv}/100 (pondération 40%). Score entretien : ${scoreEntretien}/100 (pondération 60%). Score global : ${global}/100. Niveau d'adaptation prédit : ${niveauAdaptation}.`

  return {
    potentiel_reussite: potentiel,
    risque_depart_12mois: risqueDepart,
    risque_echec_essai: risqueEchec,
    niveau_adaptation: niveauAdaptation,
    recommandation,
    justification,
  }
}
