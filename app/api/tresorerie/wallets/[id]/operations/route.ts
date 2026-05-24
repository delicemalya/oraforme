import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { tresoAuth } from '../../../_auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  // Verify wallet belongs to tenant
  const { data: wallet } = await supabaseAdmin
    .from('mobile_money_wallets').select('id').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!wallet) return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  const { data, error } = await supabaseAdmin
    .from('mobile_wallet_operations')
    .select('*')
    .eq('wallet_id', id)
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  // Verify wallet belongs to tenant
  const { data: wallet } = await supabaseAdmin
    .from('mobile_money_wallets').select('id, solde').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!wallet) return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 })

  const body = await req.json()
  const { type, montant, libelle, reference, frais, date_operation } = body

  if (!type || !['entree', 'sortie', 'frais'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide (entree|sortie|frais)' }, { status: 400 })
  }
  if (!montant || Number(montant) <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }
  if (!libelle?.trim()) {
    return NextResponse.json({ error: 'Libellé requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('mobile_wallet_operations')
    .insert({
      tenant_id:      auth.tenantId,
      wallet_id:      id,
      type,
      montant:        Number(montant),
      libelle:        libelle.trim(),
      reference:      reference      || null,
      frais:          Number(frais)  || 0,
      date_operation: date_operation || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
