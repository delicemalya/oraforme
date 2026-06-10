/**
 * lib/miaa/notifications.ts — Moteur d'alertes proactives MIAA+
 * Génère des notifications fiscales, RH, trésorerie, stock depuis les données Supabase.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type NotifType = 'fiscal' | 'tresorerie' | 'rh' | 'stock' | 'facture' | 'info'
export type NotifPriority = 'critical' | 'high' | 'medium' | 'low'

export interface MIAANotification {
  id:          string
  type:        NotifType
  priority:    NotifPriority
  titre:       string
  message:     string
  action_url?: string
  action_label?:string
  lu:          boolean
  created_at:  string
  expires_at?: string
}

// ── Calendrier fiscal Congo-Brazzaville ────────────────────────────────────────

function daysUntil(day: number, nextMonth = false): number {
  const now  = new Date()
  const year = now.getFullYear()
  const mois = nextMonth ? now.getMonth() + 1 : now.getMonth()
  const target = new Date(year, mois, day)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function fiscalAlerts(): MIAANotification[] {
  const alerts: MIAANotification[] = []
  const now = new Date()
  const jour = now.getDate()

  // TVA trimestrielle : 15 du mois suivant chaque trimestre
  const moisTVA = [1, 4, 7, 10] // jan, avr, jul, oct
  const isTVAMonth = moisTVA.includes(now.getMonth() + 1)
  if (isTVAMonth) {
    const days = daysUntil(15, false)
    if (days >= 0 && days <= 20) {
      alerts.push({
        id: `tva-${now.getMonth()}`,
        type: 'fiscal', priority: days <= 5 ? 'critical' : 'high',
        titre: `Déclaration TVA — J${days > 0 ? '-' + days : '0'}`,
        message: `La déclaration TVA trimestrielle est due le 15 ${['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'][now.getMonth()]}. Pensez à compiler vos factures.`,
        action_url: '/dashboard/comptabilite',
        action_label: 'Voir la comptabilité',
        lu: false, created_at: now.toISOString(),
      })
    }
  }

  // CNSS : 20 du mois suivant
  const daysCNSS = daysUntil(20, true)
  if (daysCNSS >= 0 && daysCNSS <= 15) {
    alerts.push({
      id: `cnss-${now.getMonth()}`,
      type: 'rh', priority: daysCNSS <= 5 ? 'critical' : 'high',
      titre: `CNSS — Cotisations du mois en cours`,
      message: `Les cotisations CNSS (salariés + patronales) sont dues le 20 du mois prochain. Vérifiez les bulletins de paie.`,
      action_url: '/dashboard/rh',
      action_label: 'Gérer la paie',
      lu: false, created_at: now.toISOString(),
    })
  }

  // Patente : janvier chaque année
  if (now.getMonth() === 0 && jour <= 31) {
    alerts.push({
      id: `patente-${now.getFullYear()}`,
      type: 'fiscal', priority: jour <= 15 ? 'high' : 'medium',
      titre: 'Déclaration Patente — Janvier',
      message: 'La déclaration de patente annuelle est à déposer en janvier. Préparez vos justificatifs de chiffre d\'affaires.',
      action_url: '/dashboard/parametres/declarations',
      action_label: 'Calendrier fiscal',
      lu: false, created_at: now.toISOString(),
    })
  }

  return alerts
}

// ── Alertes depuis la base de données ──────────────────────────────────────────

export async function genererNotifications(
  supabase: SupabaseClient,
  tenantId: string
): Promise<MIAANotification[]> {
  const notifications: MIAANotification[] = []
  const now = new Date()

  // 1. Alertes fiscales (calendrier statique)
  notifications.push(...fiscalAlerts())

  try {
    const [factRes, stockRes, rhRes, txRes] = await Promise.all([
      // Factures impayées > 30 jours
      supabase.from('factures')
        .select('id, numero, client_nom, total, date_echeance')
        .eq('tenant_id', tenantId)
        .in('statut', ['envoyee', 'retard'])
        .lt('date_echeance', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),

      // Stock en rupture
      supabase.from('stock_articles')
        .select('id, nom, quantite, seuil_alerte')
        .eq('tenant_id', tenantId)
        .filter('quantite', 'lte', 'seuil_alerte'),

      // CDD qui expirent dans 30 jours
      supabase.from('employes')
        .select('id, prenom, nom, date_fin_contrat, type_contrat')
        .eq('tenant_id', tenantId)
        .eq('type_contrat', 'CDD')
        .eq('statut', 'actif')
        .lte('date_fin_contrat', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
        .gte('date_fin_contrat', now.toISOString().slice(0, 10)),

      // Trésorerie : solde faible
      supabase.from('transactions')
        .select('type, montant')
        .eq('tenant_id', tenantId)
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ])

    // Factures impayées
    const factures = factRes.data ?? []
    if (factures.length > 0) {
      const total = factures.reduce((s, f) => s + (f.total ?? 0), 0)
      notifications.push({
        id: `factures-impayees-${now.getMonth()}`,
        type: 'facture',
        priority: factures.length >= 5 ? 'critical' : 'high',
        titre: `${factures.length} facture${factures.length > 1 ? 's' : ''} impayée${factures.length > 1 ? 's' : ''} > 30 jours`,
        message: `Total en souffrance : ${new Intl.NumberFormat('fr-FR').format(total)} FCFA. La plus ancienne : ${factures[0]?.client_nom ?? '—'} (${factures[0]?.numero ?? '—'}).`,
        action_url: '/dashboard/facturation',
        action_label: 'Envoyer des relances',
        lu: false, created_at: now.toISOString(),
      })
    }

    // Stock en rupture
    const ruptures = (stockRes.data ?? []).filter(a => (a.quantite ?? 0) <= (a.seuil_alerte ?? 0))
    if (ruptures.length > 0) {
      notifications.push({
        id: `stock-rupture-${now.getDate()}`,
        type: 'stock',
        priority: ruptures.length >= 3 ? 'high' : 'medium',
        titre: `${ruptures.length} article${ruptures.length > 1 ? 's' : ''} en rupture de stock`,
        message: `Articles critiques : ${ruptures.slice(0, 3).map(a => a.nom).join(', ')}${ruptures.length > 3 ? ` et ${ruptures.length - 3} autres` : ''}.`,
        action_url: '/dashboard/stock',
        action_label: 'Gérer le stock',
        lu: false, created_at: now.toISOString(),
      })
    }

    // CDD expirants
    const cddList = rhRes.data ?? []
    if (cddList.length > 0) {
      notifications.push({
        id: `cdd-expiry-${now.getMonth()}`,
        type: 'rh',
        priority: 'high',
        titre: `${cddList.length} CDD expire${cddList.length > 1 ? 'nt' : ''} dans 30 jours`,
        message: `Employés concernés : ${cddList.slice(0, 3).map(e => `${e.prenom} ${e.nom}`).join(', ')}. Décidez renouvellement ou fin de contrat.`,
        action_url: '/dashboard/rh',
        action_label: 'Voir les contrats',
        lu: false, created_at: now.toISOString(),
      })
    }

    // Trésorerie faible
    const tx = txRes.data ?? []
    const entrees = tx.filter(t => t.type === 'entree').reduce((s, t) => s + (t.montant ?? 0), 0)
    const sorties = tx.filter(t => t.type === 'sortie').reduce((s, t) => s + (t.montant ?? 0), 0)
    const solde = entrees - sorties
    if (solde < 0) {
      notifications.push({
        id: `tresorerie-negative-${now.getDate()}`,
        type: 'tresorerie',
        priority: 'critical',
        titre: 'Trésorerie négative — Action urgente',
        message: `Solde estimé : ${new Intl.NumberFormat('fr-FR').format(solde)} FCFA. Risque de cessation de paiement. Accélérez les encaissements.`,
        action_url: '/dashboard/tresorerie',
        action_label: 'Analyser la trésorerie',
        lu: false, created_at: now.toISOString(),
      })
    } else if (solde < 500_000) {
      notifications.push({
        id: `tresorerie-faible-${now.getDate()}`,
        type: 'tresorerie',
        priority: 'medium',
        titre: 'Trésorerie basse',
        message: `Solde estimé : ${new Intl.NumberFormat('fr-FR').format(solde)} FCFA. Anticipez vos décaissements des prochains jours.`,
        action_url: '/dashboard/tresorerie',
        action_label: 'Voir la trésorerie',
        lu: false, created_at: now.toISOString(),
      })
    }

  } catch {
    // Si Supabase échoue, on garde les alertes fiscales statiques
  }

  // Trier par priorité
  const ordre: Record<NotifPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  return notifications.sort((a, b) => ordre[a.priority] - ordre[b.priority])
}

export async function sauvegarderNotifications(
  supabase: SupabaseClient,
  tenantId: string,
  notifications: MIAANotification[]
): Promise<void> {
  if (!notifications.length) return
  try {
    await supabase.from('miaa_notifications').upsert(
      notifications.map(n => ({
        id:           n.id,
        tenant_id:    tenantId,
        type:         n.type,
        priority:     n.priority,
        titre:        n.titre,
        message:      n.message,
        action_url:   n.action_url ?? null,
        action_label: n.action_label ?? null,
        lu:           false,
        created_at:   n.created_at,
        expires_at:   n.expires_at ?? null,
      })),
      { onConflict: 'id,tenant_id' }
    )
  } catch { /* non-bloquant */ }
}
