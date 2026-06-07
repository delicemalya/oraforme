import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())

  const [{ data: revenue }, { data: clients }] = await Promise.all([
    supabaseAdmin
      .from('oraforme_revenue')
      .select('mois, annee, montant, statut, client_id, created_at')
      .eq('cabinet_tenant_id', ctx.tenantId)
      .eq('annee', annee)
      .order('mois', { ascending: true }),
    supabaseAdmin
      .from('cabinet_clients')
      .select('id, nom_entreprise, statut, frais_oraforme')
      .eq('cabinet_tenant_id', ctx.tenantId)
      .eq('statut', 'actif'),
  ])

  const rows = revenue ?? []
  const total_annee   = rows.reduce((s, r) => s + (r.montant ?? 5000), 0)
  const total_encaisse = rows.filter(r => r.statut === 'paye').reduce((s, r) => s + (r.montant ?? 5000), 0)
  const clients_actifs = clients?.length ?? 0

  // Tableau mensuel
  const par_mois = Array.from({ length: 12 }, (_, i) => {
    const mois = i + 1
    const lignes = rows.filter(r => r.mois === mois)
    return {
      mois,
      nb_clients: lignes.length,
      montant: lignes.reduce((s, r) => s + (r.montant ?? 5000), 0),
      statut: lignes.every(r => r.statut === 'paye') && lignes.length > 0 ? 'paye' : 'en_attente',
    }
  })

  return NextResponse.json({
    annee, clients_actifs, total_annee, total_encaisse,
    revenue_potentiel_mensuel: clients_actifs * 5000,
    par_mois, lignes: rows,
  })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error

  const body = await req.json()
  const now  = new Date()
  const mois  = body.mois  ?? now.getMonth() + 1
  const annee = body.annee ?? now.getFullYear()

  const { data, error: dbErr } = await supabaseAdmin
    .rpc('generer_revenue_mensuel', {
      p_cabinet_tenant_id: ctx.tenantId,
      p_mois: mois,
      p_annee: annee,
    })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ nb_insere: data, mois, annee })
}
