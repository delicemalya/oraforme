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
    .from('virements')
    .select('*, comptes_bancaires!virements_compte_source_id_fkey(intitule, banque), comptes_dest:comptes_bancaires!virements_compte_dest_id_fkey(intitule, banque)')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
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
    compte_source_id, compte_dest_id, montant, libelle,
    date_virement, reference, direction,
    compte_ohada_debit, compte_ohada_credit,
  } = body

  if (!montant || Number(montant) <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }
  if (!libelle?.trim()) {
    return NextResponse.json({ error: 'Libellé requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('virements')
    .insert({
      tenant_id: auth.tenantId,
      compte_source_id: compte_source_id || null,
      compte_dest_id:   compte_dest_id   || null,
      montant:          Number(montant),
      libelle:          libelle.trim(),
      date_virement:    date_virement || new Date().toISOString().slice(0, 10),
      reference:        reference    || null,
      statut:           'en_attente',
      direction:        direction    || null,
      compte_ohada_debit:  compte_ohada_debit  || null,
      compte_ohada_credit: compte_ohada_credit || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
