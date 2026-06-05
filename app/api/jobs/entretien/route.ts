import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { genererQuestionsEntretien, calculerPrediction } from '@/lib/miaa-job/entretien-generator'
import type { CVData, OffreCriteres } from '@/lib/miaa-job/cv-analyzer'

// ── GET : récupère le rapport complet d'un entretien ────────────────────────
export async function GET(req: NextRequest) {
  const entretienId = req.nextUrl.searchParams.get('entretienId')
  if (!entretienId) return NextResponse.json({ error: 'entretienId requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('entretiens')
    .select(`
      id, statut, date_entretien, note_finale, notes,
      questions_ia, evaluation, rapport_prediction,
      candidature_id,
      candidatures(
        id, statut, score_ia,
        candidats(id, nom, prenom, email, score_global, competences, diplomes, langues, annees_experience, niveau_etudes, cv_url),
        offres_emploi(id, titre, competences_obligatoires, competences_souhaitees, langues, certifications, experience_min, diplome_requis)
      )
    `)
    .eq('id', entretienId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Entretien introuvable' }, { status: 404 })
  return NextResponse.json({ entretien: data })
}

// ── POST : génère les questions IA pour un entretien ────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as { entretienId: string }
  const { entretienId } = body
  if (!entretienId) return NextResponse.json({ error: 'entretienId requis' }, { status: 400 })

  // Fetch entretien + candidat + offre
  const { data, error } = await supabaseAdmin
    .from('entretiens')
    .select(`
      id,
      candidatures(
        candidats(nom, prenom, competences, diplomes, langues, certifications, annees_experience, niveau_etudes, rapport_ia),
        offres_emploi(titre, competences_obligatoires, competences_souhaitees, langues, certifications, experience_min, diplome_requis)
      )
    `)
    .eq('id', entretienId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Entretien introuvable' }, { status: 404 })

  const cand = (data.candidatures as unknown as {
    candidats: {
      nom: string | null; prenom: string | null; competences: string[] | null
      diplomes: string[] | null; langues: string[] | null; certifications: string[] | null
      annees_experience: number | null; niveau_etudes: string | null
      rapport_ia: { cv_analyse?: Partial<CVData> } | null
    } | null
    offres_emploi: {
      titre: string | null; competences_obligatoires: string[] | null
      competences_souhaitees: string[] | null; langues: string[] | null
      certifications: string[] | null; experience_min: number | null; diplome_requis: string | null
    } | null
  } | null)

  if (!cand?.candidats || !cand?.offres_emploi) {
    return NextResponse.json({ error: 'Candidat ou offre introuvable' }, { status: 404 })
  }

  const { candidats: c, offres_emploi: o } = cand
  const rapportCv = c.rapport_ia?.cv_analyse ?? {}

  const cvData: CVData = {
    nom: c.nom,
    prenom: c.prenom,
    email: null,
    telephone: null,
    adresse: null,
    formation: null,
    diplomes: c.diplomes ?? (rapportCv as CVData).diplomes ?? [],
    experiences: (rapportCv as CVData).experiences ?? [],
    certifications: c.certifications ?? (rapportCv as CVData).certifications ?? [],
    langues: c.langues ?? (rapportCv as CVData).langues ?? [],
    competences: c.competences ?? (rapportCv as CVData).competences ?? [],
    annees_experience_total: c.annees_experience ?? (rapportCv as CVData).annees_experience_total ?? 0,
    niveau_etudes: c.niveau_etudes ?? (rapportCv as CVData).niveau_etudes ?? null,
    references: [],
  }

  const offreCriteres: OffreCriteres & { titre?: string } = {
    titre: o.titre ?? undefined,
    competences_obligatoires: o.competences_obligatoires ?? [],
    competences_souhaitees: o.competences_souhaitees ?? [],
    langues: o.langues ?? [],
    certifications: o.certifications ?? [],
    logiciels: [],
    experience_min: o.experience_min ?? 0,
    diplome_requis: o.diplome_requis ?? null,
  }

  const questions = await genererQuestionsEntretien(cvData, offreCriteres)

  // Save questions to entretien
  await supabaseAdmin
    .from('entretiens')
    .update({ questions_ia: questions, statut: 'en_cours' })
    .eq('id', entretienId)

  return NextResponse.json({ questions })
}

// ── PUT : enregistre les notes + calcule le score final ─────────────────────
export async function PUT(req: NextRequest) {
  const body = await req.json() as {
    entretienId: string
    evaluation: { communication: number; technique: number; leadership: number; initiative: number; culture_fit: number }
    notes: string
  }
  const { entretienId, evaluation, notes } = body
  if (!entretienId) return NextResponse.json({ error: 'entretienId requis' }, { status: 400 })

  // Compute entretien score (mean of criteria × 10)
  const values = Object.values(evaluation)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const scoreEntretien = Math.round(mean * 10)

  // Get candidat score_global for prediction
  const { data: entr } = await supabaseAdmin
    .from('entretiens')
    .select('candidatures(candidats(score_global))')
    .eq('id', entretienId)
    .single()

  const scoreCv: number = (entr?.candidatures as unknown as {
    candidats: { score_global: number } | null
  } | null)?.candidats?.score_global ?? 50

  const prediction = calculerPrediction(scoreCv, scoreEntretien)

  // Save everything
  await supabaseAdmin
    .from('entretiens')
    .update({
      evaluation,
      rapport_prediction: prediction,
      note_finale: Math.round(mean),
      notes,
      statut: 'termine',
    })
    .eq('id', entretienId)

  return NextResponse.json({ prediction, scoreEntretien, scoreCv })
}
