import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(_req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url = new URL(_req.url)
  const statut  = url.searchParams.get('statut')
  const search  = url.searchParams.get('search')
  const secteur = url.searchParams.get('secteur')
  const type_compte = url.searchParams.get('type_compte')

  let q = supabaseAdmin
    .from('cabinet_clients')
    .select(`
      id, nom_entreprise, forme_juridique, secteur_activite, pays, ville, devise_locale,
      telephone, email, contact_nom, contact_prenom, contact_email, contact_poste,
      types_mission, honoraires_mensuel, frais_oraforme, periodicite,
      acces_actif, statut, type_compte, date_debut_mission, client_tenant_id, created_at,
      cabinet_taches(id, statut),
      cabinet_documents(id, statut),
      cabinet_messages(id, lu, expediteur)
    `)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .order('nom_entreprise', { ascending: true })

  if (statut)      q = q.eq('statut', statut)
  if (secteur)     q = q.eq('secteur_activite', secteur)
  if (type_compte) q = q.eq('type_compte', type_compte)
  if (search)      q = q.ilike('nom_entreprise', `%${search}%`)

  const { data, error: dbErr } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const clients = data ?? []
  const kpis = {
    total:               clients.length,
    actifs:              clients.filter(c => c.statut === 'actif').length,
    prospects:           clients.filter(c => c.statut === 'prospect').length,
    suspendus:           clients.filter(c => c.statut === 'suspendu').length,
    revenue_mois:        clients.filter(c => c.statut === 'actif').reduce((s, c) => s + (c.frais_oraforme ?? 5000), 0),
    honoraires_mois:     clients.filter(c => c.statut === 'actif' && c.periodicite === 'mensuel').reduce((s, c) => s + (c.honoraires_mensuel ?? 0), 0),
    msgs_non_lus:        clients.reduce((s, c) => s + (c.cabinet_messages as {lu:boolean,expediteur:string}[]).filter(m => !m.lu && m.expediteur === 'client').length, 0),
    taches_urgentes:     clients.reduce((s, c) => s + (c.cabinet_taches as {statut:string}[]).filter(t => t.statut !== 'termine' && t.statut !== 'annule').length, 0),
  }

  return NextResponse.json({ clients, kpis })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const {
    nom_entreprise, forme_juridique, secteur_activite, pays, ville, adresse,
    telephone, email, site_web, niu, rccm, sciet, scien, date_creation_entreprise,
    contact_nom, contact_prenom, contact_telephone, contact_email, contact_poste,
    types_mission, date_debut_mission, honoraires_mensuel, periodicite,
    frais_oraforme, notes, acces_actif, statut, type_compte, devise_locale,
  } = body

  if (!nom_entreprise?.trim()) {
    return NextResponse.json({ error: 'nom_entreprise requis' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_clients')
    .insert({
      cabinet_tenant_id: ctx.tenantId,
      nom_entreprise: nom_entreprise.trim(),
      forme_juridique: forme_juridique ?? null,
      secteur_activite: secteur_activite ?? null,
      pays: pays ?? 'CG', ville: ville ?? null, adresse: adresse ?? null,
      telephone: telephone ?? null, email: email ?? null, site_web: site_web ?? null,
      niu: niu ?? null, rccm: rccm ?? null, sciet: sciet ?? null, scien: scien ?? null,
      date_creation_entreprise: date_creation_entreprise ?? null,
      contact_nom: contact_nom ?? null, contact_prenom: contact_prenom ?? null,
      contact_telephone: contact_telephone ?? null,
      contact_email: contact_email ?? null, contact_poste: contact_poste ?? null,
      types_mission: types_mission ?? [],
      date_debut_mission: date_debut_mission ?? null,
      honoraires_mensuel: honoraires_mensuel ?? 0,
      periodicite: periodicite ?? 'mensuel',
      frais_oraforme: frais_oraforme ?? 5000,
      notes: notes ?? null, acces_actif: acces_actif ?? true,
      statut: statut ?? 'actif',
      type_compte: type_compte ?? 'comptable',
      devise_locale: devise_locale ?? 'XAF',
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  if ((statut ?? 'actif') === 'actif') {
    const now = new Date()
    await supabaseAdmin.rpc('generer_revenue_mensuel', {
      p_cabinet_tenant_id: ctx.tenantId,
      p_mois: now.getMonth() + 1,
      p_annee: now.getFullYear(),
    })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
