import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerCNSSAggrege } from '@/lib/fiscalite/engine'
import type { PaysFiscal } from '@/lib/fiscalite/types'
import { getPaysConfig } from '@/lib/fiscalite/pays'

export const dynamic = 'force-dynamic'

// GET /api/fiscalite/cnss?annee=2026&mois=5&pays=CG
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())
  const mois  = searchParams.get('mois') ? Number(searchParams.get('mois')) : null
  const pays  = (searchParams.get('pays') ?? 'CG') as PaysFiscal

  let q = supabaseAdmin
    .from('bulletins_paie')
    .select('id, mois, annee, salaire_brut, cnss_salarie, cnss_patronal, irpp, salaire_net')
    .eq('tenant_id', ctx.tid)
    .eq('annee', annee)

  if (mois) q = q.eq('mois', mois)

  const { data: bulletins, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cfg = getPaysConfig(pays)

  // Build monthly CNSS data
  const months = mois ? [mois] : Array.from({ length: 12 }, (_, i) => i + 1)
  const declarations = months.map(m => {
    const mvsMois = (bulletins ?? []).filter(b => b.mois === m)
    const result = calculerCNSSAggrege(
      mvsMois.map(b => ({ salaire_brut: b.salaire_brut })),
      pays,
    )

    // Use stored values for accuracy
    const cnss_salarie_stored  = mvsMois.reduce((s, b) => s + (b.cnss_salarie ?? 0), 0)
    const cnss_patronal_stored = mvsMois.reduce((s, b) => s + (b.cnss_patronal ?? 0), 0)
    const irpp_stored          = mvsMois.reduce((s, b) => s + (b.irpp ?? 0), 0)

    return {
      mois: m,
      annee,
      nb_employes: mvsMois.length,
      salaire_brut_total: result.salaire_brut_total,
      cnss_salarie:   pays === 'CG' ? cnss_salarie_stored : result.cotisation_salarie,
      cnss_patronal:  pays === 'CG' ? cnss_patronal_stored : result.cotisation_patronale,
      irpp_total:     irpp_stored,
      total_cnss:     pays === 'CG' ? (cnss_salarie_stored + cnss_patronal_stored) : result.total_cnss,
    }
  })

  const totaux = {
    salaire_brut:  declarations.reduce((s, d) => s + d.salaire_brut_total, 0),
    cnss_salarie:  declarations.reduce((s, d) => s + d.cnss_salarie, 0),
    cnss_patronal: declarations.reduce((s, d) => s + d.cnss_patronal, 0),
    irpp_total:    declarations.reduce((s, d) => s + d.irpp_total, 0),
    total_cnss:    declarations.reduce((s, d) => s + d.total_cnss, 0),
  }

  return NextResponse.json({
    declarations,
    totaux,
    pays,
    annee,
    config: {
      nom: cfg.cnss.nom,
      acronyme: cfg.cnss.acronyme,
      taux_salarie: cfg.cnss.taux_salarie,
      taux_patronal: cfg.cnss.taux_patronal,
      plafond: cfg.cnss.plafond_mensuel,
    },
  })
}
