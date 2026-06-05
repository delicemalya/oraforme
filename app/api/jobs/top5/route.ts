import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerScore } from '@/lib/miaa-job/scoring'
import type { OffreCriteres, CVData } from '@/lib/miaa-job/cv-analyzer'

export const maxDuration = 30

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
  // Prioritize full CVData from AI analysis if available
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

export async function GET(req: NextRequest) {
  const offreId = req.nextUrl.searchParams.get('offreId')
  if (!offreId) return NextResponse.json({ error: 'offreId requis' }, { status: 400 })

  const { data: offre } = await supabaseAdmin
    .from('offres_emploi')
    .select('id, titre, competences_obligatoires, competences_souhaitees, langues, certifications, logiciels, experience_min, diplome_requis')
    .eq('id', offreId)
    .maybeSingle()

  if (!offre) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })

  const offreCriteres: OffreCriteres = {
    competences_obligatoires: offre.competences_obligatoires ?? [],
    competences_souhaitees: offre.competences_souhaitees ?? [],
    langues: offre.langues ?? [],
    certifications: offre.certifications ?? [],
    logiciels: offre.logiciels ?? [],
    experience_min: offre.experience_min ?? 0,
    diplome_requis: offre.diplome_requis ?? null,
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
    return NextResponse.json({
      top5: [],
      comparaison: [],
      offre: { id: offre.id, titre: offre.titre },
      total: 0,
    })
  }

  const scored = candidatures.map(c => {
    const candidat = c.candidats as unknown as CandidatDB | null
    const rapportIa = c.rapport_ia as { cv_analyse?: CVData } | null
    const cvData = buildCVData(candidat, rapportIa)
    const scoreDetail = calculerScore(cvData, offreCriteres)

    return {
      candidatureId: c.id,
      candidatId: candidat?.id ?? null,
      nom: cvData.nom,
      prenom: cvData.prenom,
      email: cvData.email,
      statut: c.statut,
      created_at: c.created_at,
      cvData,
      scoreDetail,
      score: scoreDetail.total,
    }
  })

  const top5 = scored.sort((a, b) => b.score - a.score).slice(0, 5)

  const comparaison = top5.map((c, i) => ({
    rank: i + 1,
    candidat: [c.prenom, c.nom].filter(Boolean).join(' ') || 'Anonyme',
    score: c.score,
    categorie: c.scoreDetail.categorie,
    diplome:    { pts: c.scoreDetail.diplome,                  max: 20, valeurs: c.cvData.diplomes },
    experience: { pts: c.scoreDetail.experience,               max: 20, annees: c.cvData.annees_experience_total },
    competences:{ pts: c.scoreDetail.competences_obligatoires, max: 25, nb: c.cvData.competences.length },
    souhaitees: { pts: c.scoreDetail.competences_souhaitees,   max: 10 },
    langues:    { pts: c.scoreDetail.langues,                  max: 10, valeurs: c.cvData.langues },
    certifications: { pts: c.scoreDetail.certifications,       max: 8,  valeurs: c.cvData.certifications },
    stabilite:  { pts: c.scoreDetail.stabilite,                max: 7 },
  }))

  return NextResponse.json({
    top5,
    comparaison,
    offre: { id: offre.id, titre: offre.titre },
    total: candidatures.length,
  })
}
