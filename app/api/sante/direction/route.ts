import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getHisKPIs } from '@/lib/sante/his-kpis'

export { getHisKPIs } from '@/lib/sante/his-kpis'

export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const kpis = await getHisKPIs(ctx.tenantId)

  // Monthly CA history (6 months)
  const historique = []
  for (let i = 5; i >= 0; i--) {
    const d    = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const from = d.toISOString().split('T')[0]
    d.setMonth(d.getMonth() + 1)
    const to   = d.toISOString().split('T')[0]

    const [cR, fR] = await Promise.all([
      supabaseAdmin.from('clinique_consultations').select('montant')
        .eq('tenant_id', ctx.tenantId).gte('date_consult', from).lt('date_consult', to),
      supabaseAdmin.from('his_factures').select('montant_paye')
        .eq('tenant_id', ctx.tenantId).in('statut', ['payee','partielle'])
        .gte('date_facture', from).lt('date_facture', to),
    ])
    const ca_consults = (cR.data ?? []).reduce((s, c) => s + (Number(c.montant) || 0), 0)
    const ca_factures = (fR.data ?? []).reduce((s, f) => s + (Number(f.montant_paye) || 0), 0)
    historique.push({
      mois: new Date(from).toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
      ca:   ca_consults + ca_factures,
    })
  }

  return NextResponse.json({ kpis, historique })
}
