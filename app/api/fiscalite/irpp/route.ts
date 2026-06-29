import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { computeIRPPSummary, BULLETIN_FISCAL_SELECT } from '@/lib/erp-core/compute/fiscal'

// Barème IRPP Congo — LF n°42-2025 Art. 76 CGI. Utilisé pour l'affichage des tranches uniquement (non recalcul).
const TRANCHES_IRPP = [
  { min: 0,          max: 464_000,   taux: 0,    label: '0 — 464 000' },
  { min: 464_000,    max: 1_000_000, taux: 0.01, label: '464 000 — 1 000 000' },
  { min: 1_000_000,  max: 3_000_000, taux: 0.10, label: '1 000 000 — 3 000 000' },
  { min: 3_000_000,  max: 8_000_000, taux: 0.25, label: '3 000 000 — 8 000 000' },
  { min: 8_000_000,  max: Infinity,  taux: 0.40, label: 'Au-delà de 8 000 000' },
] as const

export const dynamic = 'force-dynamic'

/**
 * GET /api/fiscalite/irpp?mois=5&annee=2026
 * Déclaration IRPP mensuelle agrégée pour la DGI (art. 76 CGI Congo).
 * Totaux via ERP Core (computeIRPPSummary) + détail par employé + tranches.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())
  const mois  = searchParams.get('mois') ? Number(searchParams.get('mois')) : null

  let q = supabaseAdmin
    .from('bulletins_paie')
    .select(`${BULLETIN_FISCAL_SELECT}, employes(nom, matricule, cnss)`)
    .eq('tenant_id', ctx.tid)
    .eq('annee', annee)
    .neq('statut', 'annule')

  if (mois) q = q.eq('mois', mois)

  const { data: bulletins, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = bulletins ?? []

  // Agrégats ERP Core (source unique de vérité)
  const summary = computeIRPPSummary(items, annee, mois)

  // Enrichissement par mois : par_employe + detail_tranches (non disponibles dans ERP Core)
  const declarations = summary.mensuel.map(mp => {
    const mvs = items.filter(b => b.mois === mp.mois)
    if (mvs.length === 0) return null

    const detail_tranches = TRANCHES_IRPP.map(tr => {
      if (mp.base_imposable <= tr.min) return { ...tr, base_dans_tranche: 0, montant: 0 }
      const base = Math.min(mp.base_imposable, tr.max) - tr.min
      return { label: tr.label, taux: tr.taux, base_dans_tranche: base, montant: Math.round(base * tr.taux) }
    }).filter(t => t.base_dans_tranche > 0)

    const par_employe = mvs.map(b => ({
      employe_id: b.employe_id,
      nom:        (b.employes as unknown as { nom: string })?.nom ?? 'N/A',
      matricule:  (b.employes as unknown as { matricule: string })?.matricule ?? '—',
      cnss_num:   (b.employes as unknown as { cnss: string })?.cnss ?? '—',
      brut:       b.brut ?? 0,
      cnss:       b.cnss_salarie ?? 0,
      base_irpp:  Math.max(0, (b.brut ?? 0) - (b.cnss_salarie ?? 0)),
      irpp:       b.irpp ?? 0,
    }))

    return {
      mois:          mp.mois,
      annee,
      nb_employes:   mp.nb_employes,
      brut_total:    mp.brut_total,
      cnss_total:    mp.cnss_total,
      base_imposable: mp.base_imposable,
      irpp_total:    mp.irpp_total,
      detail_tranches,
      par_employe,
    }
  }).filter(Boolean)

  return NextResponse.json({
    annee,
    mois: mois ?? null,
    declarations,
    totaux: summary.totaux,
  })
}
