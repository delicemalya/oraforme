import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const SYSTEM_PROMPT = `Tu es un expert RH senior. Analyse le CV fourni et retourne UNIQUEMENT un objet JSON valide, sans markdown, sans explication, sans balise de code. Le JSON doit respecter exactement cette structure :
{
  "nom": "string",
  "email": "string ou vide",
  "telephone": "string ou vide",
  "niveau_etudes": "Licence" | "Master" | "Doctorat" | "BTS" | "BAC" | "Autre",
  "annees_experience": number,
  "langues": ["string"],
  "competences": ["string"],
  "score": number entre 0 et 100,
  "resume_court": "2-3 phrases résumant le profil",
  "points_forts": ["string"],
  "points_faibles": ["string"],
  "recommande": boolean
}
Sois objectif, précis et rigoureux. Le score doit refléter l'adéquation réelle avec les critères.`

export async function POST(req: NextRequest) {
  try {
    const { cvText, criteres, offreId, tenantId, fichierUrl, offreTitre } = await req.json() as {
      cvText: string
      criteres?: Record<string, unknown>
      offreId?: string
      tenantId: string
      fichierUrl?: string
      offreTitre?: string
    }

    if (!cvText?.trim()) {
      return NextResponse.json({ error: 'Texte du CV manquant.' }, { status: 400 })
    }

    const criteresText = criteres
      ? `Critères du poste "${offreTitre ?? 'Non spécifié'}" :\n${JSON.stringify(criteres, null, 2)}`
      : 'Aucun critère spécifique — évalue le profil général.'

    const userMessage = `${criteresText}\n\nCV à analyser :\n${cvText}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()

    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(cleaned)
    } catch {
      console.error('[cv/analyze] JSON parse failed:', raw)
      return NextResponse.json({ error: 'La réponse IA est invalide. Réessayez.' }, { status: 500 })
    }

    const { data: candidat, error: dbErr } = await supabaseAdmin
      .from('cv_candidats')
      .insert({
        tenant_id: tenantId,
        offre_id: offreId ?? null,
        nom: String(analysis.nom ?? 'Inconnu'),
        email: String(analysis.email ?? ''),
        telephone: String(analysis.telephone ?? ''),
        niveau_etudes: String(analysis.niveau_etudes ?? 'Autre'),
        annees_experience: Number(analysis.annees_experience ?? 0),
        langues: Array.isArray(analysis.langues) ? analysis.langues : [],
        competences: Array.isArray(analysis.competences) ? analysis.competences : [],
        score: Math.min(100, Math.max(0, Number(analysis.score ?? 0))),
        resume_court: String(analysis.resume_court ?? ''),
        points_forts: Array.isArray(analysis.points_forts) ? analysis.points_forts : [],
        points_faibles: Array.isArray(analysis.points_faibles) ? analysis.points_faibles : [],
        recommande: Boolean(analysis.recommande),
        statut: 'nouveau',
        fichier_url: fichierUrl ?? null,
      })
      .select()
      .single()

    if (dbErr) {
      console.error('[cv/analyze] DB:', dbErr)
      return NextResponse.json({ error: 'Erreur lors de la sauvegarde.' }, { status: 500 })
    }

    return NextResponse.json({ candidat })
  } catch (err) {
    console.error('[cv/analyze]', err)
    return NextResponse.json({ error: "Erreur lors de l'analyse." }, { status: 500 })
  }
}
