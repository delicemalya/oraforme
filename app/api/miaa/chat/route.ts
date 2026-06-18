import Anthropic from '@anthropic-ai/sdk'
import { Mistral } from '@mistralai/mistralai'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { MIAA_AGENTS, type MIAAModule } from '@/lib/miaa-agents'
import { chargerMemoireMIAA, mettreAJourMemoire } from '@/lib/miaa/memory'
import { getMIAASystemPrompt } from '@/lib/miaa/system-prompt'
import { trackUsage } from '@/lib/miaa/usage-tracker'
import { detecterPaysMentionne, getMiaaFiscalContext, getNomPaysSansMoteur } from '@/lib/miaa-fiscal-router'

export const runtime = 'nodejs'

// ── Clients IA ────────────────────────────────────────────────────────────────
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

// ── Sélection du modèle ────────────────────────────────────────────────────────
// Haiku (10× moins cher) par défaut.
// Opus uniquement si la question nécessite une analyse lourde.
const COMPLEX_RE = /\b(rapport|bulletin|bilan|synthèse|analyse complète|plan(?:ification)?|stratégie|prévision détaillée|état financier|calcul détaillé|génère? (?:un|le|les|une)|écri(?:s|re)|rédige?)\b/i

function selectModel(message: string): { model: string; maxTokens: number; isComplex: boolean } {
  if (COMPLEX_RE.test(message)) {
    return { model: 'claude-opus-4-5', maxTokens: 15000, isComplex: true }
  }
  return { model: 'claude-haiku-4-5-20251001', maxTokens: 2000, isComplex: false }
}

// ── Cerveau Central — détection automatique de l'agent ────────────────────────
// Quand module === 'auto', on choisit le meilleur agent selon le contexte secteur
// et les mots-clés du message. L'utilisateur voit toujours "MIAA+" mais le moteur
// envoie la personnalité du bon expert.
const SECTOR_TO_AGENT: Record<string, string> = {
  // Restauration & Hôtellerie
  restaurant: 'restaurant', hotel: 'hotel', hotellerie: 'hotel', boisson: 'restaurant',
  // Santé
  sante: 'sante', pharmacie: 'pharmacie', clinique: 'sante', hopital: 'sante',
  // Éducation
  ecole: 'ecole', universite: 'ecole',
  // Cabinet & Conseil
  cabinet: 'cabinet', audit: 'audit',
  // BTP & Transport
  btp: 'comptabilite', transport: 'tresorerie', transport_public: 'rh',
  // Agriculture & Commerce
  agriculture: 'stock', commerce: 'crm', supermarche: 'stock', boutique: 'crm',
  // Finance & Banque
  banque: 'tresorerie', microfinance: 'tresorerie',
  // ONG
  ong: 'comptabilite',
  // Industrie
  industrie: 'stock', petrole: 'comptabilite',
  // Assurance
  assurance: 'assurance', compagnie_assurance: 'assurance', courtier_assurance: 'assurance', agent_assurance: 'assurance',
}

