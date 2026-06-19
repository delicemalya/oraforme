import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET /api/portail/candidat?t=TOKEN ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.json({ error: 'token_required' }, { status: 400 })

  const db = getAdmin()

  const { data: tok } = await db
    .from('portal_tokens')
    .select('id, tenant_id, target_id, target_nom, target_email, expires_at, revoked')
    .eq('token', token)
    .eq('portal_type', 'candidat')
    .single()

  if (!tok) return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
  if (tok.revoked) return NextResponse.json({ error: 'token_revoked' }, { status: 401 })
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
    return NextResponse.json({ error: 'token_expired' }, { status: 401 })
  }

  await db.from('portal_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id)

  const tenantId   = tok.tenant_id
  const candidatId = tok.target_id

  // Tenant branding
  const { data: tenant } = await db
    .from('tenants')
    .select('nom_entreprise, logo_url, pays')
    .eq('id', tenantId)
    .single()

  // Candidat profile
  const { data: candidat } = await db
    .from('candidats')
    .select(`
      id, nom, prenom, email, telephone, ville, pays,
      poste_habituel, qualification, score_global, cv_url, cv_text,
      linkedin_url, disponibilite, type_contrat_souhaite,
      salaire_souhaite, mobilite, langues, notes_internes, source,
      is_starred, created_at
    `)
    .eq('id', candidatId)
    .single()

  // Fallback to cv_candidats if candidats not found
  let candidatData = candidat
  if (!candidatData) {
    const { data: cv } = await db
      .from('cv_candidats')
      .select('id, nom, prenom, email, telephone, poste_vise, statut, score_global, cv_url, created_at')
      .eq('id', candidatId)
      .single()
    if (cv) candidatData = cv as unknown as typeof candidatData
  }

  // Missions (rh_placements)
  const { data: missions } = await db
    .from('rh_placements')
    .select('id, poste, entreprise_cliente, type_contrat, date_debut, date_fin, salaire_mensuel, statut, notes, created_at')
    .eq('tenant_id', tenantId)
    .eq('candidat_id', candidatId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Mad affectations (si secteur MAD)
  const { data: affectations } = await db
    .from('mad_affectations')
    .select(`
      id, poste_client, date_debut, date_fin_prevue, date_fin_reelle,
      salaire_mensuel_brut, nb_heures_semaine, statut, renouvellements,
      client:client_id (nom)
    `)
    .eq('tenant_id', tenantId)
    .eq('employe_id', candidatId)
    .order('date_debut', { ascending: false })
    .limit(10)

  // Contrats
  const { data: contrats } = await db
    .from('rh_contrats')
    .select('id, reference, poste, type_contrat, statut, date_signature, salaire_brut, document_url, created_at')
    .eq('tenant_id', tenantId)
    .eq('candidat_id', candidatId)
    .order('created_at', { ascending: false })
    .limit(10)

  // Paie — mad_paie
  const { data: paie } = await db
    .from('mad_paie')
    .select('id, mois, salaire_base, salaire_brut, salaire_net, cotisation_cnss_salarie, irpp, statut, created_at')
    .eq('tenant_id', tenantId)
    .eq('employe_id', candidatId)
    .order('mois', { ascending: false })
    .limit(24)

  // Évaluations (ats_tests)
  const { data: evaluations } = await db
    .from('ats_tests')
    .select('id, nom_test, type_test, score, score_max, date_passation, duree_minutes, statut, notes')
    .eq('tenant_id', tenantId)
    .eq('candidat_id', candidatId)
    .order('date_passation', { ascending: false })
    .limit(20)

  // Diplômes
  const { data: diplomes } = await db
    .from('ats_diplomes')
    .select('id, titre, etablissement, domaine, annee, niveau')
    .eq('tenant_id', tenantId)
    .eq('candidat_id', candidatId)
    .order('annee', { ascending: false })
    .limit(10)

  // Certifications / Formations
  const { data: certifications } = await db
    .from('ats_certifications')
    .select('id, titre, organisme, date_obtention, date_expiration, credential_url')
    .eq('tenant_id', tenantId)
    .eq('candidat_id', candidatId)
    .order('date_obtention', { ascending: false })
    .limit(20)

  // Expériences
  const { data: experiences } = await db
    .from('ats_experiences')
    .select('id, poste, entreprise, secteur, date_debut, date_fin, en_cours, description')
    .eq('tenant_id', tenantId)
    .eq('candidat_id', candidatId)
    .order('date_debut', { ascending: false })
    .limit(10)

  // Entretiens
  const { data: entretiens } = await db
    .from('entretiens')
    .select('id, type, statut, date_entretien, note, commentaire, created_at')
    .eq('tenant_id', tenantId)
    .eq('candidat_id', candidatId)
    .order('date_entretien', { ascending: false })
    .limit(10)

  // Notifications
  const { data: notifications } = await db
    .from('portal_notifications')
    .select('id, title, body, type, data, read, created_at')
    .eq('tenant_id', tenantId)
    .eq('portal_type', 'candidat')
    .eq('target_id', candidatId)
    .order('created_at', { ascending: false })
    .limit(30)

  // Messages
  const { data: messages } = await db
    .from('portal_messages')
    .select('id, direction, subject, body, read, created_at')
    .eq('tenant_id', tenantId)
    .eq('portal_type', 'candidat')
    .eq('target_id', candidatId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    tenant,
    candidat:      candidatData,
    missions:      missions ?? [],
    affectations:  affectations ?? [],
    contrats:      contrats ?? [],
    paie:          paie ?? [],
    evaluations:   evaluations ?? [],
    diplomes:      diplomes ?? [],
    certifications: certifications ?? [],
    experiences:   experiences ?? [],
    entretiens:    entretiens ?? [],
    notifications: notifications ?? [],
    messages:      messages ?? [],
    tenantId,
    candidatId,
  })
}

// ── POST /api/portail/candidat — Actions ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    token:  string
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
    .eq('portal_type', 'candidat')
    .single()

  if (!tok || tok.revoked) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const tenantId   = tok.tenant_id
  const candidatId = tok.target_id

  switch (action) {
    case 'update_profile': {
      const allowed = ['telephone', 'ville', 'disponibilite', 'salaire_souhaite', 'type_contrat_souhaite', 'mobilite']
      const patch: Record<string, unknown> = {}
      for (const k of allowed) {
        if (k in (data as object)) patch[k] = (data as Record<string, unknown>)[k]
      }
      if (Object.keys(patch).length > 0) {
        await db.from('candidats').update(patch).eq('id', candidatId)
      }
      return NextResponse.json({ ok: true })
    }
    case 'mark_read': {
      await db.from('portal_notifications').update({ read: true })
        .eq('target_id', candidatId).eq('portal_type', 'candidat')
      return NextResponse.json({ ok: true })
    }
    case 'send_message': {
      await db.from('portal_messages').insert({
        tenant_id:  tenantId, portal_type: 'candidat', target_id: candidatId,
        direction:  'inbound', subject: data.subject ?? '', body: data.body ?? '',
      })
      return NextResponse.json({ ok: true })
    }
    default:
      return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  }
}
