import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerScore } from '@/lib/miaa-job/scoring'
import { genererRapportIA } from '@/lib/miaa-job/rapport-ia'
import type { OffreCriteres, CVData } from '@/lib/miaa-job/cv-analyzer'

export const maxDuration = 30

type OffreRow = {
  titre: string
  competences_obligatoires: string[] | null
  competences_souhaitees: string[] | null
  langues: string[] | null
  certifications: string[] | null
  logiciels: string[] | null
  experience_min: number | null
  diplome_requis: string | null
}

type CandidatRow = {
  nom: string | null
  prenom: string | null
  competences: string[] | null
  diplomes: string[] | null
  langues: string[] | null
  certifications: string[] | null
  annees_experience: number | null
  niveau_etudes: string | null
}

export async function GET(req: NextRequest) {
  const candidatureId = req.nextUrl.searchParams.get('candidatureId')
  if (!candidatureId) return NextResponse.json({ error: 'candidatureId requis' }, { status: 400 })

  const { data: c } = await supabaseAdmin
    .from('candidatures')
    .select(`
      id, score_ia, rapport_ia,
      candidats(nom, prenom, competences, diplomes, langues, certifications, annees_experience, niveau_etudes),
      offres_emploi(titre, competences_obligatoires, competences_souhaitees, langues, certifications, logiciels, experience_min, diplome_requis)
    `)
    .eq('id', candidatureId)
    .maybeSingle()

  if (!c) return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 })

  const offre = c.offres_emploi as unknown as OffreRow | null
  const candidat = c.candidats as unknown as CandidatRow | null
  const rapportIa = c.rapport_ia as { cv_analyse?: CVData } | null

  const cvData: CVData = rapportIa?.cv_analyse ?? {
    nom: candidat?.nom ?? null,
    prenom: candidat?.prenom ?? null,
    email: null,
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

  const offreCriteres: OffreCriteres & { titre?: string } = {
    competences_obligatoires: offre?.competences_obligatoires ?? [],
    competences_souhaitees: offre?.competences_souhaitees ?? [],
    langues: offre?.langues ?? [],
    certifications: offre?.certifications ?? [],
    logiciels: offre?.logiciels ?? [],
    experience_min: offre?.experience_min ?? 0,
    diplome_requis: offre?.diplome_requis ?? null,
    titre: offre?.titre,
  }

  const scoreDetail = calculerScore(cvData, offreCriteres)
  let rapport = null
  try {
    rapport = await genererRapportIA(cvData, offreCriteres, scoreDetail)
  } catch {
    // best-effort — rapport reste null si Claude indisponible
  }

  return NextResponse.json({
    rapport,
    scoreDetail,
    candidat: { nom: candidat?.nom, prenom: candidat?.prenom },
    offreTitre: offre?.titre ?? null,
  })
}
