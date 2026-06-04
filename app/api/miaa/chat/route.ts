import Anthropic from '@anthropic-ai/sdk'
import { Mistral } from '@mistralai/mistralai'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { MIAA_AGENTS, type MIAAModule } from '@/lib/miaa-agents'
import { chargerMemoireMIAA, mettreAJourMemoire } from '@/lib/miaa/memory'
import { getMIAASystemPrompt } from '@/lib/miaa/system-prompt'

export const runtime = 'nodejs'

// ── Sélection moteur IA ───────────────────────────────────────────────────────
// Priorité : Claude si disponible, sinon Mistral
const USE_CLAUDE  = !!process.env.ANTHROPIC_API_KEY
const USE_MISTRAL = !USE_CLAUDE && !!process.env.MISTRAL_API_KEY

const anthropic = USE_CLAUDE
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  : null

const mistral = USE_MISTRAL
  ? new Mistral({ apiKey: process.env.MISTRAL_API_KEY! })
  : null

function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Appel unifié — retourne le texte brut quelle que soit l'IA */
async function callAI(
  systemPrompt: string,
  messages:     { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  // ── Claude (priorité) ─────────────────────────────────────────────────────
  if (anthropic) {
    const res = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2048,
      system:     systemPrompt,
      messages,
    })
    return res.content[0].type === 'text' ? res.content[0].text : ''
  }

  // ── Mistral (fallback) ────────────────────────────────────────────────────
  if (mistral) {
    const res = await mistral.chat.complete({
      model:    'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })
    return res.choices?.[0]?.message?.content as string ?? ''
  }

  throw new Error('Aucune clé API IA configurée (ANTHROPIC_API_KEY ou MISTRAL_API_KEY)')
}

export async function POST(req: Request) {
  try {
    const { module, message, history, tenantData, langue } = await req.json() as {
      module:     string
      message:    string
      history:    { role: 'user' | 'assistant'; content: string }[]
      tenantData?: { tenant_id?: string }
      langue?:    string
    }

    const agent    = MIAA_AGENTS[module as MIAAModule]
    const supabase = getSupabaseAdmin()
    const tenantId = tenantData?.tenant_id

    // ── 1. Charger mémoire + données temps réel ───────────────────────────────
    const memory = tenantId
      ? await chargerMemoireMIAA(supabase, tenantId)
      : {
          entreprise:        { nom: 'Entreprise', secteur: module, pays: 'Congo-Brazzaville', plan: 'PME', nb_employes: 0, devise: 'FCFA', tva_taux: 18 },
          donnees_live:      { solde_tresorerie: 0, factures_impayees: 0, stock_alertes: 0, employes_actifs: 0, ca_mois: 0 },
          historique_resume: '',
          patterns:          { questions_frequentes: [], problemes_recurrents: [], preferences_utilisateur: [] },
          nb_conversations:  0,
        }

    // ── 2. System prompt omniscient ───────────────────────────────────────────
    const systemPrompt = getMIAASystemPrompt({
      memory,
      module_actuel: module || 'general',
      langue:        langue || 'fr',
      agent_context: agent?.personnalite,
    })

    // ── 3. Appel IA (Claude ou Mistral) ──────────────────────────────────────
    const rawText = await callAI(
      systemPrompt,
      [
        ...history.slice(-16).map(m => ({
          role:    m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: message },
      ]
    )

    // ── 4. Parser la réponse ──────────────────────────────────────────────────
    let parsed: { response: string; suggested_actions?: string[]; alert?: string | null }
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: rawText }
    } catch {
      parsed = { response: rawText }
    }

    const reponse = parsed.response ?? rawText

    // ── 5. Sauvegardes asynchrones ────────────────────────────────────────────
    if (tenantId) {
      mettreAJourMemoire(supabase, tenantId, message, reponse)
        .catch(() => { /* fire-and-forget */ })

      supabase.from('miaa_conversations').insert({
        tenant_id:    tenantId,
        module,
        message_user: message,
        message_miaa: reponse,
        created_at:   new Date().toISOString(),
      }).then(() => {}, () => {})
    }

    // ── 6. Suggestions selon module ───────────────────────────────────────────
    const suggestionsModule: Record<string, string[]> = {
      facturation:  ['Voir mes factures impayées', 'Calculer TVA sur 500 000 FCFA', 'Analyser mon CA du mois', 'Envoyer des relances'],
      rh:           ['Calculer la paie du mois', 'Voir les congés en attente', 'Analyser la masse salariale', 'Générer les bulletins'],
      tresorerie:   ['Quel est mon solde actuel ?', 'Prévision à 30 jours', 'Analyser entrées vs sorties', 'Alertes trésorerie'],
      stock:        ['Articles en rupture', 'Valeur totale du stock', 'Rotation des articles', 'Commander aux fournisseurs'],
      comptabilite: ['Générer le bilan', 'Calculer la TVA à déclarer', 'Analyser mes charges', 'État des résultats'],
      restaurant:   ['CA du jour', 'Plats les plus vendus', 'Stock cuisine critique', 'Rapport caisse'],
      ecole:        ['Étudiants avec impayés', 'Taux de recouvrement', 'Générer les bulletins', 'Rapport académique'],
      general:      ['Analyse globale', 'Points urgents', 'Mes performances du mois', 'Recommandations MIAA PREMIUM'],
    }

    return Response.json({
      response:          reponse,
      suggested_actions: parsed.suggested_actions ?? (suggestionsModule[module] ?? suggestionsModule.general),
      alert:             parsed.alert ?? null,
      peut_telecharger:  reponse.length > 200,
      moteur:            anthropic ? 'claude' : 'mistral',
    })
  } catch (err) {
    console.error('[MIAA PREMIUM chat]', err)
    return Response.json(
      { response: 'Une erreur est survenue. Veuillez réessayer.', suggested_actions: [] },
      { status: 500 }
    )
  }
}
