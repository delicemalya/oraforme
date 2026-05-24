import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { tresoAuth } from '../_auth'

export async function GET(req: NextRequest) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  const { data, error } = await supabaseAdmin
    .from('transfers')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const {
    source_type, source_id,
    dest_type,   dest_id,
    montant,     libelle,
    date_transfer,
  } = body

  if (!source_type || !dest_type) {
    return NextResponse.json({ error: 'Types source/dest requis' }, { status: 400 })
  }
  if (!montant || Number(montant) <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }
  if (!libelle?.trim()) {
    return NextResponse.json({ error: 'Libellé requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      tenant_id:     auth.tenantId,
      source_type,
      source_id:     source_id    || null,
      dest_type,
      dest_id:       dest_id      || null,
      montant:       Number(montant),
      libelle:       libelle.trim(),
      date_transfer: date_transfer || new Date().toISOString().slice(0, 10),
      statut:        'execute',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
