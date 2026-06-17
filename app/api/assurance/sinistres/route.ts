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
    const statut = searchParams.get('statut')
    const search = searchParams.get('search')

    let query = supabase
      .from('ass_sinistres')
      .select('*, ass_polices(numero_police, type_police, assure_nom, prime_montant)')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statut) query = query.eq('statut', statut)
    if (search) query = query.ilike('description', `%${search}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Taux sinistralité
    const { data: polices } = await supabase
      .from('ass_polices').select('prime_montant').eq('tenant_id', profile.tenant_id).eq('statut', 'active')
    const primes_total = (polices ?? []).reduce((s: number, p: { prime_montant: number }) => s + (p.prime_montant ?? 0), 0)
    const sinistres_payes = (data ?? []).reduce((s: number, sin: { montant_paye: number }) => s + (sin.montant_paye ?? 0), 0)
    const taux_sinistralite = primes_total > 0 ? Math.round((sinistres_payes / primes_total) * 100) : 0

    return NextResponse.json({ data, taux_sinistralite, primes_total, sinistres_payes })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id')
      .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

    const body = await req.json()
    const { data, error } = await supabase
      .from('ass_sinistres')
      .insert({
        ...body,
        tenant_id: profile.tenant_id,
        historique_statuts: [{ statut: 'declare', date: new Date().toISOString(), note: 'Déclaration initiale' }],
      })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
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

    const body = await req.json()
    const { id, statut, note, ...rest } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Fetch current historique
    const { data: current } = await supabase
      .from('ass_sinistres').select('historique_statuts').eq('id', id).single()

    const historique = [
      ...((current?.historique_statuts as Array<{ statut: string; date: string; note?: string }>) ?? []),
      { statut, date: new Date().toISOString(), note: note ?? '' },
    ]

    const { data, error } = await supabase
      .from('ass_sinistres')
      .update({ ...rest, statut, historique_statuts: historique, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', profile.tenant_id)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
