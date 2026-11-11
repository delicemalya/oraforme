import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function getHotelKPIs(hotelId: string) {
  const today = new Date().toISOString().split('T')[0]
  const mois  = new Date().getMonth() + 1
  const annee = new Date().getFullYear()
  const dDebut = `${annee}-${String(mois).padStart(2, '0')}-01`

  const [
    { count: nbChambres },
    { count: nbOccupees },
    { count: arrivees },
    { count: departs },
    { data: ca },
    { count: hkPending },
    { count: maintOpen },
  ] = await Promise.all([
    supabaseAdmin.from('htl_rooms').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId),
    supabaseAdmin.from('htl_rooms').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId).eq('statut', 'occupee'),
    supabaseAdmin.from('htl_reservations').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId).eq('date_arrivee', today).not('statut', 'in', '(annulee,no_show)'),
    supabaseAdmin.from('htl_reservations').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId).eq('date_depart', today).eq('statut', 'checkin'),
    supabaseAdmin.from('htl_payments').select('montant').eq('hotel_id', hotelId).gte('created_at', dDebut + 'T00:00:00'),
    supabaseAdmin.from('htl_housekeeping_tasks').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId).eq('date_planif', today).in('statut', ['a_faire','en_cours']),
    supabaseAdmin.from('htl_maintenance_requests').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId).in('statut', ['signale','en_cours']),
  ])

  const caMois = (ca ?? []).reduce((s: number, p: { montant: number }) => s + (p.montant ?? 0), 0)
  const taux   = nbChambres ? Math.round((nbOccupees ?? 0) / nbChambres * 100) : 0

  return {
    taux_occupation: `${taux}%`,
    nb_chambres_total: nbChambres ?? 0,
    nb_occupees: nbOccupees ?? 0,
    arrivees_aujourd_hui: arrivees ?? 0,
    departs_aujourd_hui: departs ?? 0,
    ca_mois_fcfa: caMois,
    housekeeping_en_attente: hkPending ?? 0,
    maintenance_ouverte: maintOpen ?? 0,
    revpar_estime: nbChambres ? Math.round(caMois / (nbChambres * new Date().getDate())) : 0,
  }
}

// POST /api/hotel/miaa — chat MIAA hôtel (streaming)
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { message, history } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'message requis' }, { status: 400 })

  const kpis = await getHotelKPIs(ctx.tenantId)

  const systemPrompt = `Tu es MIAA (Module Intelligent d'Aide et d'Analyse), l'assistant IA spécialisé hôtellerie d'Oraforme.
Tu aides les gestionnaires d'hôtels en Afrique centrale (Congo, Cameroun, Gabon...) à piloter leur établissement.

KPIs EN TEMPS RÉEL (${new Date().toLocaleDateString('fr-FR')}) :
- Taux d'occupation : ${kpis.taux_occupation} (${kpis.nb_occupees}/${kpis.nb_chambres_total} chambres)
- Arrivées aujourd'hui : ${kpis.arrivees_aujourd_hui}
- Départs aujourd'hui : ${kpis.departs_aujourd_hui}
- CA du mois : ${new Intl.NumberFormat('fr-FR').format(kpis.ca_mois_fcfa)} FCFA
- RevPAR estimé : ${new Intl.NumberFormat('fr-FR').format(kpis.revpar_estime)} FCFA/chambre/jour
- Tâches housekeeping en attente : ${kpis.housekeeping_en_attente}
- Maintenances ouvertes : ${kpis.maintenance_ouverte}

Tu réponds toujours en français, de façon concise et actionnable.
Tu connais les standards OHADA, les tarifs habituels en FCFA, et le contexte hôtelier africain.
Si on te demande d'analyser des performances, utilise les KPIs ci-dessus.`

  const messages = [
    ...(history ?? []),
    { role: 'user' as const, content: message },
  ]

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// GET /api/hotel/miaa — briefing journalier automatique
export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const kpis = await getHotelKPIs(ctx.tenantId)

  const prompt = `Génère un briefing matinal hôtelier concis (5-8 lignes maximum) basé sur ces KPIs :
${JSON.stringify(kpis, null, 2)}

Format : bullet points, ton professionnel, en français. Inclure les points d'attention et recommandations immédiates.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ briefing: text, kpis, date: new Date().toISOString() })
}
