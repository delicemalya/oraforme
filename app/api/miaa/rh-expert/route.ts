import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Tool prompts ──────────────────────────────────────────────────────────────

function buildSystemPrompt(plan: string): string {
  const tier = plan === 'grande' ? 'Executive RH' : plan === 'pme' ? 'Expert RH' : 'Standard RH'
  return `Tu es MIAA+ ${tier}, l'assistant IA RH de la plateforme Oraforme, spécialisé en recrutement et gestion des ressources humaines en Afrique (Congo, Cameroun, Gabon, Côte d'Ivoire, Sénégal, etc.).

Tu fournis des analyses professionnelles, des documents structurés et des recommandations concrètes.
Tu rédiges toujours en français, de façon claire, structurée et directement utilisable.
Tu respectes le droit du travail OHADA et les législations locales.
Tu n'inventes jamais de données — tu travailles uniquement avec ce que l'utilisateur te fournit.
Pour les contrats, tu indiques les clauses obligatoires selon la législation.
Pour les risques RH, tu cites des risques concrets et des actions correctives précises.

Format de sortie : utilise **gras**, - listes, sections claires avec titres. Sois exhaustif et professionnel.`
}

const TOOL_PROMPTS: Record<string, (inputs: Record<string, string>) => string> = {

  analyser_cv: (i) => `Analyse ce CV pour le poste de **${i.poste || 'poste non précisé'}** chez **${i.entreprise || 'l\'entreprise'}** :

CV :
${i.cv_text || '(aucun CV fourni)'}

Contexte entreprise : ${i.contexte || 'cabinet RH / secteur recrutement'}

Réalise une analyse complète incluant :
1. **Résumé du profil** (3-4 lignes)
2. **Points forts** (compétences, expériences, formations pertinentes)
3. **Points de vigilance** (lacunes, incohérences, zones à clarifier)
4. **Score d'adéquation** /100 avec justification
5. **Recommandation** : Inviter / Réserver / Écarter + justification
6. **Questions prioritaires à poser en entretien** (5 questions ciblées)`,

  comparer_cvs: (i) => `Compare ces ${i.nb_cvs || 'plusieurs'} CV pour le poste de **${i.poste || 'poste non précisé'}** :

${i.cv1 ? `**CV 1 — ${i.nom1 || 'Candidat 1'} :**\n${i.cv1}\n` : ''}
${i.cv2 ? `**CV 2 — ${i.nom2 || 'Candidat 2'} :**\n${i.cv2}\n` : ''}
${i.cv3 ? `**CV 3 — ${i.nom3 || 'Candidat 3'} :**\n${i.cv3}\n` : ''}
${i.cv4 ? `**CV 4 — ${i.nom4 || 'Candidat 4'} :**\n${i.cv4}\n` : ''}
${i.cv5 ? `**CV 5 — ${i.nom5 || 'Candidat 5'} :**\n${i.cv5}\n` : ''}

Réalise une comparaison structurée :
1. **Tableau comparatif** (expérience, formation, compétences, adéquation /100)
2. **Analyse individuelle** de chaque candidat (forces / faiblesses)
3. **Classement recommandé** avec justification
4. **Candidat à retenir** et pourquoi
5. **Risques** sur chaque candidat`,

  fiche_poste: (i) => `Génère une fiche de poste professionnelle complète pour :

- **Intitulé du poste** : ${i.titre || '(non précisé)'}
- **Entreprise / Cabinet** : ${i.entreprise || '(non précisé)'}
- **Secteur** : ${i.secteur || 'recrutement / placement'}
- **Niveau** : ${i.niveau || 'non précisé'}
- **Localisation** : ${i.localisation || 'non précisé'}
- **Contexte** : ${i.contexte || 'non précisé'}

La fiche doit inclure :
1. **Présentation de l'entreprise** (à adapter selon le contexte)
2. **Mission principale** du poste
3. **Responsabilités détaillées** (10-15 points)
4. **Profil recherché** (formation, expérience, compétences techniques, soft skills)
5. **Conditions** (contrat, rémunération, avantages, horaires)
6. **Indicateurs de performance** (KPIs du poste)
7. **Rattachement hiérarchique**`,

  annonce_emploi: (i) => `Rédige une annonce d'emploi attractive et professionnelle :

- **Poste** : ${i.titre || '(non précisé)'}
- **Entreprise** : ${i.entreprise || '(non précisé)'}
- **Type de contrat** : ${i.type_contrat || 'CDI'}
- **Localisation** : ${i.localisation || 'non précisé'}
- **Profil recherché** : ${i.profil || 'non précisé'}
- **Avantages** : ${i.avantages || 'non précisé'}
- **Ton** : ${i.ton || 'professionnel'}

L'annonce doit inclure :
1. **Titre accrocheur** de l'annonce
2. **Présentation de l'entreprise** (2-3 lignes engageantes)
3. **Description du poste** (missions clés en bullet points)
4. **Profil idéal** (formation + expérience + compétences)
5. **Ce que nous offrons** (package, évolution, culture)
6. **Comment postuler** (process, contact, deadline)
Rédige une annonce directe, engageante, sans jargon RH inutile.`,

  preparer_entretien: (i) => `Prépare un guide d'entretien complet pour :

- **Candidat** : ${i.candidat || 'Candidat'}
- **Poste** : ${i.poste || 'non précisé'}
- **Type d'entretien** : ${i.type_entretien || 'Entretien RH initial'}
- **Durée prévue** : ${i.duree || '45 minutes'}
- **Extrait CV** : ${i.cv_extrait || '(aucun extrait fourni)'}
- **Contexte entreprise** : ${i.contexte || 'cabinet de recrutement'}

Fournis :
1. **Structure de l'entretien** (phases et durées)
2. **Questions d'ouverture** (3 questions brise-glace)
3. **Questions techniques** sur le poste (8-10 questions ciblées)
4. **Questions comportementales** méthode STAR (5 questions)
5. **Questions de motivation et projet** (5 questions)
6. **Points à approfondir** depuis le CV (basé sur l'extrait fourni)
7. **Grille d'évaluation** (critères + notation /5)
8. **Questions du candidat** à anticiper avec réponses recommandées
9. **Red flags** à surveiller`,

  generer_contrat: (i) => `Génère un modèle de contrat de travail pour :

- **Type de contrat** : ${i.type_contrat || 'CDI'}
- **Employeur** : ${i.employeur || 'Société (à compléter)'}
- **Salarié** : ${i.salarie || '(à compléter)'}
- **Poste** : ${i.poste || 'non précisé'}
- **Salaire brut** : ${i.salaire || 'à négocier'} FCFA/mois
- **Date de début** : ${i.date_debut || '(à compléter)'}
${i.duree ? `- **Durée** : ${i.duree}` : ''}
- **Localisation** : ${i.localisation || 'non précisé'}
- **Clauses spéciales** : ${i.clauses || 'aucune'}
- **Législation applicable** : ${i.pays || 'Congo-Brazzaville (Code du Travail)'}

Génère le contrat complet avec :
1. Identification des parties
2. Nature et durée du contrat
3. Fonction et attributions
4. Rémunération et avantages
5. Période d'essai
6. Horaires et lieu de travail
7. Congés payés
8. Cotisations sociales (CNSS employé 5,4% / patronale 19,2%)
9. Clause de confidentialité
10. Clause de non-concurrence (si applicable)
11. Conditions de résiliation
12. Droit applicable et juridiction compétente
Indique entre [crochets] les champs à personnaliser.`,

  evaluation_collaborateur: (i) => `Génère un formulaire d'évaluation annuelle complet pour :

- **Collaborateur** : ${i.collaborateur || '(non précisé)'}
- **Poste** : ${i.poste || 'non précisé'}
- **Période évaluée** : ${i.periode || 'Année en cours'}
- **Objectifs fixés** : ${i.objectifs || '(non précisés)'}
- **Compétences clés du poste** : ${i.competences || 'à définir selon le poste'}
- **Manager évaluateur** : ${i.manager || '(à compléter)'}

Génère l'évaluation complète :
1. **Bilan des objectifs** (atteints / partiellement atteints / non atteints)
2. **Évaluation des compétences métier** (note /5 + commentaire pour chaque)
3. **Évaluation des soft skills** (communication, initiative, travail en équipe, adaptabilité)
4. **Points forts** à valoriser
5. **Axes de développement** prioritaires
6. **Objectifs pour la prochaine période** (SMART)
7. **Plan de développement** (formations, projets, montée en responsabilités)
8. **Note globale** /100 avec justification
9. **Recommandation RH** (maintien, promotion, mutation, plan d'amélioration)`,

  plan_carriere: (i) => `Génère un plan de carrière personnalisé pour :

- **Collaborateur** : ${i.collaborateur || '(non précisé)'}
- **Poste actuel** : ${i.poste_actuel || 'non précisé'}
- **Ancienneté** : ${i.anciennete || 'non précisé'}
- **Formations et diplômes** : ${i.formations || 'non précisé'}
- **Ambitions exprimées** : ${i.ambitions || 'non précisé'}
- **Points forts** : ${i.points_forts || 'non précisé'}
- **Entreprise / secteur** : ${i.contexte || 'cabinet de recrutement / placement'}
- **Horizon** : ${i.horizon || '3-5 ans'}

Génère un plan de carrière structuré :
1. **Analyse du profil actuel** (forces, gaps, potentiel)
2. **Vision à court terme** (1 an) — actions concrètes
3. **Vision à moyen terme** (2-3 ans) — paliers et responsabilités cibles
4. **Vision à long terme** (5 ans) — poste cible et évolution
5. **Plan de formation** (compétences à acquérir, formations recommandées)
6. **Jalons et indicateurs** de progression
7. **Risques et facteurs de succès**
8. **Engagements** collaborateur et entreprise`,

  risques_rh: (i) => `Analyse les risques RH à partir des informations suivantes :

- **Contexte entreprise** : ${i.contexte || 'cabinet de recrutement / placement RH'}
- **Effectif** : ${i.effectif || 'non précisé'}
- **Situation décrite** :
${i.situation || '(aucune situation décrite)'}
- **Indicateurs disponibles** : ${i.indicateurs || 'non précisés'}

Réalise un audit des risques RH complet :
1. **Synthèse des risques identifiés** (classés par criticité : critique / élevé / moyen / faible)
2. **Risques légaux et conformité** (contrats, CNSS, licenciements, discriminations)
3. **Risques opérationnels** (turnover, absentéisme, surcharge, compétences critiques)
4. **Risques sociaux** (conflits, démotivation, harcèlement, grève)
5. **Risques financiers** (coûts cachés, redressement CNSS, indemnités)
6. **Plan d'action corrective** (actions prioritaires avec responsable et délai)
7. **Tableau de bord RH recommandé** (indicateurs à suivre mensuellement)
8. **Recommandations stratégiques** pour sécuriser l'entreprise`,
}

