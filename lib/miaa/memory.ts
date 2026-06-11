/**
 * lib/miaa/memory.ts — Moteur de Mémoire Persistante MIAA+
 * Charge le contexte complet de l'entreprise + apprentissage depuis miaa_memory.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { extrairePatterns, extraireContexteMetier } from './pattern-extractor'

export interface MIAAEntreprise {
  nom:         string
  secteur:     string
  pays:        string
  plan:        string
  nb_employes: number
  devise:      string
  tva_taux:    number
}

export interface MIAADonneesLive {
  solde_tresorerie:  number
  factures_impayees: number
  stock_alertes:     number
  employes_actifs:   number
  ca_mois:           number
}

export interface MIAAPatterns {
  questions_frequentes:    string[]
  problemes_recurrents:    string[]
  preferences_utilisateur: string[]
}

export interface MIAAMemory {
  entreprise:        MIAAEntreprise
  donnees_live:      MIAADonneesLive
  historique_resume: string
  patterns:          MIAAPatterns
  contexte_metier:   Record<string, unknown>
  nb_conversations:  number
}

const EMPTY_MEMORY: MIAAMemory = {
  entreprise: {
    nom: 'Entreprise', secteur: 'Non défini',
    pays: 'Congo-Brazzaville', plan: 'PME',
    nb_employes: 0, devise: 'FCFA', tva_taux: 18,
  },
  donnees_live: {
    solde_tresorerie: 0, factures_impayees: 0,
    stock_alertes: 0, employes_actifs: 0, ca_mois: 0,
  },
  historique_resume: '',
  patterns:          { questions_frequentes: [], problemes_recurrents: [], preferences_utilisateur: [] },
  contexte_metier:   {},
  nb_conversations:  0,
}

// ── Chargement complet de la mémoire ──────────────────────────────────────

export async function chargerMemoireMIAA(
  supabase: SupabaseClient,
  tenantId: string
): Promise<MIAAMemory> {
  try {
    const since30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [tenantRes, txRes, facturesRes, stockRes, employesRes, memoireRes] =
      await Promise.all([
        supabase.from('tenants').select('nom_entreprise, secteur_activite, pays, taille_entreprise, plan')
          .eq('id', tenantId).maybeSingle(),
        supabase.from('transactions').select('type, montant')
          .eq('tenant_id', tenantId).gte('created_at', since30j),
        supabase.from('factures').select('statut, total, montant_paye')
          .eq('tenant_id', tenantId).in('statut', ['envoyee', 'retard']),
        supabase.from('stock_articles').select('quantite, seuil_alerte')
          .eq('tenant_id', tenantId),
        supabase.from('employes').select('id').eq('tenant_id', tenantId).eq('statut', 'actif'),
        supabase.from('miaa_memory').select('*').eq('tenant_id', tenantId).maybeSingle(),
      ])

    const tenant   = tenantRes.data
    const tx       = txRes.data ?? []
    const factures = facturesRes.data ?? []
    const stock    = stockRes.data ?? []
    const employes = employesRes.data ?? []
    const memoire  = memoireRes.data

    const entrees = tx.filter(t => t.type === 'entree').reduce((s, t) => s + (t.montant ?? 0), 0)
    const sorties = tx.filter(t => t.type === 'sortie').reduce((s, t) => s + (t.montant ?? 0), 0)

    const planLabel =
      tenant?.taille_entreprise === 'grande' ? 'Grande Entreprise' :
      tenant?.taille_entreprise === 'pme'    ? 'PME' :
      tenant?.plan === 'enterprise'           ? 'Grande Entreprise' :
      tenant?.plan === 'pro'                  ? 'PME' : 'TPE'

    return {
      entreprise: {
        nom:         tenant?.nom_entreprise ?? 'Entreprise',
        secteur:     tenant?.secteur_activite ?? 'Non défini',
        pays:        tenant?.pays ?? 'Congo-Brazzaville',
        plan:        planLabel,
        nb_employes: employes.length,
        devise:      'FCFA',
        tva_taux:    18,
      },
      donnees_live: {
        solde_tresorerie:  entrees - sorties,
        factures_impayees: factures.length,
        stock_alertes:     stock.filter(a => (a.quantite ?? 0) <= (a.seuil_alerte ?? 0)).length,
        employes_actifs:   employes.length,
        ca_mois:           entrees,
      },
      historique_resume: memoire?.historique_resume ?? '',
      patterns:          memoire?.patterns          ?? EMPTY_MEMORY.patterns,
      contexte_metier:   memoire?.contexte_metier   ?? {},
      nb_conversations:  memoire?.nb_conversations  ?? 0,
    }
  } catch {
    return { ...EMPTY_MEMORY }
  }
}

// ── Mise à jour de la mémoire après chaque échange ────────────────────────
// Toutes les 10 conversations, extraction complète des patterns.

export async function mettreAJourMemoire(
  supabase: SupabaseClient,
  tenantId: string,
  question: string,
  reponse:  string
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('miaa_memory')
      .select('historique_resume, nb_conversations, patterns, contexte_metier')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const nbConvs = (existing?.nb_conversations ?? 0) + 1

    // Rolling buffer : ajoute le nouvel échange, tronque à 3000 chars
    const fragment     = `\nQ: ${question.slice(0, 120)}\nR: ${reponse.slice(0, 280)}`
    const resume       = existing?.historique_resume ?? ''
    const nouveauResume = resume.length > 2800
      ? resume.slice(-2200) + fragment
      : resume + fragment

    // Extraction périodique des patterns (toutes les 10 conversations)
    let patterns          = existing?.patterns          ?? EMPTY_MEMORY.patterns
    let contexte_metier   = existing?.contexte_metier   ?? {}
    if (nbConvs % 10 === 0) {
      const [newPatterns, newCtx] = await Promise.all([
        extrairePatterns(supabase, tenantId),
        extraireContexteMetier(supabase, tenantId),
      ])
      patterns        = newPatterns
      contexte_metier = { ...contexte_metier, ...newCtx }
    }

    await supabase.from('miaa_memory').upsert({
      tenant_id:         tenantId,
      historique_resume: nouveauResume,
      nb_conversations:  nbConvs,
      patterns,
      contexte_metier,
      derniere_analyse:  new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
  } catch {
    // Non-bloquant — ne jamais faire rater le chat pour une erreur mémoire
  }
}

// ── Sauvegarde rapport généré ─────────────────────────────────────────────

export async function sauvegarderRapport(
  supabase: SupabaseClient,
  tenantId: string,
  type:     string,
  contenu:  string,
  opts:     { auto?: boolean; tokens_used?: number; meta?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await supabase.from('miaa_rapports').insert({
      tenant_id:   tenantId,
      type,
      contenu,
      auto:        opts.auto        ?? false,
      tokens_used: opts.tokens_used ?? null,
      meta:        opts.meta        ?? {},
      created_at:  new Date().toISOString(),
    })
  } catch { /* non-bloquant */ }
}

// ── Lecture des rapports récents ──────────────────────────────────────────

export async function chargerRapports(
  supabase: SupabaseClient,
  tenantId: string,
  type?:    string,
  limit  = 10
): Promise<{ id: string; type: string; contenu: string; auto: boolean; created_at: string }[]> {
  try {
    let q = supabase
      .from('miaa_rapports')
      .select('id, type, contenu, auto, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (type) q = q.eq('type', type)

    const { data } = await q
    return data ?? []
  } catch {
    return []
  }
}
