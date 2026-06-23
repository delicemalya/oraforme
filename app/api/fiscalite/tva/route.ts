import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerTVA } from '@/lib/fiscalite/engine'
import type { PaysFiscal } from '@/lib/fiscalite/types'

export const dynamic = 'force-dynamic'

// SYSCOHADA Révisé 2017 — TVA collectée 4441 · TVA récupérable 4446
// Norme codebase : 4 chiffres (4441, 4442…) après migration 119+131.
// '441' = filet de sécurité pour sante_facture antérieures à migration 131.
// '441000' = filet de sécurité pour écritures échappant au trigger de normalisation.
const TVA_COLLECTEE_ACCOUNTS  = ['4441', '4442', '441', '441000']
const TVA_DEDUCTIBLE_ACCOUNTS = ['4445', '4446', '445600', '445700']

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

  let q = supabaseAdmin
    .from('journal_entries')
    .select('id, date_operation, libelle, debit_account, credit_account, montant')
    .eq('tenant_id', ctx.tid)
    .eq('fiscal_year', annee)

  if (mois) {
    const from = `${annee}-${String(mois).padStart(2, '0')}-01`
    const to   = `${annee}-${String(mois).padStart(2, '0')}-31`
    q = q.gte('date_operation', from).lte('date_operation', to)
  }

  const { data: entries, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build monthly declarations
  const months = mois ? [mois] : Array.from({ length: 12 }, (_, i) => i + 1)
  const declarations = months.map(m => {
    const mvs = (entries ?? []).filter(e => new Date(e.date_operation).getMonth() + 1 === m)

    const tva_collectee = mvs
      .filter(e => TVA_COLLECTEE_ACCOUNTS.includes(e.credit_account))
      .reduce((s, e) => s + e.montant, 0)

    const tva_deductible = mvs
      .filter(e => TVA_DEDUCTIBLE_ACCOUNTS.includes(e.debit_account))
      .reduce((s, e) => s + e.montant, 0)

    const resultat = calculerTVA(tva_collectee, tva_deductible, pays)

    return {
      mois: m,
      annee,
      ...resultat,
      mouvements_count: mvs.length,
    }
  })

  const totaux = {
    tva_collectee: declarations.reduce((s, d) => s + d.tva_collectee, 0),
    tva_deductible: declarations.reduce((s, d) => s + d.tva_deductible, 0),
    total_a_payer: declarations.reduce((s, d) => s + d.total_a_payer, 0),
    credit_tva: declarations.reduce((s, d) => s + d.credit_tva, 0),
    ca_ht: declarations.reduce((s, d) => s + d.ca_ht, 0),
  }

  return NextResponse.json({ declarations, totaux, pays, annee })
}