// ── API Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      tool: string
      inputs: Record<string, string>
      tenantId: string
      plan: string
    }

    const { tool, inputs, tenantId, plan } = body

    if (!tool || !tenantId) {
      return NextResponse.json({ error: 'tool and tenantId required' }, { status: 400 })
    }

    // ── Plan-gated access ──
    const STANDARD_TOOLS = ['analyser_cv', 'fiche_poste', 'annonce_emploi', 'preparer_entretien']
    const EXPERT_TOOLS   = ['comparer_cvs', 'generer_contrat', 'evaluation_collaborateur']
    const EXEC_TOOLS     = ['plan_carriere', 'risques_rh']

    if (EXPERT_TOOLS.includes(tool) && plan === 'tpe') {
      return NextResponse.json({ error: 'PLAN_UPGRADE_REQUIRED', required: 'pme' }, { status: 403 })
    }
    if (EXEC_TOOLS.includes(tool) && plan !== 'grande') {
      return NextResponse.json({ error: 'PLAN_UPGRADE_REQUIRED', required: 'grande' }, { status: 403 })
    }
    if (![...STANDARD_TOOLS, ...EXPERT_TOOLS, ...EXEC_TOOLS].includes(tool)) {
      return NextResponse.json({ error: 'unknown tool' }, { status: 400 })
    }

    const promptFn = TOOL_PROMPTS[tool]
    if (!promptFn) {
      return NextResponse.json({ error: 'no prompt for tool' }, { status: 400 })
    }

    const userPrompt   = promptFn(inputs)
    const systemPrompt = buildSystemPrompt(plan)

    // ── AI call ──
    if (anthropic) {
      const response = await anthropic.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 4000,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      })
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')

      // ── Save to DB ──
      try {
        const db = getSupabaseAdmin()
        await db.from('miaa_rh_generations').insert({
          tenant_id: tenantId,
          tool,
          plan,
          inputs: JSON.stringify(inputs),
          output: text,
          model:  'claude-opus-4-5',
        })
      } catch { /* non-blocking */ }

      return NextResponse.json({ text })
    }

    return NextResponse.json({
      text: `[MIAA+ RH Expert — mode simulation]\n\n**Outil : ${tool}**\n\nCet outil nécessite une clé API Anthropic configurée sur le serveur.\n\nVos données ont bien été reçues et le prompt a été préparé. Configurez ANTHROPIC_API_KEY dans vos variables d'environnement pour activer la génération IA.`,
    })

  } catch (err) {
    console.error('[miaa/rh-expert]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
