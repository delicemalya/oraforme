import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/resto/livraisons?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const date = new URL(req.url).searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const dateNext = new Date(date); dateNext.setDate(dateNext.getDate() + 1)

  const { data, error: err } = await supabaseAdmin
    .from('resto_commandes')
    .select('id, items, total, statut, statut_livraison, mode_paiement, numero_recu, client_nom, client_tel, adresse_livraison, note_client, livreur_nom, heure_depart_livraison, heure_livraison_effectuee, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('mode', 'livraison')
    .gte('created_at', date + 'T00:00:00')
    .lt('created_at', dateNext.toISOString().split('T')[0] + 'T00:00:00')
    .order('created_at', { ascending: false })

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ livraisons: data ?? [] })
}

// PATCH /api/resto/livraisons — mettre à jour statut livraison + livreur
export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id, statut_livraison, livreur_nom } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (statut_livraison) {
    updates.statut_livraison = statut_livraison
    if (statut_livraison === 'parti')  updates.heure_depart_livraison   = new Date().toISOString()
    if (statut_livraison === 'livre')  updates.heure_livraison_effectuee = new Date().toISOString()
    // Synchro statut commande
    if (statut_livraison === 'livre')  updates.statut = 'livre'
  }
  if (livreur_nom !== undefined) updates.livreur_nom = livreur_nom

  const { data, error: err } = await supabaseAdmin
    .from('resto_commandes')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .eq('mode', 'livraison')
    .select('id, statut, statut_livraison, livreur_nom')
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ livraison: data })
}
