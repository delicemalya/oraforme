import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerCNSSAggrege } from '@/lib/fiscalite/engine'
import type { PaysFiscal } from '@/lib/fiscalite/types'
import { getPaysConfig } from '@/lib/fiscalite/pays'
import { computeCNSSSummary, BULLETIN_FISCAL_SELECT } from '@/lib/erp-core/compute/fiscal'

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
    .select(BULLETIN_FISCAL_SELECT)
    .eq('tenant_id', ctx.tid)
    .eq('annee', annee)

  if (mois) q = q.eq('mois', mois)

  const { data: bulletins, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cfg     = getPaysConfig(pays)
  const items   = bulletins ?? []

  // ERP Core — agrégation depuis valeurs stockées (précision maximale)
  const summary = computeCNSSSummary(items, annee, mois)

  const months = mois ? [mois] : Array.from({ length: 12 }, (_, i) => i + 1)
  const declarations = months.map(m => {
    const mp = summary.mensuel.find(p => p.mois === m)
    if (!mp || mp.nb_employes === 0) return null

    // Pour pays autres que CG : recalcul CNSS selon barème national
    if (pays !== 'CG') {
      const mvsMois = items.filter(b => b.mois === m)
      const result  = calculerCNSSAggrege(mvsMois.map(b => ({ salaire_brut: b.brut })), pays)
      return {
        mois: m, annee, nb_employes: mp.nb_employes,
        salaire_brut_total: result.salaire_brut_total,
        cnss_salarie:   result.cotisation_salarie,
        cnss_patronal:  result.cotisation_patronale,
        irpp_total:     mp.brut_total, // irpp non agrégé ici pour non-CG
        total_cnss:     result.total_cnss,
      }
    }

    return {
      mois: m, annee,
      nb_employes:        mp.nb_employes,
      salaire_brut_total: mp.brut_total,
      cnss_salarie:       mp.cnss_salarie,
      cnss_patronal:      mp.cnss_patronal,
      irpp_total:         items.filter(b => b.mois === m && b.statut !== 'annule').reduce((s, b) => s + (b.irpp ?? 0), 0),
      total_cnss:         mp.total_cnss,
    }
  }).filter(Boolean)

  const totaux = {
    salaire_brut:  summary.totaux.brut_total,
    cnss_salarie:  summary.totaux.cnss_salarie,
    cnss_patronal: summary.totaux.cnss_patronal,
    irpp_total:    items.filter(b => b.statut !== 'annule').reduce((s, b) => s + (b.irpp ?? 0), 0),
    total_cnss:    summary.totaux.total_cnss,
  }

  return NextResponse.json({
    declarations,
    totaux,
    pays,
    annee,
    config: {
      nom:          cfg.cnss.nom,
      acronyme:     cfg.cnss.acronyme,
      taux_salarie: cfg.cnss.taux_salarie,
      taux_patronal: cfg.cnss.taux_patronal,
      plafond:      cfg.cnss.plafond_mensuel,
    },
  })
}
