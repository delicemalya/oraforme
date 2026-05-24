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
    .from('owner_transferts')
    .select('*')
    .order('date_operation', { ascending: false })

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ transferts: [], needsMigration: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ transferts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await ownerAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, source_type, dest_type, description, montant, reference, client_nom, motif_remboursement } = body

  if (!type || !source_type || !dest_type || !description || !montant) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }
  if (source_type === dest_type) {
    return NextResponse.json({ error: 'Source et destination identiques' }, { status: 400 })
  }
  if (montant <= 0) {
    return NextResponse.json({ error: 'Montant doit être positif' }, { status: 400 })
  }

  const validTypes = ['transfert', 'remboursement_client', 'remboursement_erreur', 'remboursement_entreprise']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('owner_transferts')
    .insert({
      type,
      source_type,
      dest_type,
      description,
      montant,
      reference:           reference || null,
      client_nom:          client_nom || null,
      motif_remboursement: motif_remboursement || null,
      statut:              'execute',
      date_operation:      new Date().toISOString(),
      created_by:          user.email,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Table owner_transferts manquante. Exécutez la migration SQL.' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also create journal entry for the transfer (OHADA double-entry if applicable)
  // 512 → 521 (banque → caisse), 521 → 512, etc.
  // This is informational only for now — full OHADA auto-journal via triggers in migration

  return NextResponse.json({ transfert: data }, { status: 201 })
}
