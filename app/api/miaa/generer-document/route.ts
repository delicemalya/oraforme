import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { chargerMemoireMIAA } from '@/lib/miaa/memory'
import { EXPERTS } from '@/lib/miaa/experts'

export const runtime = 'nodejs'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type DocType = 'rapport_mensuel' | 'bulletin_paie' | 'relance_facture' | 'contrat_travail' | 'bilan_simplifie' | 'rapport_stock' | 'rapport_tresorerie'

const DOC_PROMPTS: Record<DocType, (ctx: string) => string> = {
  rapport_mensuel: (ctx) => `${EXPERTS.general}\n\nContexte entreprise :\n${ctx}\n\nGénère un rapport mensuel de gestion complet et structuré en texte brut (pas de markdown, pas d'astérisques). Inclure : résumé exécutif, analyse financière, points d'attention, recommandations prioritaires.`,
  bulletin_paie: (ctx) => `${EXPERTS.rh}\n\nDonnées :\n${ctx}\n\nGénère un bulletin de paie conforme CNSS/IRPP Congo en texte structuré.`,
  relance_facture: (ctx) => `${EXPERTS.facturation}\n\nFacture :\n${ctx}\n\nRédige une lettre de relance professionnelle et courtoise en français. Inclure l'objet, le corps, et la formule de politesse.`,
  contrat_travail: (ctx) => `${EXPERTS.rh}\n\nInformations :\n${ctx}\n\nRédige un contrat de travail conforme au Code du travail Congo-Brazzaville 2023.`,
  bilan_simplifie: (ctx) => `${EXPERTS.comptabilite}\n\nDonnées comptables :\n${ctx}\n\nGénère un bilan simplifié OHADA avec actif/passif et analyse des principaux ratios.`,
  rapport_stock: (ctx) => `${EXPERTS.stock}\n\nDonnées stock :\n${ctx}\n\nGénère un rapport de stock avec analyse des rotations, ruptures et recommandations de réapprovisionnement.`,
  rapport_tresorerie: (ctx) => `${EXPERTS.tresorerie}\n\nDonnées trésorerie :\n${ctx}\n\nGénère une analyse de trésorerie avec solde, prévisions 30 jours et recommandations.`,
}

export async function POST(req: Request) {
  try {
    const { type, context, tenant_id, data } = await req.json() as {
      type: DocType
      context?: string
      tenant_id?: string
      data?: Record<string, unknown>
    }

    if (!type || !DOC_PROMPTS[type]) {
      return Response.json({ error: 'Type de document inconnu' }, { status: 400 })
    }

    const supabase = getSupabase()
    let ctx = context ?? ''

    // Enrichir avec les données Supabase si tenant_id fourni
    if (tenant_id && !ctx) {
      const memory = await chargerMemoireMIAA(supabase, tenant_id)
      ctx = `
Entreprise : ${memory.entreprise.nom} (${memory.entreprise.secteur})
Pays : ${memory.entreprise.pays}
Employés : ${memory.entreprise.nb_employes}
Solde trésorerie (30j) : ${new Intl.NumberFormat('fr-FR').format(memory.donnees_live.solde_tresorerie)} FCFA
CA du mois : ${new Intl.NumberFormat('fr-FR').format(memory.donnees_live.ca_mois)} FCFA
Factures impayées : ${memory.donnees_live.factures_impayees}
Articles en rupture : ${memory.donnees_live.stock_alertes}
${data ? '\nDonnées supplémentaires :\n' + JSON.stringify(data, null, 2) : ''}
`
    }

    const prompt = DOC_PROMPTS[type](ctx)

    const res = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 8000,
      messages:   [{ role: 'user', content: prompt }],
    })

    const content = res.content[0].type === 'text' ? res.content[0].text : ''

    // Sauvegarder le rapport généré
    if (tenant_id) {
      await supabase.from('miaa_rapports').insert({
        tenant_id,
        type,
        contenu:    content,
        tokens_used: res.usage.input_tokens + res.usage.output_tokens,
        created_at: new Date().toISOString(),
      }).then(() => {}, () => {})
    }

    return Response.json({
      content,
      type,
      tokens: res.usage.input_tokens + res.usage.output_tokens,
      generated_at: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[MIAA generer-document]', err)
    return Response.json({ error: 'Erreur lors de la génération' }, { status: 500 })
  }
}
