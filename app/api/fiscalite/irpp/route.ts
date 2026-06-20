import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
// Barème IRPP Congo mensuel — LF n°42-2025 du 31/12/2025 (Art. 76 CGI)
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
 * Retourne : détail par tranche, total IRPP, total employés, masse imposable.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())
  const mois  = searchParams.get('mois') ? Number(searchParams.get('mois')) : null

  let q = supabaseAdmin
    .from('bulletins_paie')
    .select('mois, annee, brut, cnss_salarie, irpp, net, employe_id, employes(nom, matricule, cnss)')
    .eq('tenant_id', ctx.tid)
    .eq('annee', annee)
    .neq('statut', 'annule')

  if (mois) q = q.eq('mois', mois)

  const { data: bulletins, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = bulletins ?? []

  // Agrégation par mois
  const months = mois ? [mois] : Array.from({ length: 12 }, (_, i) => i + 1)

  const declarations = months.map(m => {
    const mvs = items.filter(b => b.mois === m)
    if (mvs.length === 0) return null

    const brut_total       = mvs.reduce((s, b) => s + (b.brut ?? 0), 0)
    const cnss_total       = mvs.reduce((s, b) => s + (b.cnss_salarie ?? 0), 0)
    const base_imposable   = Math.max(0, brut_total - cnss_total)
    const irpp_total       = mvs.reduce((s, b) => s + (b.irpp ?? 0), 0)

    // Répartition par tranche IRPP (agrégée sur la masse)
    const detail_tranches = TRANCHES_IRPP.map(tr => {
      if (base_imposable <= tr.min) return { ...tr, base_dans_tranche: 0, montant: 0 }
      const base = Math.min(base_imposable, tr.max) - tr.min
      return {
        label: tr.label,
        taux: tr.taux,
        base_dans_tranche: base,
        montant: Math.round(base * tr.taux),
      }
    }).filter(t => t.base_dans_tranche > 0)

    // Détail par employé
    const par_employe = mvs.map(b => ({
      employe_id:  b.employe_id,
      nom:         (b.employes as unknown as { nom: string })?.nom ?? 'N/A',
      matricule:   (b.employes as unknown as { matricule: string })?.matricule ?? '—',
      cnss_num:    (b.employes as unknown as { cnss: string })?.cnss ?? '—',
      brut:        b.brut ?? 0,
      cnss:        b.cnss_salarie ?? 0,
      base_irpp:   Math.max(0, (b.brut ?? 0) - (b.cnss_salarie ?? 0)),
      irpp:        b.irpp ?? 0,
    }))

    return {
      mois: m,
      annee,
      nb_employes: mvs.length,
      brut_total,
      cnss_total,
      base_imposable,
      irpp_total,
      detail_tranches,
      par_employe,
    }
  }).filter(Boolean)

  const grand_total_irpp  = declarations.reduce((s, d) => s + (d?.irpp_total ?? 0), 0)
  const grand_total_brut  = declarations.reduce((s, d) => s + (d?.brut_total  ?? 0), 0)
  const grand_total_base  = declarations.reduce((s, d) => s + (d?.base_imposable ?? 0), 0)

  return NextResponse.json({
    annee,
    mois: mois ?? null,
    declarations,
    totaux: {
      brut_total:      grand_total_brut,
      base_imposable:  grand_total_base,
      irpp_total:      grand_total_irpp,
    },
  })
}
