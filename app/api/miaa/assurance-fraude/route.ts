import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Scoring rules ─────────────────────────────────────────────────────────────

interface FraudeScore {
  score: number
  niveau: 'faible' | 'moyen' | 'eleve'
  facteurs: string[]
}

function computeRuleScore(s: {
  date_declaration: string
  date_survenance:  string | null
  montant_estime:   number
  created_at:       string
  type_sinistre:    string | null
  description:      string | null
  sinistres_client: number
  montant_moyen_branche: number
  duree_police_jours: number
}): FraudeScore {
  let score = 0
  const facteurs: string[] = []

  // 1. Délai déclaration / survenance
  if (s.date_survenance) {
    const decl = new Date(s.date_declaration)
    const surv = new Date(s.date_survenance)
    const jours = Math.max(0, (decl.getTime() - surv.getTime()) / 86400000)
    if (jours > 30) { score += 35; facteurs.push(`Déclaration très tardive : ${Math.round(jours)} jours après la survenance (+35)`) }
    else if (jours > 15) { score += 20; facteurs.push(`Déclaration tardive : ${Math.round(jours)} jours après la survenance (+20)`) }
  }

  // 2. Montant vs moyenne historique branche
  if (s.montant_moyen_branche > 0) {
    const ratio = s.montant_estime / s.montant_moyen_branche
    if (ratio > 3) { score += 40; facteurs.push(`Montant ${ratio.toFixed(1)}× la moyenne de la branche (+40)`) }
    else if (ratio > 2) { score += 25; facteurs.push(`Montant ${ratio.toFixed(1)}× la moyenne de la branche (+25)`) }
  }

  // 3. Fréquence sinistres client
  if (s.sinistres_client >= 5) { score += 35; facteurs.push(`${s.sinistres_client} sinistres déclarés au total (+35)`) }
  else if (s.sinistres_client >= 3) { score += 20; facteurs.push(`${s.sinistres_client} sinistres déclarés au total (+20)`) }

  // 4. Police très récente
  if (s.duree_police_jours < 90) {
    score += 20
    facteurs.push(`Police souscrite il y a ${s.duree_police_jours} jours seulement (+20)`)
  }

  // 5. Description vague
  const desc = (s.description ?? '').trim()
  if (desc.length < 30) { score += 15; facteurs.push('Description très courte ou vague (+15)') }

  return {
    score: Math.min(score, 100),
    niveau: score < 31 ? 'faible' : score < 61 ? 'moyen' : 'eleve',
    facteurs,
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sinistre_id } = body as { sinistre_id: string }

    if (!sinistre_id) return NextResponse.json({ error: 'sinistre_id requis' }, { status: 400 })

    const db = getSupabase()

    // Fetch sinistre + police
    const { data: sinistre, error: sinErr } = await db
      .from('ass_sinistres')
      .select('*, ass_polices(type_police, prime_montant, date_effet, assure_nom)')
      .eq('id', sinistre_id)
      .single()

    if (sinErr || !sinistre) return NextResponse.json({ error: 'Sinistre introuvable' }, { status: 404 })

    // Nb sinistres du même assuré
    const { count: nbSinistres } = await db
      .from('ass_sinistres')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', sinistre.tenant_id)

    // Montant moyen pour ce type de police
    const { data: moyenneData } = await db
      .from('ass_sinistres')
      .select('montant_estime')
      .eq('tenant_id', sinistre.tenant_id)
      .not('montant_estime', 'is', null)

    const moyennes = moyenneData ?? []
    const montantMoyen = moyennes.length > 0
      ? moyennes.reduce((s, x) => s + (x.montant_estime ?? 0), 0) / moyennes.length
      : 0

    // Durée police
    const dateEffet = sinistre.ass_polices?.date_effet
    const dureePoliceDays = dateEffet
      ? Math.floor((Date.now() - new Date(dateEffet).getTime()) / 86400000)
      : 999

    const { score, niveau, facteurs } = computeRuleScore({
      date_declaration:      sinistre.date_declaration,
      date_survenance:       sinistre.date_survenance,
      montant_estime:        sinistre.montant_estime ?? 0,
      created_at:            sinistre.created_at,
      type_sinistre:         sinistre.type_sinistre,
      description:           sinistre.description,
      sinistres_client:      nbSinistres ?? 0,
      montant_moyen_branche: montantMoyen,
      duree_police_jours:    dureePoliceDays,
    })

    // IA qualitative (Haiku — rapide et économique)
    let justification = ''
    let recommandation = ''

    if (anthropic && sinistre.description) {
      const prompt = `Tu es MIAA Expert Assurance. Analyse ce dossier sinistre et donne une recommandation courte (3-4 phrases max).

Sinistre : ${sinistre.numero_sinistre ?? 'N/A'}
Type : ${sinistre.type_sinistre ?? 'Non précisé'}
Description : ${sinistre.description}
Montant estimé : ${sinistre.montant_estime ?? 0} FCFA
Date survenance : ${sinistre.date_survenance ?? 'Non précisée'}
Date déclaration : ${sinistre.date_declaration}
Score de fraude (règles) : ${score}/100 — Niveau ${niveau}
Facteurs détectés : ${facteurs.join(' | ') || 'Aucun'}

Réponds avec :
RECOMMANDATION: [accepter / investiguer / expertise / refuser]
JUSTIFICATION: [analyse en 2-3 phrases, sans markdown]`

      try {
        const aiRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        })
        const txt = (aiRes.content[0] as { text: string }).text
        const rMatch = txt.match(/RECOMMANDATION:\s*(.+)/i)
        const jMatch = txt.match(/JUSTIFICATION:\s*([\s\S]+)/i)
        recommandation = rMatch?.[1]?.trim() ?? 'Expertise recommandée'
        justification  = jMatch?.[1]?.trim() ?? txt.trim()
      } catch {
        recommandation = niveau === 'faible' ? 'Accepter' : niveau === 'moyen' ? 'Investiguer' : 'Expertise obligatoire'
        justification  = `Score de fraude ${score}/100. ${facteurs.join('. ')}`
      }
    } else {
      recommandation = niveau === 'faible' ? 'Accepter' : niveau === 'moyen' ? 'Investiguer' : 'Expertise obligatoire'
      justification  = facteurs.length > 0 ? facteurs.join('. ') : 'Aucun signal de fraude détecté.'
    }

    return NextResponse.json({ score, niveau, facteurs, justification, recommandation })
  } catch (e) {
    console.error('[assurance-fraude]', e)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
