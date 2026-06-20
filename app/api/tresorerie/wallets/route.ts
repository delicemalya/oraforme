import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { tresoAuth } from '../_auth'

export async function GET() {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('mobile_money_wallets')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { operateur, numero, intitule, solde_initial } = body

  if (!operateur?.trim()) return NextResponse.json({ error: 'Opérateur requis' }, { status: 400 })
  if (!numero?.trim())    return NextResponse.json({ error: 'Numéro requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('mobile_money_wallets')
    .insert({
      tenant_id:      auth.tenantId,
      operateur:      operateur.trim(),
      numero:         numero.trim(),
      intitule:       intitule?.trim() || operateur.trim(),
      solde:          Number(solde_initial) || 0,
      actif:          true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
