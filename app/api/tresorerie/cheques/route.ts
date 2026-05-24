import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { tresoAuth } from '../_auth'

export async function GET(req: NextRequest) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const limit  = parseInt(searchParams.get('limit') || '50')

  let query = supabaseAdmin
    .from('cheques')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('date_emission', { ascending: false })
    .limit(limit)

  if (statut) query = query.eq('statut', statut)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const {
    numero_cheque, beneficiaire, montant, date_emission,
    date_echeance, banque, compte_bancaire_id, motif, tiers_id,
  } = body

  if (!numero_cheque?.trim()) return NextResponse.json({ error: 'Numéro chèque requis' }, { status: 400 })
  if (!beneficiaire?.trim())  return NextResponse.json({ error: 'Bénéficiaire requis' }, { status: 400 })
  if (!montant || Number(montant) <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('cheques')
    .insert({
      tenant_id:          auth.tenantId,
      numero_cheque:      numero_cheque.trim(),
      beneficiaire:       beneficiaire.trim(),
      montant:            Number(montant),
      date_emission:      date_emission || new Date().toISOString().slice(0, 10),
      date_echeance:      date_echeance || null,
      banque:             banque        || null,
      compte_bancaire_id: compte_bancaire_id || null,
      motif:              motif         || null,
      tiers_id:           tiers_id      || null,
      statut:             'en_attente',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
