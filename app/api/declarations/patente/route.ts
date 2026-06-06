import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import {
  calculerPatente,
  montantEnLettres,
  recalcDepartementPourcentages,
  initDepartements,
  type DepartementRepartition,
} from '@/lib/declarations/patente'

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

// GET /api/declarations/patente?annee=2026
export async function GET(req: NextRequest) {
  const tenantId = await getCallerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const annee = parseInt(req.nextUrl.searchParams.get('annee') ?? String(new Date().getFullYear()))

  const [{ data: declaration }, { data: config }, { data: tenant }] = await Promise.all([
    supabaseAdmin
      .from('declarations_patente')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('annee', annee)
      .maybeSingle(),
    supabaseAdmin
      .from('entreprise_config')
      .select('nom, adresse, telephone, email, rccm, scien, ville')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabaseAdmin
      .from('tenants')
      .select('nom_entreprise, nif, secteur')
      .eq('id', tenantId)
      .maybeSingle(),
  ])

  const prefill = {
    denomination:  config?.nom         ?? tenant?.nom_entreprise ?? '',
    niu:           tenant?.nif          ?? '',
    scien:         config?.scien        ?? '',
    rccm:          config?.rccm         ?? '',
    adresse_siege: config?.adresse      ?? '',
    telephone:     config?.telephone    ?? '',
    email:         config?.email        ?? '',
    secteur_activite: tenant?.secteur   ?? '',
    lieu_signature: config?.ville       ?? 'Brazzaville',
  }

  return NextResponse.json({
    declaration: declaration ?? null,
    prefill,
    annee,
  })
}

// POST /api/declarations/patente — upsert
export async function POST(req: NextRequest) {
  const tenantId = await getCallerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json() as {
    annee:                  number
    niu?:                   string
    scien?:                 string
    rccm?:                  string
    denomination?:          string
    forme_juridique?:       string
    secteur_activite?:      string
    adresse_siege?:         string
    telephone?:             string
    email?:                 string
    representant_legal?:    string
    qualite_representant?:  string
    nature_activite?:       string
    date_debut_activite?:   string
    nb_etablissements?:     number
    ca_annuel:              number
    ca_exonere?:            number
    est_societe_petroliere?: boolean
    credit_n1?:             number
    repartition_departements?: DepartementRepartition[]
    lieu_signature?:        string
    date_signature?:        string
    statut?:                string
  }

  const {
    annee,
    ca_annuel          = 0,
    ca_exonere         = 0,
    est_societe_petroliere = false,
    credit_n1          = 0,
    repartition_departements = initDepartements(),
    statut             = 'brouillon',
    ...sectionA
  } = body

  // Calcul serveur — source de vérité
  const r = calculerPatente(ca_annuel, ca_exonere, est_societe_petroliere, credit_n1)
  const depts = recalcDepartementPourcentages(repartition_departements, r.ca_imposable)

  const payload = {
    tenant_id:    tenantId,
    annee,

    // Section A
    niu:                  sectionA.niu                 ?? '',
    scien:                sectionA.scien               ?? '',
    rccm:                 sectionA.rccm                ?? '',
    denomination:         sectionA.denomination        ?? '',
    forme_juridique:      sectionA.forme_juridique     ?? '',
    secteur_activite:     sectionA.secteur_activite    ?? '',
    adresse_siege:        sectionA.adresse_siege       ?? '',
    telephone:            sectionA.telephone           ?? '',
    email:                sectionA.email               ?? '',
    representant_legal:   sectionA.representant_legal  ?? '',
    qualite_representant: sectionA.qualite_representant ?? '',

    // Section B — recalculated server-side
    nature_activite:        sectionA.nature_activite       ?? '',
    date_debut_activite:    sectionA.date_debut_activite   ?? null,
    nb_etablissements:      body.nb_etablissements         ?? 1,
    ca_annuel:              r.ca_annuel,
    ca_exonere:             r.ca_exonere,
    ca_imposable:           r.ca_imposable,
    taux_applicable:        r.taux_applicable,
    patente_liquidee:       r.patente_liquidee,
    est_societe_petroliere: r.est_societe_petroliere,
    montant_reduction:      r.montant_reduction,
    patente_apres_reduction: r.patente_apres_reduction,
    centimes_additionnels:  r.centimes_additionnels,
    camu:                   r.camu,
    credit_n1:              r.credit_n1,
    patente_nette:          r.patente_nette,
    montant_en_lettres:     montantEnLettres(r.patente_nette),

    // Section C
    repartition_departements: depts,

    // Signature
    lieu_signature: sectionA.lieu_signature ?? '',
    date_signature: sectionA.date_signature ?? null,

    statut: ['brouillon', 'complete', 'soumise'].includes(statut) ? statut : 'brouillon',
  }

  const { data, error } = await supabaseAdmin
    .from('declarations_patente')
    .upsert(payload, { onConflict: 'tenant_id,annee' })
    .select()
    .single()

  if (error) {
    console.error('[declarations/patente POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ declaration: data })
}
