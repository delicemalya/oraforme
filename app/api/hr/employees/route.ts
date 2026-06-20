import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../_auth'

export async function GET() {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('employes')
    .select('*, departements(nom, couleur)')
    .eq('tenant_id', auth.tenantId)
    .order('nom')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!['owner', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Accès refusé — rôle insuffisant' }, { status: 403 })
  }

  const body = await req.json()

  // ── Champs obligatoires ────────────────────────────────────────────────────
  const { nom } = body
  if (!nom?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  // ── Déduplication CNSS ────────────────────────────────────────────────────
  const cnss = body.cnss?.trim() || null
  if (cnss) {
    const { data: dup } = await supabaseAdmin
      .from('employes').select('id')
      .eq('tenant_id', auth.tenantId).eq('cnss', cnss)
      .maybeSingle()
    if (dup) {
      return NextResponse.json({ error: 'Un employé avec ce numéro CNSS existe déjà' }, { status: 409 })
    }
  }

  // ── Génération matricule ───────────────────────────────────────────────────
  const { data: matricule } = await supabaseAdmin.rpc('generate_matricule', {
    p_tenant_id: auth.tenantId,
  })

  // ── Insert employé ────────────────────────────────────────────────────────
  const { data: employe, error: empErr } = await supabaseAdmin
    .from('employes')
    .insert({
      tenant_id:       auth.tenantId,
      matricule:       matricule ?? null,

      // Identité
      nom:             nom.trim(),
      poste:           body.poste?.trim()            || null,
      photo_url:       body.photo_url                || null,
      sexe:            body.sexe                     || null,
      date_naissance:  body.date_naissance           || null,
      lieu_naissance:  body.lieu_naissance           || null,
      nationalite:     body.nationalite              || null,  // plus de 'Congolaise' hardcodé
      situation_matrimoniale: body.situation_matrimoniale || null,
      nb_enfants:      Number(body.nb_enfants)       || 0,
      signature_url:   body.signature_url            || null,

      // Coordonnées
      email:           body.email?.trim()            || null,
      email_pro:       body.email_pro?.trim()        || null,
      email_personnel: body.email_personnel?.trim()  || null,
      telephone:       body.telephone?.trim()        || null,
      telephone2:      body.telephone2?.trim()       || null,
      adresse:         body.adresse                  || null,
      pays:            body.pays                     || null,
      region:          body.region                   || null,
      ville:           body.ville?.trim()            || null,  // plus de 'PNR' hardcodé
      quartier:        body.quartier                 || null,
      contact_urgence_nom: body.contact_urgence_nom  || null,
      contact_urgence_tel: body.contact_urgence_tel  || null,

      // Contrat
      contrat:         body.contrat                  || 'cdi',
      statut:          body.statut                   || 'actif',
      date_embauche:   body.date_embauche            || null,
      date_recrutement: body.date_recrutement        || null,
      date_debut_contrat: body.date_debut_contrat    || null,
      date_fin_contrat: body.date_fin_contrat        || null,
      periode_essai:   body.periode_essai            || null,
      motif_sortie:    body.motif_sortie             || null,
      solde_conges:    26,
      notes:           body.notes                    || null,

      // Organisation
      departement:     body.departement              || null,
      departement_id:  body.departement_id           || null,
      filiale:         body.filiale                  || null,
      agence:          body.agence                   || null,
      direction:       body.direction                || null,
      service:         body.service                  || null,
      equipe:          body.equipe                   || null,
      site_travail:    body.site_travail             || null,
      manager_id:      body.manager_id               || null,
      agent_code:      body.agent_code?.trim()       || null,

      // Poste & Convention
      metier:               body.metier              || null,
      famille_metier:       body.famille_metier      || null,
      niveau_hierarchique:  body.niveau_hierarchique || null,
      categorie_convention: body.categorie_convention || null,
      echelon:              body.echelon             || null,
      grade:                body.grade               || null,
      coefficient:          body.coefficient         || null,
      code_secteur:         body.code_secteur        || null,
      salaire_conventionnel: body.salaire_conventionnel || null,

      // Salaire & Primes fixes
      salaire_base:         Number(body.salaire_base)     || 0,
      taux_horaire:         body.taux_horaire             || null,
      prime_transport:      Number(body.prime_transport)  || 0,
      prime_logement:       Number(body.prime_logement)   || 0,
      prime_rendement:      Number(body.prime_rendement)  || 0,
      prime_risque:         Number(body.prime_risque)     || 0,

      // Fiscal
      numero_cnss:          cnss,
      numero_cnss_centre:   body.numero_cnss_centre       || null,
      numero_fiscal:        body.numero_fiscal            || null,
      pays_fiscal:          body.pays_fiscal              || null,
      residence_fiscale:    body.residence_fiscale        || null,

      // Paiement
      mode_paiement:        body.mode_paiement            || 'banque',
      banque:               body.banque                   || null,
      rib:                  body.rib                      || null,
      iban:                 body.iban                     || null,
      swift:                body.swift                    || null,
      mobile_money_type:    body.mobile_money_type        || null,
      mobile_money_numero:  body.mobile_money_numero      || null,

      // Médical
      groupe_sanguin:       body.groupe_sanguin           || null,
      allergies:            body.allergies                || null,
      handicap:             body.handicap                 ?? false,
      medecin_traitant:     body.medecin_traitant         || null,
      date_visite_medicale: body.date_visite_medicale     || null,
    })
    .select()
    .single()

  if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 })

  const employeId = employe.id

  // ── Insert primes dynamiques ──────────────────────────────────────────────
  if (Array.isArray(body.primes) && body.primes.length > 0) {
    const primesRows = body.primes.map((p: Record<string, unknown>) => ({
      tenant_id:      auth.tenantId,
      employe_id:     employeId,
      code:           p.code,
      nom:            p.nom,
      categorie:      p.categorie    || 'rh',
      montant:        Number(p.montant) || 0,
      type:           p.type         || 'fixe',
      periodicite:    p.periodicite  || 'mensuel',
      imposable:      p.imposable    ?? true,
      soumis_cnss:    p.soumis_cnss  ?? true,
      soumis_irpp:    p.soumis_irpp  ?? true,
      conventionnelle: p.conventionnelle ?? false,
      actif:          true,
    }))
    await supabaseAdmin.from('primes_employe').insert(primesRows)
  }

  // ── Insert avantages en nature ─────────────────────────────────────────────
  if (Array.isArray(body.avantages) && body.avantages.length > 0) {
    const avantagesRows = body.avantages.map((a: Record<string, unknown>) => ({
      tenant_id:          auth.tenantId,
      employe_id:         employeId,
      type:               a.type,
      libelle:            a.libelle,
      valeur:             Number(a.valeur) || 0,
      imposable:          a.imposable          ?? true,
      soumis_cotisations: a.soumis_cotisations ?? true,
      actif:              true,
    }))
    await supabaseAdmin.from('avantages_nature_employe').insert(avantagesRows)
  }

  return NextResponse.json({ success: true, data: employe }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!['owner', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const allowed = [
    'nom','poste','email','email_pro','email_personnel','telephone','telephone2',
    'salaire_base','taux_horaire','contrat','statut','cnss','numero_cnss',
    'numero_cnss_centre','numero_fiscal','date_embauche','date_recrutement',
    'date_debut_contrat','date_fin_contrat','date_naissance','date_retraite_prevue',
    'periode_essai','motif_sortie','nationalite','adresse','pays','region',
    'ville','quartier','contact_urgence_nom','contact_urgence_tel','photo_url',
    'signature_url','situation_matrimoniale','nb_enfants','solde_conges',
    'departement','departement_id','filiale','agence','direction','service',
    'equipe','site_travail','manager_id','agent_code',
    'poste','metier','famille_metier','niveau_hierarchique','categorie_convention',
    'echelon','grade','coefficient','code_secteur','salaire_conventionnel',
    'prime_transport','prime_logement','prime_rendement','prime_risque',
    'mode_paiement','banque','rib','iban','swift','mobile_money_type','mobile_money_numero',
    'groupe_sanguin','allergies','handicap','medecin_traitant','date_visite_medicale',
    'pays_fiscal','residence_fiscale','lieu_naissance','sexe','notes',
  ]

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key]
  }

  const { data, error } = await supabaseAdmin
    .from('employes').update(update).eq('id', id).eq('tenant_id', auth.tenantId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