function detectAgent(message: string, secteur?: string): string {
  // 1. Le secteur de l'entreprise prime — chaque secteur a son expert dédié
  if (secteur && SECTOR_TO_AGENT[secteur]) return SECTOR_TO_AGENT[secteur]

  // 2. Routage par mots-clés — du plus spécifique au plus général
  const msg = message.toLowerCase()

  if (/bulletin.*paie|net.*pay|salaire.*brut|cnss|irpp|licencie|préavis|contrat.*travail|employ[eé]|congé|arrêt.*maladie|recrut|offre.*emploi/.test(msg))
    return 'rh'
  if (/patente|tva.*déclar|déclaration.*dgi|dgid|impôt.*société|is\b|fiscalit|taxe unique|cts\b|acompte.*fiscal/.test(msg))
    return 'fiscalite'
  if (/facture|devis|impayé|recouvr|dso\b|relance.*client|encaissement|créance|avoir\b/.test(msg))
    return 'facturation'
  if (/bilan|syscohada|ohada|journal.*compt|écriture.*compt|amortissement|compte \d{3}|classe [1-9]\b|passif|actif immob/.test(msg))
    return 'comptabilite'
  if (/trésorerie|cash.*flow|flux.*tréso|solde.*banque|airtel.*money|mtn.*momo|orange.*money|virement|découvert/.test(msg))
    return 'tresorerie'
  if (/\bstock\b|inventaire|rupture.*stock|article.*stock|fournisseur.*commande|réapprovisionnement/.test(msg))
    return 'stock'
  if (/prospect|pipeline.*crm|opportunité.*crm|scoring.*client|fidélisation/.test(msg))
    return 'crm'
  if (/audit|conformit|anomali|score.*audit|contrôle.*intern|risque.*entreprise|ohada.*conform|plan.*action.*audit|non-conformit|redressement.*fiscal/.test(msg))
    return 'audit'
  if (/restaurant|cuisine|menu|couverts|food cost|haccp|caisse.*jour|plat.*ven/.test(msg))
    return 'restaurant'
  if (/hôtel|chambre|check.in|check.out|revpar|occupat|reservation|housekeeping/.test(msg))
    return 'hotel'
  if (/patient|consul|ordonnance|médecin|soins|clinique|camu|hôpital|infirmier/.test(msg))
    return 'sante'
  if (/médic|pharmacie|officine|ordonnance.*méd|bpd|fefo.*méd|stupéfiant/.test(msg))
    return 'pharmacie'
  if (/élève|étudiant|scolarité|bulletin.*note|classe|enseignant|frais.*scol/.test(msg))
    return 'ecole'
  if (/audit.*cabinet|cliente.*cabinet|liasse|commissar|expert.comptable/.test(msg))
    return 'cabinet'
  if (/transport|flotte|chauffeur|kilomét|livraison.*route/.test(msg))
    return 'tresorerie'
  if (/conformit|anomalie.*compta|anomalie.*fiscal|anomalie.*rh|score.*ohada|balance.*général|grand.*livre.*anomalie|risque.*fiscal|risque.*compta|vérif.*comptab|écritures.*incohérent|pénalité.*tva|retard.*cnss|retard.*déclaration/.test(msg))
    return 'conformite'
  if (/score.*audit|audit.*complet|rapport.*audit|contrôle.*interne|fraude.*interne|séparation.*tâches|plan.*remédiation|anomalies.*détect/.test(msg))
    return 'audit'
  if (/assur|police.*assurance|sinistre|prime.*assurance|garantie.*assurance|franchise.*assurance|réassurance|actuariat|ratio.*sinistres|cima\b|souscription|indemnisation|courtier|avenant.*police/.test(msg))
    return 'assurance'

  // 3. Défaut : comptabilité — l'agent le plus polyvalent
  return 'comptabilite'
}

// ── Conversion nom de pays → code ISO pour le routing fiscal ─────────────────
// La mémoire stocke parfois le nom complet ('Congo-Brazzaville') au lieu du code ('CG')
const PAYS_NAME_TO_CODE: Record<string, string> = {
  'congo-brazzaville': 'CG', 'congo': 'CG', 'republic of the congo': 'CG',
  'cameroun': 'CM', 'cameroon': 'CM',
  'gabon': 'GA',
  'tchad': 'TD', 'chad': 'TD',
  'rca': 'CF', 'centrafrique': 'CF', 'république centrafricaine': 'CF', 'central african republic': 'CF',
  'guinée équatoriale': 'GQ', 'equatorial guinea': 'GQ', 'guinea ecuatorial': 'GQ',
  'rdc': 'CD', 'rd congo': 'CD', 'congo-kinshasa': 'CD', 'democratic republic of the congo': 'CD',
}

function extractPaysCode(pays: string | undefined): string | undefined {
  if (!pays) return undefined
  if (pays.length === 2) return pays.toUpperCase() // déjà un code ISO
  return PAYS_NAME_TO_CODE[pays.toLowerCase()] ?? undefined
}

