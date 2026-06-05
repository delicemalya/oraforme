import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerScore } from '@/lib/miaa-job/scoring'
import { genererRapportIA } from '@/lib/miaa-job/rapport-ia'
import type { OffreCriteres, CVData } from '@/lib/miaa-job/cv-analyzer'

export const maxDuration = 60

interface CandidatDB {
  id: string
  nom: string | null
  prenom: string | null
  email: string | null
  competences: string[] | null
  diplomes: string[] | null
  langues: string[] | null
  certifications: string[] | null
  annees_experience: number | null
  niveau_etudes: string | null
}

function buildCVData(candidat: CandidatDB | null, rapportIa: { cv_analyse?: CVData } | null): CVData {
  if (rapportIa?.cv_analyse) return rapportIa.cv_analyse
  return {
    nom: candidat?.nom ?? null,
    prenom: candidat?.prenom ?? null,
    email: candidat?.email ?? null,
    telephone: null,
    adresse: null,
    formation: null,
    diplomes: candidat?.diplomes ?? [],
    experiences: [],
    certifications: candidat?.certifications ?? [],
    langues: candidat?.langues ?? [],
    competences: candidat?.competences ?? [],
    annees_experience_total: candidat?.annees_experience ?? 0,
    niveau_etudes: candidat?.niveau_etudes ?? null,
    references: [],
  }
}

export async function POST(req: NextRequest) {
  const { offreId } = await req.json() as { offreId?: string }
  if (!offreId) return NextResponse.json({ error: 'offreId requis' }, { status: 400 })

  const { data: offre } = await supabaseAdmin
    .from('offres_emploi')
    .select('id, titre, competences_obligatoires, competences_souhaitees, langues, certifications, logiciels, experience_min, diplome_requis')
    .eq('id', offreId)
    .maybeSingle()

  if (!offre) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })

  const offreCriteres: OffreCriteres & { titre: string } = {
    competences_obligatoires: offre.competences_obligatoires ?? [],
    competences_souhaitees: offre.competences_souhaitees ?? [],
    langues: offre.langues ?? [],
    certifications: offre.certifications ?? [],
    logiciels: offre.logiciels ?? [],
    experience_min: offre.experience_min ?? 0,
    diplome_requis: offre.diplome_requis ?? null,
    titre: offre.titre ?? 'Poste',
  }

  const { data: candidatures } = await supabaseAdmin
    .from('candidatures')
    .select(`
      id, statut, created_at, rapport_ia,
      candidats(id, nom, prenom, email, competences, diplomes, langues, certifications, annees_experience, niveau_etudes)
    `)
    .eq('offre_id', offreId)
    .neq('statut', 'rejete')

  if (!candidatures || candidatures.length === 0) {
    return NextResponse.json({ error: 'Aucun candidat pour cette offre' }, { status: 404 })
  }

  // Score tous les candidats et trier
  const scored = candidatures
    .map(c => {
      const candidat = c.candidats as unknown as CandidatDB | null
      const rapportIa = c.rapport_ia as { cv_analyse?: CVData } | null
      const cvData = buildCVData(candidat, rapportIa)
      const scoreDetail = calculerScore(cvData, offreCriteres)
      return {
        candidatureId: c.id,
        candidatId: candidat?.id ?? null,
        nom: cvData.nom,
        prenom: cvData.prenom,
        cvData,
        scoreDetail,
        score: scoreDetail.total,
      }
    })
    .sort((a, b) => b.score - a.score)

  const top5 = scored.slice(0, 5)
  const meilleur = top5[0]
  const nomComplet = [meilleur.prenom, meilleur.nom].filter(Boolean).join(' ') || 'Ce candidat'

  // Rapport IA complet pour le meilleur candidat seulement
  let rapport = null
  try {
    rapport = await genererRapportIA(meilleur.cvData, offreCriteres, meilleur.scoreDetail)
  } catch {
    // best-effort, rapport reste null si Claude indisponible
  }

  const justificationFinale = rapport?.justification
    ?? `Après analyse de ${candidatures.length} candidature${candidatures.length > 1 ? 's' : ''}, ${nomComplet} présente la meilleure adéquation avec le poste « ${offre.titre ?? ''} » avec un score de ${meilleur.score}/100 (${meilleur.scoreDetail.categorie}).`

  return NextResponse.json({
    meilleur_candidat: {
      candidatureId: meilleur.candidatureId,
      candidatId: meilleur.candidatId,
      nom: meilleur.nom,
      prenom: meilleur.prenom,
      score: meilleur.score,
      categorie: meilleur.scoreDetail.categorie,
      scoreDetail: meilleur.scoreDetail,
    },
    rapport,
    justification_finale: justificationFinale,
    total_analyses: candidatures.length,
    classement: top5.map((c, i) => ({
      rank: i + 1,
      candidat: [c.prenom, c.nom].filter(Boolean).join(' ') || 'Anonyme',
      score: c.score,
      categorie: c.scoreDetail.categorie,
    })),
  })
}
