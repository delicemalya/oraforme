import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'

async function ownerAuth() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

export async function GET() {
  const user = await ownerAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('owner_cashflow')
    .select('*')
    .order('date_operation', { ascending: false })

  if (error) {
    // Table doesn't exist yet → return empty (needs migration)
    if (error.code === '42P01') {
      return NextResponse.json({ entries: [], needsMigration: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await ownerAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, categorie, description, montant, moyen, reference } = body

  if (!type || !categorie || !description || !montant || !moyen) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }
  if (!['entree', 'sortie'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }
  if (montant <= 0) {
    return NextResponse.json({ error: 'Montant doit être positif' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('owner_cashflow')
    .insert({
      type,
      categorie,
      description,
      montant,
      moyen,
      reference:      reference || null,
      statut:         'valide',
      date_operation: new Date().toISOString(),
      created_by:     user.email,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Table owner_cashflow manquante. Exécutez la migration SQL.' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data }, { status: 201 })
}