// ── Cache in-memory ────────────────────────────────────────────────────────────
// Portée : instance serveur (process). Persiste entre requêtes sur le même worker.
// En production (Vercel serverless) : cache par instance — toujours bénéfique
// pour les sessions actives et les questions répétées.

const RESPONSE_TTL = 5 * 60 * 1000   // 5 minutes
const CONTEXT_TTL  = 5 * 60 * 1000   // 5 minutes

interface RespEntry { response: string; suggestedActions: string[]; expiresAt: number }
interface CtxEntry<T> { value: T; expiresAt: number }

const responseCache = new Map<string, RespEntry>()
const memoryCache   = new Map<string, CtxEntry<ReturnType<typeof chargerMemoireMIAA> extends Promise<infer T> ? T : never>>()

function cacheKey(tenantId: string | undefined, module: string, message: string): string {
  const norm = message.slice(0, 200).toLowerCase().replace(/\s+/g, ' ').trim()
  return `${tenantId ?? 'anon'}:${module}:${norm}`
}

function getResp(key: string): RespEntry | null {
  const e = responseCache.get(key)
  if (!e || Date.now() > e.expiresAt) { responseCache.delete(key); return null }
  return e
}
function setResp(key: string, entry: Omit<RespEntry, 'expiresAt'>): void {
  // Évite la fuite mémoire : purge les entrées expirées si le cache grossit
  if (responseCache.size > 500) {
    const now = Date.now()
    for (const [k, v] of responseCache) { if (v.expiresAt < now) responseCache.delete(k) }
  }
  responseCache.set(key, { ...entry, expiresAt: Date.now() + RESPONSE_TTL })
}

type MemoryValue = Awaited<ReturnType<typeof chargerMemoireMIAA>>
function getMem(tenantId: string): MemoryValue | null {
  const e = memoryCache.get(tenantId) as CtxEntry<MemoryValue> | undefined
  if (!e || Date.now() > e.expiresAt) { memoryCache.delete(tenantId); return null }
  return e.value
}
function setMem(tenantId: string, value: MemoryValue): void {
  memoryCache.set(tenantId, { value, expiresAt: Date.now() + CONTEXT_TTL } as CtxEntry<MemoryValue>)
}

// ── Appel IA unifié ───────────────────────────────────────────────────────────
async function callAI(
  systemPrompt: string,
  messages:     { role: 'user' | 'assistant'; content: string }[],
  model:        string,
  maxTokens:    number,
): Promise<{ text: string; inputTokens: number; outputTokens: number; moteur: string }> {
  if (anthropic) {
    const res = await anthropic.messages.create({
      model:      model as Parameters<typeof anthropic.messages.create>[0]['model'],
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages,
    })
    return {
      text:         res.content[0].type === 'text' ? res.content[0].text : '',
      inputTokens:  res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      moteur:       'claude',
    }
  }

  if (mistral) {
    const res = await mistral.chat.complete({
      model:    'mistral-large-latest',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    })
    return {
      text:         (res.choices?.[0]?.message?.content ?? '') as string,
      inputTokens:  res.usage?.promptTokens    ?? 0,
      outputTokens: res.usage?.completionTokens ?? 0,
      moteur:       'mistral',
    }
  }

  return {
    text: 'Je rencontre un problème technique temporaire. Veuillez réessayer dans quelques instants.',
    inputTokens: 0, outputTokens: 0, moteur: 'none',
  }
}

