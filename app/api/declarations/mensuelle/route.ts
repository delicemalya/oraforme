// API — Déclaration Générale des Impôts et Taxes
// GET  /api/declarations/mensuelle?mois=X&annee=Y
// GET  /api/declarations/mensuelle?mois=X&annee=Y&preRemplir=true
// POST /api/declarations/mensuelle   (body = FormData)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { preRemplirDeclaration, getDateLimite } from '@/lib/declarations/declaration-generale'

async function getCallerTenantId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.tenant_id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getCallerTenantId()
    if (!tenantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mois  = Number(searchParams.get('mois')  ?? new Date().getMonth() + 1)
    const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())
    const preRemplir = searchParams.get('preRemplir') === 'true'

    if (preRemplir) {
      const supabase = await createSupabaseServerClient()
      const result = await preRemplirDeclaration(tenantId, mois, annee, supabase)
      return NextResponse.json({ preRemplissage: result })
    }

    const { data, error } = await supabaseAdmin
      .from('declarations_generales')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('mois', mois)
      .eq('annee', annee)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ declaration: data ?? null })
  } catch (err) {
    console.error('[declarations/mensuelle GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getCallerTenantId()
    if (!tenantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { mois, annee, ...rest } = body as Record<string, unknown>

    if (!mois || !annee) {
      return NextResponse.json({ error: 'mois et annee requis' }, { status: 400 })
    }

    const dateLimite = getDateLimite(Number(mois), Number(annee))

    const { data, error } = await supabaseAdmin
      .from('declarations_generales')
      .upsert(
        {
          tenant_id: tenantId,
          mois: Number(mois),
          annee: Number(annee),
          date_limite: dateLimite.toISOString().split('T')[0],
          ...rest,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,mois,annee', ignoreDuplicates: false },
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ declaration: data })
  } catch (err) {
    console.error('[declarations/mensuelle POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
