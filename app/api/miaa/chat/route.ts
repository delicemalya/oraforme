import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { MIAA_AGENTS, type MIAAModule } from '@/lib/miaa-agents'

export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  try {
    const { module, message, history, tenantData } = await req.json() as {
      module: string
      message: string
      history: { role: 'user' | 'assistant'; content: string }[]
      tenantData?: { tenant_id?: string }
    }

    const agent = MIAA_AGENTS[module as MIAAModule]
    if (!agent) return Response.json({ error: 'Module inconnu' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const tenantId = tenantData?.tenant_id
    const contextData = await getModuleContext(module as MIAAModule, tenantId, supabase)

    const systemPrompt = `RÈGLES DE FORMATAGE STRICTES — PRIORITÉ ABSOLUE :
N'utilise JAMAIS d'astérisques (*) ni de double-astérisques (**). N'utilise JAMAIS de tirets (-) en début de ligne. N'utilise JAMAIS de dièse (#). Pas de markdown d'aucune sorte. Pas d'emojis. Pas de symboles de structuration. Utilise uniquement du texte propre : phrases complètes, paragraphes séparés par une ligne vide, listes numérotées (1. 2. 3.). Ton texte doit être immédiatement lisible sans traitement.

${agent.personnalite}

CONTEXTE ENTREPRISE ACTUEL :
${JSON.stringify(contextData, null, 2)}

RÈGLES IMPORTANTES :
- Tu réponds TOUJOURS en français
- Tu utilises TOUJOURS FCFA comme devise
- Tu es précis avec les chiffres réels du contexte
- Tu fais des propositions concrètes et actionnables
- Tu signales les anomalies que tu détectes
- Tu es l'expert numéro 1 de ton domaine en Afrique centrale

FORMAT DE RÉPONSE — réponds UNIQUEMENT en JSON valide :
{
  "response": "ta réponse en texte propre (peut contenir des sauts de ligne \\n pour les paragraphes)",
  "suggested_actions": ["action 1", "action 2"],
  "alert": null
}`

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        ...history.slice(-10).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: message },
      ],
    })

    const rawText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : ''

    let parsed: { response: string; suggested_actions?: string[]; alert?: string | null }
    try {
      // Extract JSON even if model adds markdown fences
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: rawText }
    } catch {
      parsed = { response: rawText }
    }

    // Log conversation (non-blocking)
    if (tenantId) {
      supabase.from('miaa_conversations').insert({
        tenant_id: tenantId,
        module,
        message_user: message,
        message_miaa: parsed.response,
        created_at: new Date().toISOString(),
      }).then(() => { /* fire-and-forget */ }, () => { /* ignore errors */ })
    }

    return Response.json({
      response: parsed.response ?? rawText,
      suggested_actions: parsed.suggested_actions ?? [...agent.actions_rapides],
      alert: parsed.alert ?? null,
    })
  } catch (err) {
    console.error('[MIAA chat]', err)
    return Response.json(
      { response: 'Une erreur est survenue. Veuillez réessayer.', suggested_actions: [] },
      { status: 500 }
    )
  }
}

async function getModuleContext(
  module: MIAAModule,
  tenantId: string | undefined,
  supabase: SupabaseClient
): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().split('T')[0]
  if (!tenantId) return { date: today, info: 'Aucun tenant identifié' }

  switch (module) {
    case 'facturation': {
      const { data: factures } = await supabase
        .from('factures')
        .select('id,statut,total,client_name,date,due_date,montant_paye')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20)
      const impayees = factures?.filter(f => f.statut === 'envoyee' || f.statut === 'retard') ?? []
      const totalImpaye = impayees.reduce((s, f) => s + ((f.total ?? 0) - (f.montant_paye ?? 0)), 0)
      return { factures_recentes: factures, nb_impayees: impayees.length, total_impaye_fcfa: totalImpaye, date: today }
    }

    case 'rh': {
      const { data: employes } = await supabase
        .from('employes')
        .select('id,nom,prenom,salaire_base,poste,statut')
        .eq('tenant_id', tenantId)
        .eq('statut', 'actif')
      const masseSalariale = employes?.reduce((s, e) => s + (e.salaire_base ?? 0), 0) ?? 0
      return { employes, nb_employes: employes?.length ?? 0, masse_salariale_fcfa: masseSalariale, date: today }
    }

    case 'stock': {
      const { data: articles } = await supabase
        .from('stock_articles')
        .select('id,nom,quantite,seuil_alerte,prix_unitaire,unite')
        .eq('tenant_id', tenantId)
      const alertes = articles?.filter(a => (a.quantite ?? 0) <= (a.seuil_alerte ?? 0)) ?? []
      const valeurStock = articles?.reduce((s, a) => s + (a.quantite ?? 0) * (a.prix_unitaire ?? 0), 0) ?? 0
      return { nb_articles: articles?.length ?? 0, alertes_rupture: alertes, valeur_stock_fcfa: valeurStock, date: today }
    }

    case 'restaurant': {
      const { data: commandes } = await supabase
        .from('resto_commandes')
        .select('id,statut,total,created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', today)
        .order('created_at', { ascending: false })
        .limit(50)
      const caJour = commandes?.reduce((s, c) => s + (c.total ?? 0), 0) ?? 0
      return { commandes_du_jour: commandes, nb_commandes: commandes?.length ?? 0, ca_jour_fcfa: caJour, date: today }
    }

    case 'ecole': {
      const { data: etudiants } = await supabase
        .from('etudiants')
        .select('id,nom,prenom,statut,classe,niveau')
        .eq('tenant_id', tenantId)
      const bloques = etudiants?.filter(e => e.statut === 'bloque' || e.statut === 'suspendu') ?? []
      return { nb_etudiants: etudiants?.length ?? 0, etudiants_bloques: bloques, date: today }
    }

    case 'tresorerie': {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: transactions } = await supabase
        .from('transactions')
        .select('type,montant,date,description')
        .eq('tenant_id', tenantId)
        .gte('date', since.split('T')[0])
        .order('date', { ascending: false })
        .limit(100)
      const entrees = transactions?.filter(t => t.type === 'entree').reduce((s, t) => s + (t.montant ?? 0), 0) ?? 0
      const sorties = transactions?.filter(t => t.type === 'sortie').reduce((s, t) => s + (t.montant ?? 0), 0) ?? 0
      return { solde_30j_fcfa: entrees - sorties, entrees_fcfa: entrees, sorties_fcfa: sorties, nb_transactions: transactions?.length ?? 0, date: today }
    }

    case 'comptabilite': {
      const { data: entries } = await supabase
        .from('journal_entries')
        .select('id,libelle,montant,debit_account,credit_account,date_operation')
        .eq('tenant_id', tenantId)
        .order('date_operation', { ascending: false })
        .limit(20)
      return { ecritures_recentes: entries, nb_ecritures: entries?.length ?? 0, date: today }
    }

    case 'sante': {
      const { data: patients } = await supabase
        .from('patients')
        .select('id,nom,prenom,statut')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20)
      return { patients_recents: patients, nb_patients: patients?.length ?? 0, date: today }
    }

    default:
      return { date: today }
  }
}
