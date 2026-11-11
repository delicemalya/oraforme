import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerTVAUnifie } from '@/lib/fiscalite/engine-adapter'
import type { PaysFiscal } from '@/lib/fiscalite/types'
import {
  computeTVAFromJournal,
  periodeMensuelle,
  BALANCE_SELECT,
  TVA_COLLECTEE_ACCOUNTS,
  TVA_DEDUCTIBLE_ACCOUNTS,
} from '@/lib/erp-core/compute/accounting'

export const dynamic = 'force-dynamic'

// GET /api/fiscalite/tva?annee=2026&mois=5&pays=CG
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())
  const mois  = searchParams.get('mois') ? Number(searchParams.get('mois')) : null
  const pays  = (searchParams.get('pays') ?? 'CG') as PaysFiscal

  // Toujours charger l'année complète : le report de crédit de TVA d'un mois
  // sur l'autre (computeTVAFromJournal) a besoin des mois précédents même
  // quand seul un mois est demandé — filtrer la requête à un seul mois
  // casserait credit_anterieur (il retomberait à 0 au lieu du vrai report).
  const { debut }         = periodeMensuelle(annee, 1)
  const { fin_exclusive } = periodeMensuelle(annee, 12)

  const { data: entries, error } = await supabaseAdmin
    .from('journal_entries')
    .select(BALANCE_SELECT)
    .eq('tenant_id', ctx.tid)
    .eq('fiscal_year', annee)
    .gte('date_operation', debut)
    .lt('date_operation', fin_exclusive)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allEntries = entries ?? []

  // Agrégation ERP Core (source unique) — voir accounting.ts::computeTVAFromJournal
  const summary = computeTVAFromJournal(allEntries, annee)
  const monthPoints = mois ? summary.mensuel.filter(mp => mp.mois === mois) : summary.mensuel

  // Enrichissement d'affichage (ca_ht, taxes_additionnelles) — voir
  // engine-adapter.ts::calculerTVAUnifie. nette/a_payer/credit_tva de ce
  // module NE sont PAS repris : ils viennent du point mensuel canonique
  // (avec report de crédit), seule source autorisée pour ces trois champs.
  const declarations = monthPoints.map(mp => {
    const mvs = allEntries.filter(e => new Date(e.date_operation).getMonth() + 1 === mp.mois)
    // Compter les mouvements TVA uniquement (pas toutes les écritures du mois)
    const mouvements_count = mvs.filter(e =>
      TVA_COLLECTEE_ACCOUNTS.includes(e.credit_account ?? '') ||
      TVA_DEDUCTIBLE_ACCOUNTS.includes(e.debit_account ?? ''),
    ).length

    const { ca_ht, taxes_additionnelles } = calculerTVAUnifie(mp.tva_collectee, mp.tva_deductible, pays)
    return {
      mois: mp.mois, annee,
      tva_collectee: mp.tva_collectee,
      tva_deductible: mp.tva_deductible,
      tva_nette: mp.tva_nette,
      taxes_additionnelles,
      total_a_payer: mp.a_payer,
      credit_tva: mp.credit_nouveau,
      ca_ht,
      mouvements_count,
    }
  })

  const totaux = {
    tva_collectee:  summary.total_collectee,
    tva_deductible: summary.total_deductible,
    total_a_payer:  summary.total_a_payer,
    credit_tva:     summary.credit_fin_periode,
    ca_ht:          declarations.reduce((s, d) => s + d.ca_ht, 0),
  }

  return NextResponse.json({
    declarations, totaux, pays, annee,
    deductible_fiabilite: summary.deductible_fiabilite,
  })
}
