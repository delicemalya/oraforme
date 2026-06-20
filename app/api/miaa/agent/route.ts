/**
 * app/api/miaa/agent/route.ts
 * API du Centre de Commandement MIAA+
 *
 * GET  ?tenant_id=xxx&save=1  → analyse + propositions (save=1 pour persister)
 * POST {proposal_id, action, tenant_id} → marquer accepted/rejected/executed
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { chargerMemoireMIAA, sauvegarderRapport } from '@/lib/miaa/memory'
import {
  runAgentAnalysis,
  sauvegarderProposals,
  chargerProposals,
} from '@/lib/miaa/autonomous-engine'
import { checkPlanAccess } from '@/lib/api/require-tenant'

export const runtime  = 'nodejs'
export const maxDuration = 30

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── GET — Lancer l'analyse et retourner les propositions ──────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tenantId  = url.searchParams.get('tenant_id')
  const doSave    = url.searchParams.get('save') === '1'
  const savedOnly = url.searchParams.get('saved') === '1'

  if (!tenantId) {
    return Response.json({ error: 'tenant_id requis' }, { status: 400 })
  }

  const planDenied = await checkPlanAccess(tenantId, 'academy')
  if (planDenied) return planDenied

  try {
    const supabase = getSupabase()

    // Mode lecture seule : charger les propositions sauvegardées
    if (savedOnly) {
      const proposals = await chargerProposals(supabase, tenantId)
      return Response.json({ proposals, from_cache: true })
    }

    // Analyse fraîche
    const memory   = await chargerMemoireMIAA(supabase, tenantId)
    const result   = await runAgentAnalysis(supabase, tenantId, memory)

    if (doSave) {
      await sauvegarderProposals(supabase, tenantId, result.proposals)
    }

    // Dernier briefing DG
    const { data: lastBriefing } = await supabase
      .from('miaa_briefings')
      .select('contenu, created_at, score_sante')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return Response.json({
      ...result,
      last_briefing: lastBriefing ?? null,
    })
  } catch (err) {
    console.error('[MIAA agent GET]', err)
    return Response.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}

// ── POST — Exécuter ou rejeter une proposition ────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      action:       'accept' | 'reject' | 'execute' | 'briefing'
      proposal_id?: string
      tenant_id:    string
    }
    const { action, proposal_id, tenant_id } = body

    if (!tenant_id) {
      return Response.json({ error: 'tenant_id requis' }, { status: 400 })
    }

    const planDenied = await checkPlanAccess(tenant_id, 'academy')
    if (planDenied) return planDenied

    const supabase = getSupabase()

    // ── Générer le briefing DG ────────────────────────────────────────────────
    if (action === 'briefing') {
      const [memory, proposals] = await Promise.all([
        chargerMemoireMIAA(supabase, tenant_id),
        chargerProposals(supabase, tenant_id),
      ])

      const { entreprise: e, donnees_live: d } = memory
      const critiques = proposals.filter(p => p.impact === 'critical').length
      const hautes    = proposals.filter(p => p.impact === 'high').length

      if (!anthropic) {
        return Response.json({ error: 'Clé API Anthropic manquante' }, { status: 503 })
      }

      const fmt   = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
      const mois  = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })

      const prompt = `Tu es MIAA+, l'assistant exécutif de ${e.nom}.

Génère un briefing DG concis (3 paragraphes max) pour ce matin — ${mois}.

DONNÉES :
- Trésorerie : ${fmt(d.solde_tresorerie)} FCFA
- CA du mois : ${fmt(d.ca_mois)} FCFA
- Factures impayées : ${d.factures_impayees}
- Stock alertes : ${d.stock_alertes}
- Employés actifs : ${d.employes_actifs}
- Alertes critiques MIAA+ : ${critiques}
- Points d'attention : ${hautes}
${proposals.length > 0 ? `\nPRINCIPAUX POINTS :\n${proposals.slice(0, 4).map(p => `• ${p.titre}`).join('\n')}` : ''}

Format : texte direct, professionnel, sans markdown. Commencer par "Bonjour [prénom DG ou Directeur Général],"
Conclure par 1 recommandation prioritaire du jour.`

      const res = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages:   [{ role: 'user', content: prompt }],
      })

      const contenu = res.content[0].type === 'text' ? res.content[0].text : ''

      const { data: briefing } = await supabase
        .from('miaa_briefings')
        .insert({
          tenant_id,
          contenu,
          modules_analyses:  ['finance', 'rh', 'stock', 'fiscal'],
          nb_propositions:   proposals.length,
          nb_alertes:        critiques,
          score_sante:       Math.max(0, 100 - critiques * 25 - hautes * 12),
        })
        .select('id, contenu, created_at, score_sante')
        .single()

      return Response.json({ success: true, briefing })
    }

    // ── Accept / Reject / Execute ─────────────────────────────────────────────
    if (!proposal_id) {
      return Response.json({ error: 'proposal_id requis' }, { status: 400 })
    }

    const { data: proposal } = await supabase
      .from('miaa_proposals')
      .select('*')
      .eq('id', proposal_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (!proposal) {
      return Response.json({ error: 'Proposition introuvable' }, { status: 404 })
    }

    if (action === 'reject') {
      await supabase
        .from('miaa_proposals')
        .update({ statut: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', proposal_id)
      return Response.json({ success: true, statut: 'rejected' })
    }

    if (action === 'accept') {
      await supabase
        .from('miaa_proposals')
        .update({ statut: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', proposal_id)
      return Response.json({ success: true, statut: 'accepted' })
    }

    if (action === 'execute') {
      // Exécution selon le type d'action
      let resultat = ''

      if (proposal.action_type === 'relance_facture' && anthropic) {
        const { facture_ids, nb, total } = proposal.payload as {
          facture_ids: string[]
          nb:    number
          total: number
        }

        const memory = await chargerMemoireMIAA(supabase, tenant_id)
        const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

        const res = await anthropic.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages:   [{
            role:    'user',
            content: `Génère une lettre de relance professionnelle groupée pour ${nb} facture(s) impayée(s).
Entreprise créancière : ${memory.entreprise.nom}
Montant total : ${fmt(total)} FCFA
Ton : professionnel, ferme mais cordial, conformité OHADA Congo.
Format texte clair sans markdown.`,
          }],
        })

        resultat = res.content[0].type === 'text' ? res.content[0].text : ''
        await sauvegarderRapport(supabase, tenant_id, 'relance_facture', resultat, {
          meta: { facture_ids, nb, total },
        })
      } else {
        resultat = `Action "${proposal.action_label}" enregistrée. Consultez le module ${proposal.module} pour les détails.`
      }

      await supabase
        .from('miaa_proposals')
        .update({ statut: 'executed', resultat, updated_at: new Date().toISOString() })
        .eq('id', proposal_id)

      return Response.json({ success: true, statut: 'executed', resultat })
    }

    return Response.json({ error: 'action invalide' }, { status: 400 })

  } catch (err) {
    console.error('[MIAA agent POST]', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
