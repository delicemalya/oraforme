import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import Anthropic from '@anthropic-ai/sdk'
import { getHisKPIs } from '../direction/route'

const anthropic = new Anthropic()

function buildSystemPrompt(kpis: Awaited<ReturnType<typeof getHisKPIs>>) {
  return `Tu es MIAA+ (Medical Intelligence Assistance & Analytics), l'IA médicale d'Oraforme HIS.
Tu assistes la direction médicale et les équipes soignantes. Tu analyses les données en temps réel et fournis des recommandations opérationnelles.
Réponds toujours en français. Sois concis, rigoureux, et orienté décisions. Ne donne JAMAIS de diagnostic individuel aux patients — tu analyses les flux, la capacité, les revenus et les alertes organisationnelles.

DONNÉES EN TEMPS RÉEL :
• Patients actifs : ${kpis.patients_actifs}
• Occupation des lits : ${kpis.taux_occupation}% (${kpis.lits_occupes} / ${kpis.lits_total})
• Urgences actives (en soins) : ${kpis.urgences_actives}
• Nouvelles urgences aujourd'hui : ${kpis.urgences_aujourd}
• Séjours en cours : ${kpis.sejours_en_cours}
• Consultations ce mois : ${kpis.consultations_mois}
• CA consultations mois : ${new Intl.NumberFormat('fr-FR').format(kpis.ca_consultations_mois)} FCFA
• Factures impayées : ${new Intl.NumberFormat('fr-FR').format(kpis.factures_impayees)} FCFA
• Examens labo en attente : ${kpis.labo_en_attente}
• Imagerie en attente : ${kpis.imagerie_en_attente}
• Bloc opératoire aujourd'hui : ${kpis.bloc_aujourd}
• Médecins actifs : ${kpis.medecins_actifs}
• Personnel paramédical : ${kpis.personnel_total}`
}

export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const kpis = await getHisKPIs(ctx.tenantId)
  const sys  = buildSystemPrompt(kpis)

  const msg = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 800,
    system:     sys,
    messages:   [{ role: 'user', content: 'Génère le briefing médical et managérial du jour. Structure en 4 sections : SITUATION DU JOUR, ACTIVITÉ MÉDICALE, EXAMENS & ATTENTES, FINANCES & ALERTES.' }],
  })

  const briefing = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return NextResponse.json({ briefing, kpis })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { message, history = [] } = await req.json()
  if (!message) return NextResponse.json({ error: 'message requis' }, { status: 400 })

  const kpis = await getHisKPIs(ctx.tenantId)
  const sys  = buildSystemPrompt(kpis)

  const msgs = [
    ...history.map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ]

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        const s = anthropic.messages.stream({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: sys, messages: msgs })
        for await (const chunk of s) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
          }
        }
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
      } catch {
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
