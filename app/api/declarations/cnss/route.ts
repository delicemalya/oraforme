import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  calculerCNSSEmploye, calculerDeclarationGlobale, genererReference,
  type EmployeInput,
} from '@/lib/declarations/cnss-congo'

// ── GET /api/declarations/cnss?mois=X&annee=Y ─────────────────────────────────

export async function GET(request: Request) {
  const { ctx, error } = await requireTenant()
  if (error) return NextResponse.json({ error }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mois  = parseInt(searchParams.get('mois')  ?? String(new Date().getMonth() + 1))
  const annee = parseInt(searchParams.get('annee') ?? String(new Date().getFullYear()))

  const { data: decl } = await supabaseAdmin
    .from('declarations_cnss')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('mois', mois)
    .eq('annee', annee)
    .maybeSingle()

  if (!decl) {
    return NextResponse.json(null, { status: 200 })
  }

  const { data: lignes } = await supabaseAdmin
    .from('declarations_cnss_lignes')
    .select('*')
    .eq('declaration_id', decl.id)
    .order('numero_ordre')

  const employes = (lignes ?? []).map((l: Record<string, unknown>, i: number) =>
    calculerCNSSEmploye(i + 1, {
      employe_id:  l.employe_id as string | undefined,
      nom:         l.nom as string,
      postnom:     l.postnom as string | null,
      prenom:      l.prenom as string,
      numero_cnss: l.numero_cnss as string | null,
      matricule:   l.matricule as string | null,
      poste:       l.poste as string | null,
      salaire_brut: Number(l.salaire_brut),
    })
  )
  const recap = calculerDeclarationGlobale(employes)

  return NextResponse.json({ ...decl, employes, recap })
}

// ── POST /api/declarations/cnss — créer ou mettre à jour ──────────────────────

export async function POST(request: Request) {
  const { ctx, error } = await requireTenant()
  if (error) return NextResponse.json({ error }, { status: 401 })

  const body = await request.json()
  const { mois, annee, statut, pre_rempli_depuis_paie, notes, date_depot, date_paiement, reference_depot } = body

  if (!mois || !annee) {
    return NextResponse.json({ error: 'mois et annee requis' }, { status: 400 })
  }

  // Recalculer les cotisations côté serveur (source de vérité)
  const employesInput: EmployeInput[] = (body.employes ?? []).map((e: Record<string, unknown>) => ({
    employe_id:  e.employe_id  as string | undefined,
    nom:         e.nom         as string,
    postnom:     e.postnom     as string | null | undefined,
    prenom:      e.prenom      as string,
    numero_cnss: e.numero_cnss as string | null | undefined,
    matricule:   e.matricule   as string | null | undefined,
    poste:       e.poste       as string | null | undefined,
    salaire_brut: Number(e.salaire_brut),
  }))
  const employes = employesInput.map((e, i) => calculerCNSSEmploye(i + 1, e))
  const recap    = calculerDeclarationGlobale(employes)

  // Upsert déclaration
  const { data: decl, error: errDecl } = await supabaseAdmin
    .from('declarations_cnss')
    .upsert({
      tenant_id:              ctx.tenantId,
      mois,
      annee,
      reference:              genererReference(mois, annee),
      statut:                 statut ?? 'brouillon',
      pre_rempli_depuis_paie: pre_rempli_depuis_paie ?? false,
      notes,
      date_depot,
      date_paiement,
      reference_depot,
      nb_employes:                         recap.nb_employes,
      masse_salariale:                     recap.masse_salariale,
      base_vieillesse:                     recap.base_vieillesse_total,
      cotisation_vieillesse_employe:       recap.cotisation_vieillesse_employe,
      cotisation_vieillesse_patronal:      recap.cotisation_vieillesse_patronal,
      cotisation_at_mp_pf:                 recap.cotisation_at_mp_pf_total,
      cotisation_tus:                      recap.cotisation_tus_total,
      total_a_verser:                      recap.total_a_verser,
      updated_at:                          new Date().toISOString(),
    }, {
      onConflict: 'tenant_id,mois,annee',
    })
    .select()
    .single()

  if (errDecl) return NextResponse.json({ error: errDecl.message }, { status: 500 })

  // Remplacer les lignes nominatives
  await supabaseAdmin
    .from('declarations_cnss_lignes')
    .delete()
    .eq('declaration_id', decl.id)

  if (employes.length > 0) {
    const lignesToInsert = employes.map(e => ({
      declaration_id:        decl.id,
      tenant_id:             ctx.tenantId,
      employe_id:            e.employe_id ?? null,
      numero_ordre:          e.numero_ordre,
      nom:                   e.nom,
      postnom:               e.postnom ?? null,
      prenom:                e.prenom,
      numero_cnss:           e.numero_cnss === '—' ? null : e.numero_cnss,
      matricule:             e.matricule ?? null,
      poste:                 e.poste ?? null,
      salaire_brut:          e.salaire_brut,
      base_vieillesse:       e.base_vieillesse,
      cotisation_employe:    e.cotisation_employe,
      cotisation_vieillesse: e.cotisation_vieillesse,
      base_at_mp_pf:         e.base_at_mp_pf,
      allocations_familiales: e.allocations_familiales,
      accidents_travail:     e.accidents_travail,
      cotisation_at_mp_pf:   e.cotisation_at_mp_pf,
      cotisation_tus:        e.cotisation_tus,
      total_patronal:        e.total_patronal,
    }))
    await supabaseAdmin.from('declarations_cnss_lignes').insert(lignesToInsert)
  }

  return NextResponse.json({ ...decl, employes, recap }, { status: 200 })
}
