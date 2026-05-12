import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const body = await req.json()
  const { items, table_num, mode, total, client_nom, client_tel, adresse_livraison, note_client, paiement } = body

  if (!items?.length) {
    return NextResponse.json({ error: 'Panier vide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('resto_commandes')
    .insert({
      tenant_id:         tenantId,
      items,
      table_num:         table_num || null,
      mode:              mode || 'sur_place',
      total:             total || 0,
      statut:            'en_attente',
      client_nom:        client_nom || null,
      client_tel:        client_tel || null,
      adresse_livraison: adresse_livraison || null,
      note_client:       note_client || null,
      paiement:          paiement || 'especes',
      source:            'en_ligne',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commandeId: data.id })
}
