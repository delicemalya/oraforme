import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function getRestoKPIs(tenantId: string) {
  const today      = new Date().toISOString().split('T')[0]
  const mois       = new Date().getMonth() + 1
  const annee      = new Date().getFullYear()
  const dDebut     = `${annee}-${String(mois).padStart(2,'0')}-01`

  const [
    { data: caToday },
    { data: caMois },
    { count: nbCmdToday },
    { count: nbCmdEnCours },
    { count: nbLivraisonsEnCours },
    { data: platsRentables },
    { data: stocksBas },
    { count: resasAujourd },
  ] = await Promise.all([
    supabaseAdmin.from('transactions').select('montant').eq('tenant_id', tenantId).eq('type', 'entree').eq('source', 'pos').eq('date', today),
    supabaseAdmin.from('transactions').select('montant').eq('tenant_id', tenantId).eq('type', 'entree').eq('source', 'pos').gte('date', dDebut),
    supabaseAdmin.from('resto_commandes').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('created_at', today).neq('statut', 'annule'),
    supabaseAdmin.from('resto_commandes').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('statut', ['en_attente','en_preparation']),
    supabaseAdmin.from('resto_commandes').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('mode', 'livraison').in('statut_livraison', ['en_attente','en_preparation','parti']),
    supabaseAdmin.from('resto_menu').select('nom, prix, cout_production').eq('tenant_id', tenantId).gt('cout_production', 0).limit(5),
    supabaseAdmin.from('stock_articles').select('nom, quantite, seuil_alerte').eq('tenant_id', tenantId).eq('categorie', 'cuisine').limit(20),
    supabaseAdmin.from('resto_reservations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('date_resa', today).eq('statut', 'confirmee'),
  ])

  const sumCA = (a: { montant: number }[] | null) => (a ?? []).reduce((s, r) => s + r.montant, 0)
  const topPlats = (platsRentables ?? []).map(p => ({
    nom: p.nom,
    marge_pct: p.prix > 0 ? Math.round((p.prix - p.cout_production) / p.prix * 100) : 0
  }))
  const stocksCritiques = (stocksBas ?? []).filter(s => s.quantite < s.seuil_alerte)

  return {
    ca_aujourd_hui: sumCA(caToday),
    ca_mois: sumCA(caMois),
    commandes_aujourd_hui: nbCmdToday ?? 0,
    commandes_en_cours: nbCmdEnCours ?? 0,
    livraisons_en_cours: nbLivraisonsEnCours ?? 0,
    reservations_ce_soir: resasAujourd ?? 0,
    top_plats_rentables: topPlats,
    stocks_critiques: stocksCritiques.map(s => s.nom),
  }
}

// POST /api/resto/miaa — chat streaming
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { message, history } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'message requis' }, { status: 400 })

  const kpis = await getRestoKPIs(ctx.tenantId)

  const system = `Tu es MIAA (Module Intelligent d'Aide et d'Analyse), l'assistant IA restaurant d'Oraforme.
Tu aides les restaurateurs en Afrique centrale (Congo, Cameroun, Gabon) à piloter leur établissement.

KPIs EN TEMPS RÉEL (${new Date().toLocaleDateString('fr-FR')}) :
- CA aujourd'hui : ${new Intl.NumberFormat('fr-FR').format(kpis.ca_aujourd_hui)} FCFA
- CA du mois : ${new Intl.NumberFormat('fr-FR').format(kpis.ca_mois)} FCFA
- Commandes du jour : ${kpis.commandes_aujourd_hui}
- Commandes en cours : ${kpis.commandes_en_cours}
- Livraisons en cours : ${kpis.livraisons_en_cours}
- Réservations ce soir : ${kpis.reservations_ce_soir}
- Plats les plus rentables : ${kpis.top_plats_rentables.map(p => `${p.nom} (${p.marge_pct}% marge)`).join(', ') || 'Non configuré'}
- Stocks critiques : ${kpis.stocks_critiques.length > 0 ? kpis.stocks_critiques.join(', ') : 'Aucun'}

Tu réponds en français, de façon concise et actionnable. Tu connais la restauration africaine, les prix en FCFA, la TVA Congo (18,9%), les habitudes culinaires locales.
Si on te parle de rentabilité, utilise les données de marge ci-dessus. Pour les prévisions, base-toi sur les tendances hebdomadaires et mensuelles.`

  const messages = [...(history ?? []), { role: 'user' as const, content: message }]

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6', max_tokens: 1024, system, messages,
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
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}

// GET /api/resto/miaa — briefing journalier
export async function GET(_req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const kpis = await getRestoKPIs(ctx.tenantId)

  const prompt = `Génère un briefing matinal restaurant (6-8 lignes max) basé sur :
${JSON.stringify(kpis, null, 2)}

Format : bullet points professionnels en français.
Inclure : situation du jour, points d'attention, recommandations opérationnelles immédiates (cuisine, stock, service).`

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const briefing = resp.content[0].type === 'text' ? resp.content[0].text : ''
  return NextResponse.json({ briefing, kpis, date: new Date().toISOString() })
}
