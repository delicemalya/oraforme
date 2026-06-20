import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

// POST /api/cabinet/switch — Créer une session "entrer dans le compte client"
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { client_id } = await req.json()
  if (!client_id) return NextResponse.json({ error: 'client_id requis' }, { status: 400 })

  // Vérifier que le client appartient bien à ce cabinet
  const { data: client } = await supabaseAdmin
    .from('cabinet_clients')
    .select('id, nom_entreprise, client_tenant_id, statut')
    .eq('id', client_id)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  if (client.statut === 'suspendu' || client.statut === 'archive' || client.statut === 'resilie') {
    return NextResponse.json({ error: 'Client inactif' }, { status: 403 })
  }

  // Créer la session switch
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
  const ua = req.headers.get('user-agent') ?? null

  const { data: session, error: sessErr } = await supabaseAdmin
    .from('cabinet_switch_sessions')
    .insert({
      cabinet_tenant_id: ctx.tenantId,
      cabinet_user_id:   ctx.userId,
      client_id,
      client_tenant_id:  client.client_tenant_id ?? null,
      ip_address:        ip,
      user_agent:        ua,
    })
    .select('id, session_token, expires_at, client_id')
    .single()

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 })

  return NextResponse.json({
    session_token:  session.session_token,
    expires_at:     session.expires_at,
    client_id:      session.client_id,
    nom_entreprise: client.nom_entreprise,
  })
}

// DELETE /api/cabinet/switch — Révoquer la session active
export async function DELETE(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  await supabaseAdmin
    .from('cabinet_switch_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('session_token', token)
    .eq('cabinet_tenant_id', ctx.tenantId)

  return NextResponse.json({ ok: true })
}

// GET /api/cabinet/switch — Lister les sessions actives
export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { data } = await supabaseAdmin
    .from('cabinet_switch_sessions')
    .select('id, client_id, expires_at, created_at, cabinet_clients(nom_entreprise)')
    .eq('cabinet_tenant_id', ctx.tenantId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json(data ?? [])
}
