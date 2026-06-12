import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createElement } from 'react'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return NextResponse.json({ error }, { status: 401 })

  const { id } = await params

  const { data: ordo } = await supabaseAdmin
    .from('his_ordonnances')
    .select(`
      id, numero, date_prescription, validite_jours, diagnostic, instructions,
      clinique_patients(nom, prenom, date_naissance, sexe, groupe_sanguin, allergies, numero_dossier),
      clinique_medecins(nom, prenom, specialite),
      his_ordonnance_lignes(ordre, nom_medicament, dosage, posologie, duree_jours, quantite, instructions)
    `)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!ordo) return NextResponse.json({ error: 'Ordonnance introuvable' }, { status: 404 })

  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('nom, ville').eq('id', ctx.tenantId).single()

  const { data: config } = await supabaseAdmin
    .from('entreprise_config').select('telephone, adresse').eq('tenant_id', ctx.tenantId).maybeSingle()

  const pat = Array.isArray(ordo.clinique_patients) ? ordo.clinique_patients[0] : ordo.clinique_patients
  const med = Array.isArray(ordo.clinique_medecins) ? ordo.clinique_medecins[0] : ordo.clinique_medecins
  const lignes = (ordo.his_ordonnance_lignes ?? []) as {
    ordre: number; nom_medicament: string; dosage: string | null
    posologie: string; duree_jours: number | null; quantite: number; instructions: string | null
  }[]

  const data = {
    numero:             ordo.numero ?? 'ORD',
    date_prescription:  ordo.date_prescription,
    validite_jours:     ordo.validite_jours ?? 30,
    diagnostic:         ordo.diagnostic,
    instructions:       ordo.instructions,
    patient_nom:            (pat as { nom: string })?.nom ?? '',
    patient_prenom:         (pat as { prenom: string })?.prenom ?? '',
    patient_dob:            (pat as { date_naissance: string | null })?.date_naissance ?? null,
    patient_sexe:           (pat as { sexe: string | null })?.sexe ?? null,
    patient_groupe_sanguin: (pat as { groupe_sanguin: string | null })?.groupe_sanguin ?? null,
    patient_allergies:      (pat as { allergies: string | null })?.allergies ?? null,
    patient_numero_dossier: (pat as { numero_dossier: string | null })?.numero_dossier ?? null,
    medecin_nom:        (med as { nom: string })?.nom ?? '',
    medecin_prenom:     (med as { prenom: string })?.prenom ?? '',
    medecin_specialite: (med as { specialite: string | null })?.specialite ?? null,
    clinique_nom:       (tenant?.nom as string | undefined) ?? 'Clinique',
    clinique_adresse:   config?.adresse ?? null,
    clinique_telephone: config?.telephone ?? null,
    clinique_ville:     (tenant?.ville as string | undefined) ?? 'Brazzaville',
    lignes: lignes.sort((a, b) => a.ordre - b.ordre),
  }

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { OrdonnancePDFDocument } = await import('@/components/sante/OrdonnancePDF')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(OrdonnancePDFDocument, { data }) as any
  const buffer  = await renderToBuffer(element)

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ordonnance-${data.numero}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
