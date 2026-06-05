import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { parseCV } from '@/lib/miaa-job/cv-parser'
import { analyzeCV, scoreCV, type OffreCriteres } from '@/lib/miaa-job/cv-analyzer'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    let cvText: string | null = null
    let candidatId: string | null = null
    let candidatureId: string | null = null

    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      candidatId = formData.get('candidatId') as string | null
      candidatureId = formData.get('candidatureId') as string | null

      if (!file || file.size === 0) {
        return NextResponse.json({ error: 'Fichier CV manquant.' }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      cvText = await parseCV(buffer, file.name)
    } else {
      const body = await req.json() as { cvText?: string; candidatId?: string; candidatureId?: string }
      cvText = body.cvText ?? null
      candidatId = body.candidatId ?? null
      candidatureId = body.candidatureId ?? null
    }

    if (!cvText || cvText.length < 20) {
      return NextResponse.json({ error: 'Texte CV trop court ou illisible.' }, { status: 400 })
    }
    if (!candidatId || !candidatureId) {
      return NextResponse.json({ error: 'candidatId et candidatureId requis.' }, { status: 400 })
    }

    // Fetch candidature + offre criteria for scoring
    const { data: candidature } = await supabaseAdmin
      .from('candidatures')
      .select('id, offre_id, offres_emploi(competences_obligatoires, competences_souhaitees, langues, certifications, logiciels, experience_min, diplome_requis)')
      .eq('id', candidatureId)
      .maybeSingle()

    const offreRaw = candidature?.offres_emploi as unknown as OffreCriteres | null
    const offreCriteres: OffreCriteres = {
      competences_obligatoires: offreRaw?.competences_obligatoires ?? [],
      competences_souhaitees: offreRaw?.competences_souhaitees ?? [],
      langues: offreRaw?.langues ?? [],
      certifications: offreRaw?.certifications ?? [],
      logiciels: offreRaw?.logiciels ?? [],
      experience_min: offreRaw?.experience_min ?? 0,
      diplome_requis: offreRaw?.diplome_requis ?? null,
    }

    // Analyze CV with Claude Haiku
    const cvData = await analyzeCV(cvText)

    // Score CV against offer
    const scoreIa = scoreCV(cvData, offreCriteres)

    // Update candidat record with all extracted CV fields
    await supabaseAdmin
      .from('candidats')
      .update({
        nom: cvData.nom ?? undefined,
        prenom: cvData.prenom ?? undefined,
        email: cvData.email ?? undefined,
        telephone: cvData.telephone ?? undefined,
        competences: cvData.competences,
        diplomes: cvData.diplomes,
        langues: cvData.langues,
        certifications: cvData.certifications,
        annees_experience: cvData.annees_experience_total,
        niveau_etudes: cvData.niveau_etudes ?? undefined,
        score_global: scoreIa,
        cv_raw_text: cvText,
        refs_pro: cvData.references ?? [],
      })
      .eq('id', candidatId)

    // Update candidature with IA score and rapport
    await supabaseAdmin
      .from('candidatures')
      .update({
        score_ia: scoreIa,
        rapport_ia: {
          cv_analyse: cvData,
          scored_at: new Date().toISOString(),
        },
      })
      .eq('id', candidatureId)

    return NextResponse.json({ success: true, score: scoreIa, cvData })
  } catch (err) {
    console.error('[api/jobs/analyser-cv]', err)
    return NextResponse.json({ error: 'Erreur analyse CV.' }, { status: 500 })
  }
}
