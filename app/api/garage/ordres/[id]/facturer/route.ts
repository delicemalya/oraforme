import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { totauxOrdre } from '@/lib/garage/ordres'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/garage/ordres/[id]/facturer — facturation atomique d'un OR terminé.
 *
 * Montants calculés ici par le moteur fiscal central (jamais de taux local),
 * revérifiés en base par fn_garage_facturer_ordre (migration 189) qui crée en
 * UNE transaction : facture + lignes + sorties de stock + STK-002 + FAC-001.
 * Idempotent : un OR déjà facturé renvoie sa facture (replay: true).
 * Le règlement se fait ensuite dans le module Facturation (FAC-002).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const { data: ordre } = await supabaseAdmin
    .from('garage_ordres').select('id, statut, facture_id').eq('id', id).eq('tenant_id', ctx.tid).maybeSingle()
  if (!ordre) return NextResponse.json({ error: 'Ordre introuvable' }, { status: 404 })
  if (ordre.facture_id) return NextResponse.json({ data: { facture_id: ordre.facture_id }, replay: true })

  const { data: lignes } = await supabaseAdmin
    .from('garage_ordre_lignes').select('quantite, prix_unitaire').eq('ordre_id', id).eq('tenant_id', ctx.tid)
  if (!lignes?.length) return NextResponse.json({ error: 'OR sans ligne facturable' }, { status: 400 })

  const { ht, tva, ca, ttc } = totauxOrdre(lignes)
  const today = new Date().toISOString().split('T')[0]

  const { data: result, error } = await supabaseAdmin.rpc('fn_garage_facturer_ordre', {
    p_tenant_id:   ctx.tid,
    p_ordre_id:    id,
    p_montant_ht:  ht,
    p_montant_tva: tva,
    p_montant_ca:  ca,
    p_montant_ttc: ttc,
    p_event_date:  today,
    p_fiscal_year: new Date().getFullYear(),
  })

  // Stock insuffisant, OR non terminé, comptabilisation non aboutie : tout est annulé.
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })

  const row = Array.isArray(result) ? result[0] : result
  const { facture_id, replay } = row as { facture_id: string; replay: boolean }
  return NextResponse.json({ data: { facture_id, ht, tva, ca, ttc }, replay }, { status: replay ? 200 : 201 })
}
