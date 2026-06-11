import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { chargerMemoireMIAA } from '@/lib/miaa/memory'
import { getMIAASystemPrompt } from '@/lib/miaa/system-prompt'

export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/**
 * GET /api/miaa/proactif
 * Analyse proactive de tous les tenants — déclenché par le cron Vercel (toutes les heures).
 * Sécurisé par CRON_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, nom_entreprise')
    .limit(50) // process 50 at a time to stay within timeout

  let alertesCreees = 0

  for (const tenant of tenants ?? []) {
    try {
      const memory = await chargerMemoireMIAA(supabase, tenant.id)
      const alertes: { type: string; message: string }[] = []

      // Trésorerie négative
      if (memory.donnees_live.solde_tresorerie < 0) {
        alertes.push({
          type: 'critique',
          message: `Trésorerie négative : ${memory.donnees_live.solde_tresorerie.toLocaleString('fr-FR')} FCFA`,
        })
      }

      // Factures impayées > 5
      if (memory.donnees_live.factures_impayees > 5) {
        alertes.push({
          type: 'attention',
          message: `${memory.donnees_live.factures_impayees} factures impayées en attente`,
        })
      }

      // Stock critique
      if (memory.donnees_live.stock_alertes > 0) {
        alertes.push({
          type: 'attention',
          message: `${memory.donnees_live.stock_alertes} article(s) en rupture de stock`,
        })
      }

      // Masse salariale sans employés actifs (données incohérentes)
      if (memory.donnees_live.ca_mois > 0 && memory.donnees_live.employes_actifs === 0) {
        alertes.push({
          type: 'info',
          message: 'Activité détectée mais aucun employé actif enregistré',
        })
      }

      if (alertes.length === 0) continue

      // Claude formule les alertes de manière professionnelle
      const systemPrompt = getMIAASystemPrompt({
        memory,
        module_actuel: 'supervision',
        langue: 'fr',
      })

      const claudeRes = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system:     systemPrompt,
        messages:   [{
          role: 'user',
          content: `Formule ces alertes de manière professionnelle, concise et bienveillante pour ${tenant.nom_entreprise}. Utilise uniquement du texte propre, sans markdown. Max 3 phrases par alerte.\n\nAlertes : ${JSON.stringify(alertes)}`,
        }],
      })

      const contenu = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : ''

      await supabase.from('miaa_alertes').insert({
        tenant_id:           tenant.id,
        contenu,
        alertes_detectees:   alertes,
        lu:                  false,
        created_at:          new Date().toISOString(),
      })

      alertesCreees++
    } catch (err) {
      console.error(`[MIAA+ proactif] tenant ${tenant.id}:`, err)
    }
  }

  return Response.json({
    success:       true,
    tenants_traites: tenants?.length ?? 0,
    alertes_creees: alertesCreees,
    timestamp:     new Date().toISOString(),
  })
}