// ── Suggestions par module ────────────────────────────────────────────────────
const SUGGESTIONS: Record<string, string[]> = {
  facturation:  ['Voir mes factures impayées', 'Calculer TVA sur 500 000 FCFA', 'Analyser mon CA du mois', 'Envoyer des relances'],
  rh:           ['Calculer la paie du mois', 'Voir les congés en attente', 'Analyser la masse salariale', 'Générer les bulletins'],
  tresorerie:   ['Quel est mon solde actuel ?', 'Prévision à 30 jours', 'Analyser entrées vs sorties', 'Alertes trésorerie'],
  stock:        ['Articles en rupture', 'Valeur totale du stock', 'Rotation des articles', 'Commander aux fournisseurs'],
  comptabilite: ['Générer le bilan', 'Calculer la TVA à déclarer', 'Analyser mes charges', 'État des résultats'],
  restaurant:   ['CA du jour', 'Plats les plus vendus', 'Stock cuisine critique', 'Rapport caisse'],
  ecole:        ['Étudiants avec impayés', 'Taux de recouvrement', 'Générer les bulletins', 'Rapport académique'],
  general:      ['Analyse globale', 'Points urgents', 'Mes performances du mois', 'Recommandations MIAA+'],
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { module, message, history, tenantData, langue, gedContext } = await req.json() as {
      module:     string
      message:    string
      history:    { role: 'user' | 'assistant'; content: string }[]
      tenantData?: { tenant_id?: string; secteur?: string; pays?: string }
      langue?:    string
      gedContext?: string
    }

    const tenantId = tenantData?.tenant_id

    // Cerveau Central : quand module='auto' on détecte le meilleur agent
    const effectiveModule = (module === 'auto' || module === 'general')
      ? detectAgent(message, tenantData?.secteur)
      : module
    const agent = MIAA_AGENTS[effectiveModule as MIAAModule]

    // ── 1. Vérifier le cache de réponse ──────────────────────────────────────
    // Seulement si l'historique est vide (question isolée de départ de session)
    const key = cacheKey(tenantId, effectiveModule, message)
    if (history.length === 0) {
      const cached = getResp(key)
      if (cached) {
        return Response.json({
          response:          cached.response,
          suggested_actions: cached.suggestedActions,
          alert:             null,
          peut_telecharger:  cached.response.length > 200,
          moteur:            'cache',
          cached:            true,
        })
      }
    }

    // ── 2. Charger mémoire (avec cache 5min) ──────────────────────────────────
    const supabase = getSupabaseAdmin()
    let memory: MemoryValue

    if (tenantId) {
      const cachedMem = getMem(tenantId)
      if (cachedMem) {
        memory = cachedMem
      } else {
        memory = await chargerMemoireMIAA(supabase, tenantId)
        setMem(tenantId, memory)
      }
    } else {
      memory = {
        entreprise:        { nom: 'Entreprise', secteur: module, pays: 'Congo-Brazzaville', plan: 'PME', nb_employes: 0, devise: 'FCFA', tva_taux: 18 },
        donnees_live:      { solde_tresorerie: 0, factures_impayees: 0, stock_alertes: 0, employes_actifs: 0, ca_mois: 0 },
        historique_resume: '',
        patterns:          { questions_frequentes: [], problemes_recurrents: [], preferences_utilisateur: [] },
        contexte_metier:   {},
        nb_conversations:  0,
      }
    }

    // ── 3. System prompt ──────────────────────────────────────────────────────
    // Résolution du code pays du tenant
    const paysCode = tenantData?.pays ?? extractPaysCode(memory.entreprise.pays)

    // Détection du pays mentionné dans la question — priorité sur le pays tenant
    const paysDetecte = detecterPaysMentionne(message)
    let paysEffectif = paysCode
    let crossCountryNote = ''

    if (paysDetecte && paysDetecte !== paysCode) {
      const ctxDetecte = getMiaaFiscalContext(paysDetecte)
      const nomPaysTenant = paysCode
        ? (getMiaaFiscalContext(paysCode)?.countryName ?? paysCode)
        : 'celui de l\'entreprise'

      if (ctxDetecte) {
        // Pays avec moteur fiscal → basculer le contexte pour cette réponse
        paysEffectif = paysDetecte
        crossCountryNote = `\n\n═══ CONTEXTE CROSS-PAYS ═══\nL'utilisateur interroge sur la fiscalité de ${ctxDetecte.countryName}, qui diffère du pays de son entreprise (${nomPaysTenant}). Utilise EXCLUSIVEMENT les données fiscales de ${ctxDetecte.countryName} listées dans le MODULE FISCAL CONTEXTUEL ci-dessus — ne mélange pas avec les règles de ${nomPaysTenant}. Propose en fin de réponse de clarifier si la question concerne une filiale, un client étranger, un fournisseur ou une opération transfrontalière.`
      } else {
        // Pays sans moteur fiscal → signaler l'absence de données vérifiées
        const nomPaysDetecte = getNomPaysSansMoteur(paysDetecte)
        crossCountryNote = `\n\n═══ CONTEXTE CROSS-PAYS ═══\nL'utilisateur interroge sur la fiscalité de ${nomPaysDetecte}. Aucun module fiscal spécialisé pour ce pays n'est disponible dans Oraforme. Commence ta réponse par : "Je n'ai pas de module fiscal spécialisé pour ${nomPaysDetecte} dans Oraforme — voici une réponse générale à vérifier avec un expert-comptable local." Puis réponds avec tes connaissances générales.`
      }
    }

    let systemPrompt = getMIAASystemPrompt({
      memory,
      module_actuel: effectiveModule || 'general',
      langue:        langue || 'fr',
      agent_context: agent?.personnalite,
      pays:          paysEffectif,
    })

    if (crossCountryNote) systemPrompt += crossCountryNote

    // Injecter le contexte GED si un document est sélectionné
    if (gedContext) {
      systemPrompt += `\n\n---\n## Document GED chargé par l'utilisateur\n${gedContext.slice(0, 6000)}\n---\nAnalyse et réponds en tenant compte de ce document. Cite les données précises du document quand tu réponds.`
    }

    // ── 4. Sélection modèle (Haiku par défaut, Opus si analyse complexe) ──────
    const { model, maxTokens } = selectModel(message)

    // ── 5. Appel IA ───────────────────────────────────────────────────────────
    const { text: rawText, inputTokens, outputTokens, moteur } = await callAI(
      systemPrompt,
      [
        ...history.slice(-16).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: message },
      ],
      model,
      maxTokens,
    )

    // ── 6. Parser la réponse ──────────────────────────────────────────────────
    let parsed: { response: string; suggested_actions?: string[]; alert?: string | null }
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: rawText }
    } catch {
      parsed = { response: rawText }
    }

    const reponse           = parsed.response ?? rawText
    const suggestedActions  = parsed.suggested_actions ?? (SUGGESTIONS[effectiveModule] ?? SUGGESTIONS.general)

    // ── 7. Mettre en cache si question courte (≤ 300 chars) ──────────────────
    if (message.length <= 300) {
      setResp(key, { response: reponse, suggestedActions })
    }

    // ── 8. Sauvegardes asynchrones ────────────────────────────────────────────
    if (tenantId) {
      // Invalider le cache mémoire pour que la prochaine requête ait les données fraîches
      memoryCache.delete(tenantId)

      mettreAJourMemoire(supabase, tenantId, message, reponse)
        .catch(() => { /* fire-and-forget */ })

      supabase.from('miaa_conversations').insert({
        tenant_id:    tenantId,
        module:       effectiveModule,
        message_user: message,
        message_miaa: reponse,
        created_at:   new Date().toISOString(),
      }).then(() => {}, () => {})

      // Compteur d'utilisation
      trackUsage(supabase, tenantId, effectiveModule, model, inputTokens, outputTokens)
    }

    return Response.json({
      response:          reponse,
      suggested_actions: suggestedActions,
      alert:             parsed.alert ?? null,
      peut_telecharger:  reponse.length > 200,
      moteur,
      model_used:        model,
      agent_detected:    effectiveModule,
      agent_nom:         agent?.nom ?? 'MIAA+',
      cached:            false,
    })

  } catch (err) {
    console.error('[MIAA+ chat]', err)
    return Response.json(
      { response: 'Une erreur est survenue. Veuillez réessayer.', suggested_actions: [] },
      { status: 500 }
    )
  }
}
