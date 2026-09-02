import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET /api/portail/client?t=TOKEN ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.json({ error: 'token_required' }, { status: 400 })

  const db = getAdmin()

  // 1. Validate token
  const { data: tok, error: tokErr } = await db
    .from('portal_tokens')
    .select('id, tenant_id, target_id, target_nom, target_email, expires_at, revoked')
    .eq('token', token)
    .eq('portal_type', 'client')
    .single()

  if (tokErr || !tok) return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
  if (tok.revoked) return NextResponse.json({ error: 'token_revoked' }, { status: 401 })
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
    return NextResponse.json({ error: 'token_expired' }, { status: 401 })
  }

  // Update last_used_at
  await db.from('portal_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id)

  const tenantId  = tok.tenant_id
  const clientId  = tok.target_id

  // 2. Load tenant info (agency branding)
  const { data: tenant } = await db
    .from('tenants')
    .select('nom_entreprise, logo_url, pays')
    .eq('id', tenantId)
    .single()

  // 3. Load client info
  let clientInfo: Record<string, unknown> = { id: clientId, nom: tok.target_nom, email: tok.target_email }
  const { data: clientRow } = await db
    .from('clients')
    .select('id, nom, email, telephone, adresse, secteur_activite, contact_nom, contact_email, actif')
    .eq('id', clientId)
    .single()
  if (clientRow) clientInfo = clientRow

  // 4. Demandes (offres_emploi liées à ce client ou correspondant au nom)
  const { data: demandes } = await db
    .from('offres_emploi')
    .select('id, titre, localisation, type_contrat, statut, date_expiration, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(30)

  // 5. Candidats proposés
  const { data: candidatsProposes } = await db
    .from('portal_candidats_proposes')
    .select(`
      id, poste, statut, score_match, message_agence, retour_client, date_proposition,
      candidat:candidat_id (id, nom, prenom, email, telephone, poste_habituel, score_global, cv_url),
      offre:offre_id (id, titre)
    `)
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('date_proposition', { ascending: false })
    .limit(50)

  // 6. Contrats
  const { data: contrats } = await db
    .from('rh_contrats')
    .select('id, reference, poste, type_contrat, statut, date_signature, salaire_brut, document_url, created_at')
    .eq('tenant_id', tenantId)
    .eq('entreprise_cliente', clientInfo?.nom ?? '')
    .order('created_at', { ascending: false })
    .limit(20)

  // 7. Factures
  const { data: factures } = await db
    .from('factures')
    .select('id, numero:invoice_number, total, statut, date_echeance:due_date, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(30)

  // 8. Documents (GED)
  const { data: documents } = await db
    .from('ged_documents')
    .select('id, nom, type_document, taille, url_stockage, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(20)
    .maybeSingle()
    .then(() => db.from('ged_documents').select('id, nom, type_document, taille, url_stockage, created_at').eq('tenant_id', tenantId).limit(20))

  // 9. Notifications (non lues)
  const { data: notifications } = await db
    .from('portal_notifications')
    .select('id, title, body, type, data, read, created_at')
    .eq('tenant_id', tenantId)
    .eq('portal_type', 'client')
    .eq('target_id', clientId)
    .order('created_at', { ascending: false })
    .limit(30)

  // 10. Messages
  const { data: messages } = await db
    .from('portal_messages')
    .select('id, direction, subject, body, read, created_at')
    .eq('tenant_id', tenantId)
    .eq('portal_type', 'client')
    .eq('target_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    tenant,
    client:    clientInfo,
    demandes:  demandes ?? [],
    candidatsProposes: candidatsProposes ?? [],
    contrats:  contrats ?? [],
    factures:  factures ?? [],
    documents: (documents as unknown as unknown[]) ?? [],
    notifications: notifications ?? [],
    messages:  messages ?? [],
    tenantId,
    clientId,
  })
}

// ── POST /api/portail/client — Actions ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    token: string
    action: string
    data:   Record<string, unknown>
  }
  const { token, action, data } = body
  if (!token || !action) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const db = getAdmin()

  const { data: tok } = await db
    .from('portal_tokens')
    .select('tenant_id, target_id, revoked, expires_at')
    .eq('token', token)
    .eq('portal_type', 'client')
    .single()

  if (!tok || tok.revoked) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
    return NextResponse.json({ error: 'token_expired' }, { status: 401 })
  }

  const tenantId = tok.tenant_id
  const clientId = tok.target_id

  switch (action) {
    case 'accept_candidat': {
      await db.from('portal_candidats_proposes').update({
        statut: 'accepte', retour_client: (data.retour as string) ?? '', date_retour: new Date().toISOString(),
      }).eq('id', data.proposition_id as string).eq('client_id', clientId)
      await db.from('portal_notifications').insert({
        tenant_id: tenantId, portal_type: 'client', target_id: clientId,
        title: 'Candidat accepté', body: `Vous avez accepté le candidat pour le poste de ${data.poste ?? ''}`,
        type: 'candidat_propose',
      })
      return NextResponse.json({ ok: true })
    }
    case 'decline_candidat': {
      await db.from('portal_candidats_proposes').update({
        statut: 'refuse', retour_client: (data.retour as string) ?? '', date_retour: new Date().toISOString(),
      }).eq('id', data.proposition_id as string).eq('client_id', clientId)
      return NextResponse.json({ ok: true })
    }
    case 'mark_read': {
      await db.from('portal_notifications').update({ read: true })
        .eq('target_id', clientId).eq('portal_type', 'client')
      return NextResponse.json({ ok: true })
    }
    case 'send_message': {
      await db.from('portal_messages').insert({
        tenant_id: tenantId, portal_type: 'client', target_id: clientId,
        direction: 'inbound', subject: data.subject ?? '', body: data.body ?? '',
      })
      return NextResponse.json({ ok: true })
    }
    default:
      return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  }
}
