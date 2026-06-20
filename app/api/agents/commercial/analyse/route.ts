import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agents/commercial/analyse
 * Analyse commerciale proactive pour MIAA Commercial :
 * CA, marges, impayés, top clients, pipeline, prévisions, alertes.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  try {
  const now     = new Date()
  const annee   = now.getFullYear()
  const mois    = now.getMonth() + 1
  const debut   = new Date(annee, 0, 1).toISOString().split('T')[0]
  const debutM  = new Date(annee, mois - 1, 1).toISOString().split('T')[0]
  const finM    = new Date(annee, mois, 0).toISOString().split('T')[0]
  const m1debut = new Date(annee, mois - 2, 1).toISOString().split('T')[0]
  const m1fin   = new Date(annee, mois - 1, 0).toISOString().split('T')[0]

  const [
    { data: factures },
    { data: clients },
    { data: opps },
    { data: devis },
    { data: relances },
  ] = await Promise.all([
    supabaseAdmin.from('factures').select('id, invoice_number, client_name, client_id, total, subtotal, tva, ca, statut, date, due_date').eq('tenant_id', ctx.tid).gte('date', debut).order('date', { ascending: false }),
    supabaseAdmin.from('clients').select('id, nom, statut, ca_total, impaye_total, score_risque, nb_impayes, nb_factures').eq('tenant_id', ctx.tid),
    supabaseAdmin.from('crm_opportunites').select('id, titre, etape, montant_estime, probabilite, date_cloture_prevue').eq('tenant_id', ctx.tid),
    supabaseAdmin.from('devis').select('id, total, statut, date').eq('tenant_id', ctx.tid).gte('date', debut),
    supabaseAdmin.from('relances').select('id, created_at').eq('tenant_id', ctx.tid).gte('created_at', `${debutM}T00:00:00`),
  ])

  const facs = factures ?? []
  const cls  = clients  ?? []
  const os   = opps     ?? []
  const dvs  = devis    ?? []

  // ── CA & Marges ─────────────────────────────────────────────────────────

  const facPayees   = facs.filter(f => f.statut === 'payee')
  const facMois     = facPayees.filter(f => f.date >= debutM && f.date <= finM)
  const facMois1    = facPayees.filter(f => f.date >= m1debut && f.date <= m1fin)

  const ca_ytd      = facPayees.reduce((s, f) => s + (f.subtotal ?? 0), 0)
  const tva_ytd     = facPayees.reduce((s, f) => s + (f.tva ?? 0), 0)
  const ttc_ytd     = facPayees.reduce((s, f) => s + (f.total ?? 0), 0)

  const ca_mois     = facMois.reduce((s, f) => s + (f.subtotal ?? 0), 0)
  const ca_mois1    = facMois1.reduce((s, f) => s + (f.subtotal ?? 0), 0)
  const evolution   = ca_mois1 > 0 ? Math.round((ca_mois - ca_mois1) * 100 / ca_mois1) : 0

  // ── Impayés ──────────────────────────────────────────────────────────────

  const today = now.toISOString().split('T')[0]
  const facImpayes = facs.filter(f => ['envoyee', 'retard'].includes(f.statut))
  const totalImpaye = facImpayes.reduce((s, f) => s + (f.total ?? 0), 0)
  const impayes30j  = facImpayes.filter(f => {
    if (!f.due_date) return false
    const j = Math.ceil((new Date(today).getTime() - new Date(f.due_date).getTime()) / 86400000)
    return j > 30
  })

  // ── Top clients ──────────────────────────────────────────────────────────

  const topClients = cls
    .filter(c => (c.ca_total ?? 0) > 0)
    .sort((a, b) => (b.ca_total ?? 0) - (a.ca_total ?? 0))
    .slice(0, 10)
    .map(c => ({
      id: c.id, nom: c.nom, ca: c.ca_total, impaye: c.impaye_total,
      score: c.score_risque, nb_factures: c.nb_factures,
    }))

  // ── Clients à risque ─────────────────────────────────────────────────────

  const clientsRisque = cls
    .filter(c => (c.score_risque ?? 50) < 40 && (c.impaye_total ?? 0) > 0)
    .sort((a, b) => (b.impaye_total ?? 0) - (a.impaye_total ?? 0))
    .slice(0, 5)

  // ── Pipeline ─────────────────────────────────────────────────────────────

  const pipeline = os.reduce((acc, o) => {
    if (!acc[o.etape]) acc[o.etape] = { count: 0, montant: 0, pondere: 0 }
    acc[o.etape].count++
    acc[o.etape].montant += o.montant_estime ?? 0
    acc[o.etape].pondere += (o.montant_estime ?? 0) * (o.probabilite ?? 20) / 100
    return acc
  }, {} as Record<string, { count: number; montant: number; pondere: number }>)

  const pipeline_pondere = os.filter(o => !['gagne','perdu'].includes(o.etape))
    .reduce((s, o) => s + (o.montant_estime ?? 0) * (o.probabilite ?? 20) / 100, 0)

  // Opportunités à clôturer ce mois
  const opp_closing = os.filter(o => o.date_cloture_prevue >= debutM && o.date_cloture_prevue <= finM && !['gagne','perdu'].includes(o.etape))

  // ── Devis ────────────────────────────────────────────────────────────────

  const devis_envoyes  = dvs.filter(d => d.statut === 'envoye').length
  const devis_acceptes = dvs.filter(d => d.statut === 'accepte').length
  const taux_conversion = devis_envoyes > 0 ? Math.round(devis_acceptes * 100 / (devis_envoyes + devis_acceptes)) : 0

  // ── Alertes ──────────────────────────────────────────────────────────────

  const alertes: { type: string; gravite: 'critique' | 'haute' | 'moyenne'; detail: string }[] = []

  if (totalImpaye > ca_ytd * 0.2) {
    alertes.push({ type: 'impaye_eleve', gravite: 'critique', detail: `Impayés élevés : ${Math.round(totalImpaye).toLocaleString('fr-FR')} FCFA représentent ${Math.round(totalImpaye * 100 / Math.max(ca_ytd, 1))}% du CA YTD` })
  }
  if (impayes30j.length >= 3) {
    alertes.push({ type: 'retards_critiques', gravite: 'critique', detail: `${impayes30j.length} factures en retard de plus de 30 jours — risque de créances douteuses` })
  }
  if (evolution < -15) {
    alertes.push({ type: 'ca_baisse', gravite: 'haute', detail: `CA en baisse de ${Math.abs(evolution)}% vs mois précédent — analyser les causes` })
  }
  if (taux_conversion < 30 && devis_envoyes >= 3) {
    alertes.push({ type: 'conversion_faible', gravite: 'moyenne', detail: `Taux de conversion devis: ${taux_conversion}% — identifier les objections fréquentes` })
  }
  if (clientsRisque.length >= 2) {
    alertes.push({ type: 'clients_risque', gravite: 'haute', detail: `${clientsRisque.length} clients à score de risque faible avec des impayés — renforcer le suivi` })
  }
  if (opp_closing.length > 0) {
    alertes.push({ type: 'opp_closing', gravite: 'moyenne', detail: `${opp_closing.length} opportunité(s) à clôturer ce mois — agir rapidement` })
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    periode: { mois, annee, debut, debutM, finM },

    ca: {
      ytd:      ca_ytd,
      mois:     ca_mois,
      mois_prec: ca_mois1,
      evolution_pct: evolution,
      tva_ytd,
      ttc_ytd,
      nb_factures_payees: facPayees.length,
      nb_factures_mois:   facMois.length,
    },

    impayes: {
      total:       totalImpaye,
      nb_factures: facImpayes.length,
      critiques_30j: impayes30j.length,
      nb_relances_mois: (relances ?? []).length,
    },

    devis: {
      envoyes:   devis_envoyes,
      acceptes:  devis_acceptes,
      taux_conversion,
    },

    clients: {
      total:     cls.length,
      actifs:    cls.filter(c => c.statut === 'actif').length,
      prospects: cls.filter(c => c.statut === 'prospect').length,
      top:       topClients,
      a_risque:  clientsRisque,
    },

    pipeline: {
      par_etape:    pipeline,
      pondere_total: pipeline_pondere,
      nb_opps:      os.length,
      a_cloturer_mois: opp_closing.length,
    },

    alertes: alertes.sort((a, b) => {
      const p = { critique: 0, haute: 1, moyenne: 2 }
      return p[a.gravite] - p[b.gravite]
    }),

    score_performance: Math.max(0, Math.min(100,
      50
      + (evolution > 0 ? Math.min(20, evolution) : Math.max(-20, evolution))
      + (taux_conversion > 50 ? 10 : taux_conversion > 30 ? 5 : 0)
      - (totalImpaye > ca_ytd * 0.15 ? 15 : totalImpaye > ca_ytd * 0.05 ? 5 : 0)
      - (alertes.filter(a => a.gravite === 'critique').length * 10)
    )),
  })
  } catch (e) {
    console.error('[agents/commercial/analyse]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
