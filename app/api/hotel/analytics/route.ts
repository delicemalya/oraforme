import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/hotel/analytics — KPIs taux occupation, RevPAR, ADR, CA
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url   = new URL(req.url)
  const annee = Number(url.searchParams.get('annee') ?? new Date().getFullYear())
  const mois  = Number(url.searchParams.get('mois')  ?? new Date().getMonth() + 1)

  const dateDebut = `${annee}-${String(mois).padStart(2, '0')}-01`
  const dateFin   = new Date(annee, mois, 0).toISOString().split('T')[0]

  const [
    { count: nbChambres },
    { data: reservations },
    { data: payments },
    { data: expenses },
    { data: rooms },
  ] = await Promise.all([
    supabaseAdmin.from('htl_rooms').select('*', { count: 'exact', head: true }).eq('hotel_id', ctx.tenantId),
    supabaseAdmin.from('htl_reservations').select('nb_nuits, montant_total, statut')
      .eq('hotel_id', ctx.tenantId)
      .not('statut', 'in', '(annulee,no_show)')
      .gte('date_arrivee', dateDebut).lte('date_arrivee', dateFin),
    supabaseAdmin.from('htl_payments').select('montant')
      .eq('hotel_id', ctx.tenantId)
      .gte('created_at', dateDebut + 'T00:00:00').lte('created_at', dateFin + 'T23:59:59'),
    supabaseAdmin.from('htl_expenses').select('montant')
      .eq('hotel_id', ctx.tenantId)
      .gte('date_depense', dateDebut).lte('date_depense', dateFin),
    supabaseAdmin.from('htl_rooms').select('statut').eq('hotel_id', ctx.tenantId),
  ])

  const nb    = nbChambres ?? 0
  const jours = new Date(annee, mois, 0).getDate()
  const res   = reservations ?? []
  const pays  = payments ?? []
  const dep   = expenses ?? []
  const rm    = rooms ?? []

  const nb_occupees      = rm.filter(r => r.statut === 'occupee').length
  const taux_occupation  = nb > 0 ? Math.round(nb_occupees / nb * 100) : 0
  const nuits_vendues    = res.reduce((s, r) => s + (r.nb_nuits ?? 0), 0)
  const ca_mois          = res.reduce((s, r) => s + (r.montant_total ?? 0), 0)
  const encaisse         = pays.reduce((s, p) => s + (p.montant ?? 0), 0)
  const depenses_total   = dep.reduce((s, d) => s + (d.montant ?? 0), 0)
  const resultat         = encaisse - depenses_total
  const adr              = nuits_vendues > 0 ? Math.round(ca_mois / nuits_vendues) : 0
  const revpar           = nb * jours > 0 ? Math.round(ca_mois / (nb * jours)) : 0

  // Historique 12 mois
  const historique = await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const m = ((mois - 1 - i + 12) % 12) + 1
      const a = m > (mois % 12 || 12) ? annee - 1 : annee
      const dD = `${a}-${String(m).padStart(2, '0')}-01`
      const dF = new Date(a, m, 0).toISOString().split('T')[0]
      const { data } = await supabaseAdmin.from('htl_payments').select('montant')
        .eq('hotel_id', ctx.tenantId)
        .gte('created_at', dD + 'T00:00:00').lte('created_at', dF + 'T23:59:59')
      const ca = (data ?? []).reduce((s, p) => s + (p.montant ?? 0), 0)
      return { mois: m, annee: a, ca }
    })
  )

  return NextResponse.json({
    annee, mois,
    kpis: {
      nb_chambres: nb, nb_occupees, taux_occupation,
      nuits_vendues, ca_mois, encaisse, depenses_total, resultat,
      adr, revpar,
    },
    historique: historique.reverse(),
  })
}
