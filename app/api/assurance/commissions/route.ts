import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id')
      .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const statut_paiement = searchParams.get('statut')
    const agent_id        = searchParams.get('agent_id')

    let query = supabase
      .from('ass_commissions')
      .select('*, ass_agents(nom, prenom, type_agent), ass_polices(numero_police, type_police, assure_nom)')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statut_paiement) query = query.eq('statut_paiement', statut_paiement)
    if (agent_id)        query = query.eq('agent_id', agent_id)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total_a_payer = (data ?? [])
      .filter((c: { statut_paiement: string }) => c.statut_paiement === 'en_attente')
      .reduce((s: number, c: { montant: number }) => s + (c.montant ?? 0), 0)
    const total_paye = (data ?? [])
      .filter((c: { statut_paiement: string }) => c.statut_paiement === 'paye')
      .reduce((s: number, c: { montant: number }) => s + (c.montant ?? 0), 0)

    return NextResponse.json({ data, total_a_payer, total_paye })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id')
      .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

    const { id, statut_paiement } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updates: Record<string, unknown> = { statut_paiement }
    if (statut_paiement === 'paye') updates.date_paiement = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('ass_commissions')
      .update(updates)
      .eq('id', id).eq('tenant_id', profile.tenant_id)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
