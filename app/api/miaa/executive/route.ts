import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM = `Tu es MIAA+ Executive, l'assistant IA de direction générale de la plateforme Oraforme.
Tu analyses les données consolidées de groupes multi-pays africains (cabinets RH, agences de placement, sociétés de recrutement).
Tu fournis des analyses stratégiques, des benchmarks inter-entités, des rapports consolidés et des prévisions.
Tu parles toujours en français, de façon directe et orientée décision.
Tu bases tes analyses sur les données fournies — jamais d'inventions.
Tu identifies les entités les plus performantes, les risques, les opportunités et les leviers d'action prioritaires.
Format : sections claires avec **gras**, tableaux markdown, listes. Sois exhaustif et actionnable.`

// ── Tool prompts ───────────────────────────────────────────────────────────────

type EntiteData = {
  nom: string
  pays?: string | null
  ca_ytd: number
  ca_mois: number
  tresorerie: number
  effectifs: number
  candidats?: number
  placements?: number
  offres?: number
  score_audit?: number
}

function buildEntitesBlock(entites: EntiteData[]): string {
  return entites.map((e, i) => `
**Entité ${i + 1} : ${e.nom}**${e.pays ? ` (${e.pays})` : ''}
- CA Annuel : ${e.ca_ytd.toLocaleString('fr-FR')} FCFA
- CA Mois : ${e.ca_mois.toLocaleString('fr-FR')} FCFA
- Trésorerie nette : ${e.tresorerie.toLocaleString('fr-FR')} FCFA
- Effectifs : ${e.effectifs}
- Candidats actifs : ${e.candidats ?? 0}
- Placements ce mois : ${e.placements ?? 0}
- Offres actives : ${e.offres ?? 0}
- Score audit : ${e.score_audit ?? 0}/100`).join('\n')
}

