/**
 * lib/miaa/autonomous-engine.ts
 * Moteur autonome MIAA+ — Observer / Analyser / Proposer sans appel IA
 * Retourne des propositions structurées prêtes pour le Centre de Commandement.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MIAAMemory } from './memory'

export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low'
export type ActionType  =
  | 'relance_facture' | 'alerte_tresorerie' | 'rapport_finance'
  | 'rappel_fiscal'   | 'analyse_cv'        | 'audit_anomalie'
  | 'rapport_rh'      | 'rappel_cnss'       | 'rapport_stock' | 'info'

export interface MIAAProposal {
  id:           string
  module:       string
  titre:        string
  description:  string
  action_type:  ActionType
  impact:       ImpactLevel
  action_label: string
  action_href?: string
  payload:      Record<string, unknown>
}

export interface AnalyseResult {
  proposals:        MIAAProposal[]
  modules_analyses: string[]
  score_sante:      number
  nb_alertes:       number
  timestamp:        string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const pid  = (pfx: string) => `${pfx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

// Retourne le nombre de jours avant la prochaine échéance mensuelle fixe
function joursAvantEcheance(jourDuMois: number): number {
  const today  = new Date()
  const cur    = today.getDate()
  const month  = today.getMonth()
  const year   = today.getFullYear()
  const target = cur <= jourDuMois
    ? new Date(year, month, jourDuMois)
    : new Date(year, month + 1, jourDuMois)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

// ── 1. Finance & Trésorerie ────────────────────────────────────────────────────

async function observerFinances(
  supabase: SupabaseClient,
  tenantId: string,
  memory:   MIAAMemory,
): Promise<MIAAProposal[]> {
  const proposals: MIAAProposal[] = []
  const solde = memory.donnees_live.solde_tresorerie

  if (solde < 0) {
    proposals.push({
      id:           pid('treso-neg'),
      module:       'tresorerie',
      titre:        'Trésorerie négative — action immédiate requise',
      description:  `Solde actuel : ${fmt(solde)} FCFA. Risque de blocage des paiements fournisseurs et salaires.`,
      action_type:  'alerte_tresorerie',
      impact:       'critical',
      action_label: 'Voir la trésorerie',
      action_href:  '/dashboard/tresorerie',
      payload:      { solde },
    })
  } else if (solde < 500_000) {
    proposals.push({
      id:           pid('treso-low'),
      module:       'tresorerie',
      titre:        'Trésorerie faible — surveiller les entrées',
      description:  `Solde : ${fmt(solde)} FCFA. Prévoir un suivi quotidien des entrées les 7 prochains jours.`,
      action_type:  'alerte_tresorerie',
      impact:       'high',
      action_label: 'Analyser les flux',
      action_href:  '/dashboard/tresorerie',
      payload:      { solde },
    })
  }

  // Factures impayées > 30 jours
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  if (memory.donnees_live.factures_impayees > 0) {
    const { data: factures } = await supabase
      .from('factures')
      .select('id, numero, montant_ttc, date_echeance')
      .eq('tenant_id', tenantId)
      .in('statut', ['envoyee', 'retard'])
      .lt('date_echeance', thirtyDaysAgo)
      .order('montant_ttc', { ascending: false })
      .limit(20)

    const nb    = factures?.length ?? 0
    const total = (factures ?? []).reduce((s, f) => s + (f.montant_ttc ?? 0), 0)

    if (nb > 0) {
      proposals.push({
        id:           pid('relance'),
        module:       'facturation',
        titre:        `${nb} facture${nb > 1 ? 's' : ''} impayée${nb > 1 ? 's' : ''} > 30 jours`,
        description:  `Total en souffrance : ${fmt(total)} FCFA. Générer des lettres de relance OHADA.`,
        action_type:  'relance_facture',
        impact:       nb >= 5 ? 'critical' : nb >= 2 ? 'high' : 'medium',
        action_label: 'Générer les relances',
        action_href:  '/dashboard/facturation',
        payload:      { facture_ids: (factures ?? []).map(f => f.id), nb, total },
      })
    }
  }

  return proposals
}

// ── 2. Stock ───────────────────────────────────────────────────────────────────

async function observerStock(
  supabase: SupabaseClient,
  tenantId: string,
  memory:   MIAAMemory,
): Promise<MIAAProposal[]> {
  const proposals: MIAAProposal[] = []
  if (memory.donnees_live.stock_alertes === 0) return proposals

  // Articles dont quantite < seuil_alerte
  const { data: articles } = await supabase
    .from('stock_articles')
    .select('id, nom, quantite, seuil_alerte')
    .eq('tenant_id', tenantId)
    .gt('seuil_alerte', 0)
    .limit(50)

  const enRupture = (articles ?? []).filter(a => (a.quantite ?? 0) < (a.seuil_alerte ?? 0))
  const nb        = enRupture.length || memory.donnees_live.stock_alertes

  if (nb > 0) {
    const liste = enRupture.slice(0, 3).map(a => a.nom).join(', ')
    proposals.push({
      id:           pid('stock'),
      module:       'stock',
      titre:        `${nb} article${nb > 1 ? 's' : ''} en rupture de stock`,
      description:  `Articles concernés : ${liste || 'voir la liste complète'}. Commander auprès des fournisseurs.`,
      action_type:  'rapport_stock',
      impact:       nb >= 5 ? 'high' : 'medium',
      action_label: 'Voir le stock critique',
      action_href:  '/dashboard/stocks',
      payload:      { nb_articles: nb, articles: enRupture.slice(0, 10).map(a => a.id) },
    })
  }

  return proposals
}

// ── 3. RH & Social ────────────────────────────────────────────────────────────

async function observerRH(
  supabase: SupabaseClient,
  tenantId: string,
  memory:   MIAAMemory,
): Promise<MIAAProposal[]> {
  const proposals: MIAAProposal[] = []

  // CDD expirant dans 30 jours
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString()
  const { data: cdd } = await supabase
    .from('employes')
    .select('id, prenom, nom, date_fin_contrat')
    .eq('tenant_id', tenantId)
    .eq('type_contrat', 'CDD')
    .lte('date_fin_contrat', in30)
    .gte('date_fin_contrat', new Date().toISOString())
    .limit(10)

  if ((cdd?.length ?? 0) > 0) {
    const noms = (cdd ?? []).slice(0, 3).map(e => `${e.prenom} ${e.nom}`).join(', ')
    proposals.push({
      id:           pid('cdd'),
      module:       'rh',
      titre:        `${cdd!.length} CDD expire${cdd!.length > 1 ? 'nt' : ''} dans moins de 30 jours`,
      description:  `${noms}${cdd!.length > 3 ? '…' : ''}. Décider renouvellement ou fin de contrat.`,
      action_type:  'rapport_rh',
      impact:       'high',
      action_label: 'Gérer les contrats',
      action_href:  '/dashboard/rh',
      payload:      { employe_ids: (cdd ?? []).map(e => e.id) },
    })
  }

  // Rappel CNSS — J-5 avant le 20 du mois
  const joursAvantCNSS = joursAvantEcheance(20)
  if (joursAvantCNSS <= 5 && memory.donnees_live.employes_actifs > 0) {
    proposals.push({
      id:           pid('cnss'),
      module:       'rh',
      titre:        `Cotisations CNSS — échéance dans ${joursAvantCNSS} jour${joursAvantCNSS > 1 ? 's' : ''}`,
      description:  `${memory.donnees_live.employes_actifs} employés actifs. Vérifier les bulletins et préparer le virement CNSS.`,
      action_type:  'rappel_cnss',
      impact:       joursAvantCNSS <= 2 ? 'critical' : 'high',
      action_label: 'Vérifier la paie',
      action_href:  '/dashboard/rh/paie',
      payload:      { jours: joursAvantCNSS, employes: memory.donnees_live.employes_actifs },
    })
  }

  return proposals
}

// ── 4. Fiscal ─────────────────────────────────────────────────────────────────

async function observerFiscalite(_tenantId: string, memory: MIAAMemory): Promise<MIAAProposal[]> {
  const proposals: MIAAProposal[] = []
  const today = new Date()
  const jour  = today.getDate()
  const mois  = today.getMonth() // 0-based

  // TVA Congo — déclaration mensuelle avant le 15 du mois suivant
  const joursAvantTVA = joursAvantEcheance(15)
  if (joursAvantTVA <= 7 && memory.donnees_live.ca_mois > 0) {
    const tva = Math.round(memory.donnees_live.ca_mois * 0.18)
    proposals.push({
      id:           pid('tva'),
      module:       'fiscalite',
      titre:        `Déclaration TVA — dans ${joursAvantTVA} jour${joursAvantTVA > 1 ? 's' : ''}`,
      description:  `TVA estimée sur CA : ${fmt(tva)} FCFA (18%). Préparer la déclaration DGI avant le 15.`,
      action_type:  'rappel_fiscal',
      impact:       joursAvantTVA <= 3 ? 'critical' : 'high',
      action_label: 'Préparer la déclaration',
      action_href:  '/dashboard/fiscalite',
      payload:      { tva_estimee: tva, jours: joursAvantTVA },
    })
  }

  // Patente — renouvellement annuel (janvier)
  if (mois === 0 && jour <= 31) {
    proposals.push({
      id:           pid('patente'),
      module:       'fiscalite',
      titre:        'Renouvellement de la patente — janvier en cours',
      description:  'La patente doit être renouvelée avant le 31 janvier. Contacter la DGI pour le paiement.',
      action_type:  'rappel_fiscal',
      impact:       jour > 20 ? 'critical' : 'medium',
      action_label: 'Voir les obligations fiscales',
      action_href:  '/dashboard/fiscalite',
      payload:      { type: 'patente', annee: today.getFullYear() },
    })
  }

  // IS — acompte trimestriel (mois 3, 6, 9)
  if ([2, 5, 8].includes(mois) && jour >= 25) {
    const trimestre = [2, 5, 8].indexOf(mois) + 1
    proposals.push({
      id:           pid('is-acompte'),
      module:       'fiscalite',
      titre:        `Acompte IS T${trimestre} — échéance fin du mois`,
      description:  `Acompte sur l'Impôt sur les Sociétés T${trimestre}. Calculer et verser avant fin du mois.`,
      action_type:  'rappel_fiscal',
      impact:       'high',
      action_label: 'Calculer l\'acompte IS',
      action_href:  '/dashboard/fiscalite',
      payload:      { trimestre, annee: today.getFullYear() },
    })
  }

  return proposals
}

// ── 5. Recrutement ─────────────────────────────────────────────────────────────

async function observerRecrutement(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<MIAAProposal[]> {
  const proposals: MIAAProposal[] = []

  // Candidats non traités depuis 7 jours
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: candidats } = await supabase
    .from('candidats')
    .select('id, created_at')
    .eq('tenant_id', tenantId)
    .eq('statut', 'nouveau')
    .lt('created_at', sevenDaysAgo)
    .limit(30)

  const nb = candidats?.length ?? 0
  if (nb > 0) {
    proposals.push({
      id:           pid('cv'),
      module:       'recrutement',
      titre:        `${nb} candidature${nb > 1 ? 's' : ''} en attente depuis 7+ jours`,
      description:  `Analyser les profils et sélectionner les top candidats à convoquer en entretien.`,
      action_type:  'analyse_cv',
      impact:       nb >= 10 ? 'high' : 'medium',
      action_label: 'Analyser les candidatures',
      action_href:  '/dashboard/rh/recrutement',
      payload:      { candidat_ids: (candidats ?? []).map(c => c.id), nb },
    })
  }

  return proposals
}

// ── Score de santé global ──────────────────────────────────────────────────────
// 100 = parfait, 0 = urgences multiples

function calculerScoreSante(proposals: MIAAProposal[]): number {
  const penalites: Record<ImpactLevel, number> = {
    critical: 25, high: 12, medium: 5, low: 2,
  }
  const total = proposals.reduce((s, p) => s + penalites[p.impact], 0)
  return Math.max(0, 100 - total)
}

// ── Moteur principal ───────────────────────────────────────────────────────────

export async function runAgentAnalysis(
  supabase: SupabaseClient,
  tenantId: string,
  memory:   MIAAMemory,
): Promise<AnalyseResult> {
  const [financeP, stockP, rhP, recrutP, fiscalP] = await Promise.allSettled([
    observerFinances(supabase, tenantId, memory),
    observerStock(supabase, tenantId, memory),
    observerRH(supabase, tenantId, memory),
    observerRecrutement(supabase, tenantId),
    observerFiscalite(tenantId, memory),
  ])

  const proposals: MIAAProposal[] = [
    ...(financeP.status === 'fulfilled' ? financeP.value : []),
    ...(stockP.status   === 'fulfilled' ? stockP.value   : []),
    ...(rhP.status      === 'fulfilled' ? rhP.value      : []),
    ...(recrutP.status  === 'fulfilled' ? recrutP.value  : []),
    ...(fiscalP.status  === 'fulfilled' ? fiscalP.value  : []),
  ]

  // Trier par impact décroissant
  const ORDER: Record<ImpactLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  proposals.sort((a, b) => ORDER[a.impact] - ORDER[b.impact])

  const nb_alertes = proposals.filter(p => p.impact === 'critical').length

  return {
    proposals,
    modules_analyses: ['finance', 'stock', 'rh', 'recrutement', 'fiscalite'],
    score_sante:      calculerScoreSante(proposals),
    nb_alertes,
    timestamp:        new Date().toISOString(),
  }
}

// ── Persistance des propositions ───────────────────────────────────────────────

export async function sauvegarderProposals(
  supabase:  SupabaseClient,
  tenantId:  string,
  proposals: MIAAProposal[],
): Promise<void> {
  if (!proposals.length) return

  // Supprimer les pending précédentes (nouvelle analyse remplace l'ancienne)
  await supabase
    .from('miaa_proposals')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('statut', 'pending')

  if (!proposals.length) return

  const rows = proposals.map(p => ({
    tenant_id:    tenantId,
    module:       p.module,
    titre:        p.titre,
    description:  p.description,
    action_type:  p.action_type,
    impact:       p.impact,
    action_label: p.action_label,
    action_href:  p.action_href ?? null,
    payload:      p.payload,
    statut:       'pending',
  }))

  await supabase.from('miaa_proposals').insert(rows)
}

export async function chargerProposals(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<MIAAProposal[]> {
  const { data } = await supabase
    .from('miaa_proposals')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []).map(row => ({
    id:           row.id,
    module:       row.module,
    titre:        row.titre,
    description:  row.description,
    action_type:  row.action_type,
    impact:       row.impact,
    action_label: row.action_label,
    action_href:  row.action_href,
    payload:      row.payload ?? {},
  }))
}
