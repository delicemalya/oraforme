import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { chargerMemoireMIAA } from '@/lib/miaa/memory'
import { genererNotifications, sauvegarderNotifications } from '@/lib/miaa/notifications'
import { EXPERTS } from '@/lib/miaa/experts'

export const runtime = 'nodejs'
export const maxDuration = 300

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Vérifie le header cron Vercel pour sécuriser la route
function isCronAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}` ||
    req.headers.get('x-vercel-cron') === '1' ||
    process.env.NODE_ENV === 'development'
}

// ── Actions autonomes par jour du mois ────────────────────────────────────────

async function genererBulletinsPaie(supabase: ReturnType<typeof getSupabase>, tenantId: string): Promise<string> {
  const { data: employes } = await supabase
    .from('employes')
    .select('id, prenom, nom, salaire_brut')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif')
    .limit(50)

  if (!employes?.length) return 'Aucun employé actif trouvé.'

  const now = new Date()
  const moisNom = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'][now.getMonth()]

  const prompt = `${EXPERTS.rh}\n\nListe des employés :\n${JSON.stringify(employes)}\n\nMois : ${moisNom} ${now.getFullYear()}\n\nGénère un résumé de la masse salariale du mois avec les totaux CNSS, IRPP, net à payer, charges patronales. Format texte clair.`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  return res.content[0].type === 'text' ? res.content[0].text : ''
}

async function genererRapportMensuel(supabase: ReturnType<typeof getSupabase>, tenantId: string): Promise<string> {
  const memory = await chargerMemoireMIAA(supabase, tenantId)
  const { entreprise: e, donnees_live: d } = memory
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
  const now = new Date()
  const moisPrec = ['décembre','janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre'][now.getMonth()]

  const prompt = `${EXPERTS.general}\n\nRapport mensuel automatique — ${moisPrec} ${now.getFullYear()}\n\nEntreprise : ${e.nom} (${e.secteur})\nSolde trésorerie : ${fmt(d.solde_tresorerie)} FCFA\nCA du mois : ${fmt(d.ca_mois)} FCFA\nFactures impayées : ${d.factures_impayees}\nArticles en rupture : ${d.stock_alertes}\nEmployés actifs : ${d.employes_actifs}\n\nGénère un rapport mensuel synthétique avec : résumé des performances, points d'attention, 3 recommandations prioritaires pour le mois suivant. Format texte clair, sans markdown.`

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  return res.content[0].type === 'text' ? res.content[0].text : ''
}

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase  = getSupabase()
  const now       = new Date()
  const jourMois  = now.getDate()
  const results: Record<string, unknown> = { date: now.toISOString(), actions: [] }
  const actions   = results.actions as string[]

  // Récupérer tous les tenants actifs
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, nom_entreprise, secteur_activite')
    .eq('statut', 'actif')
    .limit(100)

  if (!tenants?.length) {
    return Response.json({ ...results, message: 'Aucun tenant actif' })
  }

  for (const tenant of tenants) {
    const tId = tenant.id

    // ── Jour 1 : Rapport mensuel automatique ──────────────────────────────────
    if (jourMois === 1) {
      try {
        const rapport = await genererRapportMensuel(supabase, tId)
        await supabase.from('miaa_rapports').insert({
          tenant_id:   tId,
          type:        'rapport_mensuel',
          contenu:     rapport,
          auto:        true,
          created_at:  now.toISOString(),
        })
        actions.push(`rapport_mensuel:${tId}`)
      } catch (e) {
        console.error(`[MIAA autonome] rapport_mensuel ${tId}:`, e)
      }
    }

    // ── Jour 18 : Rappel CNSS ─────────────────────────────────────────────────
    if (jourMois === 18) {
      await supabase.from('miaa_notifications').upsert({
        id:           `cnss-rappel-${now.getFullYear()}-${now.getMonth()}-${tId}`,
        tenant_id:    tId,
        type:         'rh',
        priority:     'high',
        titre:        'Rappel CNSS — Dans 2 jours',
        message:      'Les cotisations CNSS sont dues le 20 du mois. Vérifiez que vos bulletins de paie sont générés et validés.',
        action_url:   '/dashboard/rh',
        action_label: 'Vérifier la paie',
        lu:           false,
        created_at:   now.toISOString(),
      }, { onConflict: 'id,tenant_id' })
      actions.push(`cnss_rappel:${tId}`)
    }

    // ── Jour 28 : Bulletins de paie automatiques ──────────────────────────────
    if (jourMois === 28) {
      try {
        const resume = await genererBulletinsPaie(supabase, tId)
        await supabase.from('miaa_rapports').insert({
          tenant_id:  tId,
          type:       'bulletin_paie',
          contenu:    resume,
          auto:       true,
          created_at: now.toISOString(),
        })
        actions.push(`bulletins_paie:${tId}`)
      } catch (e) {
        console.error(`[MIAA autonome] bulletins ${tId}:`, e)
      }
    }

    // ── Quotidien : alertes et notifications ──────────────────────────────────
    try {
      const notifs = await genererNotifications(supabase, tId)
      await sauvegarderNotifications(supabase, tId, notifs)
      if (notifs.length > 0) actions.push(`notifs(${notifs.length}):${tId}`)
    } catch (e) {
      console.error(`[MIAA autonome] notifs ${tId}:`, e)
    }
  }

  return Response.json({ ...results, tenants_processed: tenants.length, actions_count: actions.length })
}

// GET pour vérification du cron
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({ status: 'MIAA Autonome prêt', jour: new Date().getDate() })
}