const TOOL_PROMPTS: Record<string, (inputs: Record<string, unknown>) => string> = {

  comparer_pays: ({ entites, contexte }) => {
    const data = (entites as EntiteData[]) ?? []
    return `Compare les performances des pays/sociétés suivants pour le groupe :

${buildEntitesBlock(data)}

Contexte groupe : ${(contexte as string) || 'Groupe RH multi-pays Afrique'}

Analyse de comparaison :
1. **Tableau comparatif** (CA, Trésorerie, Effectifs, Placements, Score /100)
2. **Pays le plus performant** — justification avec chiffres
3. **Pays en difficulté** — diagnostics et risques
4. **Disparités** à surveiller (trésorerie, effectifs, activité)
5. **Benchmarks** : qui doit s'inspirer de qui ?
6. **Recommandations par pays** (2-3 actions concrètes par entité)
7. **Priorités de la DG** — 3 actions décisions à prendre immédiatement`
  },

  comparer_filiales: ({ entites, contexte }) => {
    const data = (entites as EntiteData[]) ?? []
    return `Compare les filiales du groupe :

${buildEntitesBlock(data)}

Contexte : ${(contexte as string) || 'Groupe RH Afrique'}

Analyse :
1. **Tableau comparatif filiales** (performance relative)
2. **Filiale championne** — facteurs de succès à dupliquer
3. **Filiales sous-performantes** — causes probables et plan d'action
4. **Benchmarks internes** — meilleures pratiques identifiées
5. **Synergies possibles** entre filiales
6. **Plan d'optimisation** par filiale
7. **KPIs cibles** à fixer pour le prochain trimestre`
  },

  comparer_agences: ({ entites, contexte }) => {
    const data = (entites as EntiteData[]) ?? []
    return `Compare les agences du groupe :

${buildEntitesBlock(data)}

Contexte : ${(contexte as string) || 'Réseau d\'agences RH'}

Analyse :
1. **Classement agences** par performance globale
2. **Indicateurs clés** : CA/employé, placements/mois, taux utilisation candidats
3. **Agences star** — bonnes pratiques et facteurs de succès
4. **Agences en retard** — diagnostic et plan de redressement
5. **Redistribution des ressources** — recommandations
6. **Objectifs trimestriels** par agence
7. **Actions prioritaires** pour la DG cette semaine`
  },

  rapport_consolide: ({ groupe_nom, entites, periode, contexte }) => {
    const data = (entites as EntiteData[]) ?? []
    const total_ca = data.reduce((s, e) => s + e.ca_ytd, 0)
    const total_treso = data.reduce((s, e) => s + e.tresorerie, 0)
    const total_eff = data.reduce((s, e) => s + e.effectifs, 0)
    const total_candidats = data.reduce((s, e) => s + (e.candidats ?? 0), 0)
    const total_placements = data.reduce((s, e) => s + (e.placements ?? 0), 0)
    return `Génère un rapport consolidé de direction générale pour :

**Groupe : ${(groupe_nom as string) || 'Groupe RH Afrique'}**
**Période : ${(periode as string) || 'Année en cours'}**
**Nombre d\'entités : ${data.length}**

**Chiffres consolidés :**
- CA Total : ${total_ca.toLocaleString('fr-FR')} FCFA
- Trésorerie totale : ${total_treso.toLocaleString('fr-FR')} FCFA
- Effectifs totaux : ${total_eff}
- Candidats actifs : ${total_candidats}
- Placements (mois) : ${total_placements}

**Détail par entité :**
${buildEntitesBlock(data)}

Contexte : ${(contexte as string) || 'Groupe RH recrutement & placement Afrique'}

Rédige un rapport DG complet :
1. **Synthèse exécutive** (1 page)
2. **Performances financières consolidées** (CA, tréso, marges)
3. **Activité opérationnelle** (candidats, missions, placements, contrats)
4. **Analyse par entité** (tableau + commentaire)
5. **Points forts du groupe**
6. **Risques et vigilances**
7. **Comparaison vs période précédente** (analyse tendance)
8. **Recommandations stratégiques** (5 décisions prioritaires)
9. **Objectifs du prochain trimestre** (SMART)`
  },

  previsions: ({ groupe_nom, entites, horizon, hypotheses }) => {
    const data = (entites as EntiteData[]) ?? []
    const total_ca = data.reduce((s, e) => s + e.ca_ytd, 0)
    return `Génère des prévisions financières et opérationnelles pour :

**Groupe : ${(groupe_nom as string) || 'Groupe RH Afrique'}**
**Horizon de prévision : ${(horizon as string) || '12 mois'}**
**CA actuel : ${total_ca.toLocaleString('fr-FR')} FCFA**
**Hypothèses de travail : ${(hypotheses as string) || 'croissance stable, contexte économique normal Afrique'}**

**Données actuelles par entité :**
${buildEntitesBlock(data)}

Génère les prévisions :
1. **Prévisions CA** par entité et consolidé (scénarios : conservateur / central / optimiste)
2. **Prévisions effectifs** — besoins en recrutement par pays
3. **Prévisions placements** — objectifs par agence/filiale
4. **Cash-flow prévisionnel** — trésorerie projetée à 3, 6 et 12 mois
5. **Risques sur les prévisions** — facteurs pouvant dévier les résultats
6. **Investissements recommandés** — où allouer les ressources
7. **Plan d'action** pour atteindre le scénario central
8. **Tableau de bord prévisionnel** — KPIs à surveiller mensuellement`
  },
}

// ── Route ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      tool: string
      inputs: Record<string, unknown>
      tenantId: string
    }
    const { tool, inputs, tenantId } = body

    if (!tool || !tenantId) {
      return NextResponse.json({ error: 'tool and tenantId required' }, { status: 400 })
    }

    const promptFn = TOOL_PROMPTS[tool]
    if (!promptFn) {
      return NextResponse.json({ error: 'unknown tool' }, { status: 400 })
    }

    const userPrompt = promptFn(inputs)

    if (anthropic) {
      const response = await anthropic.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 6000,
        system:     SYSTEM,
        messages:   [{ role: 'user', content: userPrompt }],
      })
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')

      try {
        const db = getAdmin()
        await db.from('miaa_rh_generations').insert({
          tenant_id: tenantId, tool: `executive:${tool}`, plan: 'grande',
          inputs: JSON.stringify(inputs), output: text, model: 'claude-opus-4-5',
        })
      } catch { /* non-blocking */ }

      return NextResponse.json({ text })
    }

    return NextResponse.json({
      text: `[MIAA+ Executive — mode simulation]\n\n**Outil : ${tool}**\n\nCet outil nécessite ANTHROPIC_API_KEY. Données reçues et prompt préparé.`,
    })

  } catch (err) {
    console.error('[miaa/executive]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
