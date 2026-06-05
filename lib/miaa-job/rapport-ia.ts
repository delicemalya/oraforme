import Anthropic from '@anthropic-ai/sdk'
import type { CVData, OffreCriteres } from './cv-analyzer'
import type { ScoreDetail } from './scoring'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface RapportIA {
  forces: string[]
  faiblesses: string[]
  risques: string[]
  potentiel: string
  compatibilite_poste: number
  recommandation: 'Très recommandé' | 'Recommandé' | 'À considérer' | 'Non recommandé'
  justification: string
  prediction_performance: string
  risque_depart: string
}

export async function genererRapportIA(
  cv: CVData,
  offre: OffreCriteres & { titre?: string },
  score: ScoreDetail
): Promise<RapportIA> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `Tu es un recruteur senior international.
Génère un rapport RH complet en JSON :
{
  forces: [],
  faiblesses: [],
  risques: [],
  potentiel: string,
  compatibilite_poste: number,
  recommandation: "Très recommandé" | "Recommandé" | "À considérer" | "Non recommandé",
  justification: string,
  prediction_performance: string,
  risque_depart: string
}
Réponds UNIQUEMENT avec le JSON.
Aucun texte avant ou après.`,
    messages: [{
      role: 'user',
      content: JSON.stringify({
        candidat: {
          nom: cv.nom,
          prenom: cv.prenom,
          diplomes: cv.diplomes,
          annees_experience: cv.annees_experience_total,
          niveau_etudes: cv.niveau_etudes,
          competences: cv.competences.slice(0, 20),
          langues: cv.langues,
          certifications: cv.certifications,
          nb_postes: cv.experiences.length,
        },
        offre: {
          titre: offre.titre ?? 'Poste',
          experience_min: offre.experience_min,
          diplome_requis: offre.diplome_requis,
          competences_obligatoires: offre.competences_obligatoires,
          langues: offre.langues,
        },
        score_total: score.total,
        categorie: score.categorie,
        details: {
          diplome: `${score.diplome}/20`,
          experience: `${score.experience}/20`,
          competences: `${score.competences_obligatoires}/25`,
          competences_souhaitees: `${score.competences_souhaitees}/10`,
          langues: `${score.langues}/10`,
          certifications: `${score.certifications}/8`,
          stabilite: `${score.stabilite}/7`,
        },
      }),
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Rapport JSON invalide')
  return JSON.parse(jsonMatch[0]) as RapportIA
}
