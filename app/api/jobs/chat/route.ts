import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-server'

export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { messages, tenantId } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    tenantId?: string
  }
  if (!messages?.length) return NextResponse.json({ error: 'Messages requis' }, { status: 400 })

  let context = ''
  if (tenantId) {
    const [{ count: nbOffres }, { count: nbCands }, { data: top3 }] = await Promise.all([
      supabaseAdmin.from('offres_emploi').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'active'),
      supabaseAdmin.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('candidats').select('nom, prenom, score_global').eq('tenant_id', tenantId).gt('score_global', 0).order('score_global', { ascending: false }).limit(3),
    ])
    const top3Str = (top3 ?? []).map(c => `${c.prenom ?? ''} ${c.nom ?? ''} (${c.score_global}/100)`).join(', ') || 'aucun scoré'
    context = `\n\nContexte : ${nbOffres ?? 0} offres actives, ${nbCands ?? 0} candidatures totales. Top 3 candidats : ${top3Str}.`
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `Tu es MIAA+ Recrutement — recruteur senior international intégré dans Oraforme.
Tu as accès à toutes les candidatures, CV analysés, scores et rapports.
Tu peux analyser, comparer, recommander et assister les entretiens.
Réponds en texte clair. Pas de markdown.
Pas d'astérisques ni tirets.${context}`,
    messages,
  })

  const text = response.content[0].type === 'text'
    ? response.content[0].text
    : 'Je suis momentanément indisponible. Réessayez.'
  return NextResponse.json({ response: text })
}
