/**
 * lib/miaa/pattern-extractor.ts
 * Extraction intelligente des patterns métier depuis l'historique conversations.
 * Pure analyse locale — aucun appel IA, zéro coût.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MIAAPatterns } from './memory'

// ── Mots-clés signalant un problème récurrent ──────────────────────────────
const PROBLEME_REGEX: { label: string; pattern: RegExp; min: number }[] = [
  { label: 'Trésorerie — sujet récurrent',           pattern: /trésorerie|cash.?flow|solde|découvert/i,      min: 3 },
  { label: 'Impayés clients — recouvrement actif',   pattern: /impayé|retard|relance|facture.*non.?pay/i,    min: 2 },
  { label: 'Ruptures stock — réappro fréquent',      pattern: /rupture|stock.*critique|seuil.?alerte/i,      min: 2 },
  { label: 'Paie & CNSS — traitement régulier',       pattern: /cnss|irpp|bulletin.*paie|salaire|cotisation/i, min: 2 },
  { label: 'TVA & déclarations fiscales',             pattern: /tva|déclaration.*dgi|patente|impôt/i,         min: 2 },
  { label: 'Audit & conformité OHADA',               pattern: /audit|conformit|anomali|ohada.*plan/i,        min: 2 },
  { label: 'Recrutement & RH actif',                 pattern: /recrutement|candidat|entretien|embauche/i,    min: 2 },
]

// ── Modules → libellés lisibles ───────────────────────────────────────────
const MODULE_LABELS: Record<string, string> = {
  comptabilite: 'Comptabilité',
  tresorerie:   'Trésorerie',
  rh:           'RH',
  facturation:  'Facturation',
  stock:        'Stocks',
  fiscalite:    'Fiscalité',
  crm:          'CRM',
  audit:        'Audit',
  ecole:        'École',
  restaurant:   'Restaurant',
  hotel:        'Hôtel',
  sante:        'Santé',
  recrutement:  'Recrutement',
  auto:         'Général',
  general:      'Général',
}

// ── Extraction principale ─────────────────────────────────────────────────

export async function extrairePatterns(
  supabase: SupabaseClient,
  tenantId: string
): Promise<MIAAPatterns> {
  try {
    const since30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: convs } = await supabase
      .from('miaa_conversations')
      .select('module, message_user, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since30j)
      .order('created_at', { ascending: false })
      .limit(120)

    if (!convs?.length) {
      return { questions_frequentes: [], problemes_recurrents: [], preferences_utilisateur: [] }
    }

    // ── 1. Questions fréquentes (déduplication fuzzy) ─────────────────────
    const questions = convs
      .map(c => (c.message_user ?? '').trim())
      .filter(q => q.length > 8)
    const qFrequentes = dedupTop(questions, 5)

    // ── 2. Problèmes récurrents ───────────────────────────────────────────
    const allText = convs.map(c => c.message_user ?? '').join(' ')
    const problemes: string[] = []
    for (const { label, pattern, min } of PROBLEME_REGEX) {
      const count = (allText.match(new RegExp(pattern.source, 'gi')) ?? []).length
      if (count >= min) problemes.push(label)
    }

    // ── 3. Préférences (modules les plus utilisés) ────────────────────────
    const moduleCounts: Record<string, number> = {}
    for (const c of convs) {
      const m = c.module ?? 'auto'
      moduleCounts[m] = (moduleCounts[m] ?? 0) + 1
    }
    const topModules = Object.entries(moduleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, n]) => `${MODULE_LABELS[m] ?? m} (${n} question${n > 1 ? 's' : ''})`)

    return {
      questions_frequentes:    qFrequentes,
      problemes_recurrents:    problemes.slice(0, 5),
      preferences_utilisateur: topModules,
    }
  } catch {
    return { questions_frequentes: [], problemes_recurrents: [], preferences_utilisateur: [] }
  }
}

// ── Déduplication : garde les N premières questions uniques ───────────────

function dedupTop(strings: string[], max: number): string[] {
  const seen = new Set<string>()
  const out:  string[] = []
  for (const s of strings) {
    const norm = s.slice(0, 60).toLowerCase().replace(/[^a-záàâéèêîïôùûç\s]/g, '').trim()
    if (norm.length < 6) continue
    if (!seen.has(norm)) {
      seen.add(norm)
      out.push(s.slice(0, 90))
    }
    if (out.length >= max) break
  }
  return out
}

// ── Contexte métier enrichi ───────────────────────────────────────────────

export async function extraireContexteMetier(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Record<string, unknown>> {
  try {
    const [memRes, convCountRes] = await Promise.all([
      supabase.from('miaa_memory')
        .select('nb_conversations, derniere_analyse')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase.from('miaa_conversations')
        .select('module', { count: 'exact', head: false })
        .eq('tenant_id', tenantId)
        .limit(1),
    ])

    const totalConvs = (convCountRes as { count?: number }).count ?? 0

    return {
      total_conversations_historique: totalConvs,
      depuis_le:                      memRes.data?.derniere_analyse ?? null,
      mois_actif:                     new Date().toISOString().slice(0, 7),
    }
  } catch {
    return {}
  }
}
