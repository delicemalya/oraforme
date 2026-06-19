import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const [chantiers, devis] = await Promise.all([
    supabaseAdmin
      .from('btp_chantiers')
      .select('id, statut, montant_total')
      .eq('tenant_id', ctx.tid),
    supabaseAdmin
      .from('devis')
      .select('id, statut')
      .eq('tenant_id', ctx.tid)
      .eq('statut', 'en_attente'),
  ])

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: factures } = await supabaseAdmin
    .from('factures')
    .select('montant_ttc')
    .eq('tenant_id', ctx.tid)
    .gte('created_at', startOfMonth)
    .eq('statut', 'payee')

  const ch = chantiers.data ?? []
  const kpis = {
    chantiers_actifs:   ch.filter(c => c.statut === 'en_cours').length,
    chantiers_termines: ch.filter(c => c.statut === 'termine').length,
    ca_mois:            (factures ?? []).reduce((s, f) => s + (f.montant_ttc ?? 0), 0),
    devis_en_attente:   (devis.data ?? []).length,
  }

  return Response.json(kpis)
}
