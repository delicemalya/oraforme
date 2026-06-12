import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createElement } from 'react'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return NextResponse.json({ error }, { status: 401 })

  const { id } = await params

  const { data: fac } = await supabaseAdmin
    .from('his_factures')
    .select(`
      id, numero_facture, date_facture, date_echeance,
      montant_total, montant_paye, remise, mode_paiement, statut, notes,
      clinique_patients(nom, prenom, telephone, numero_dossier, assurance),
      his_lignes_facture(description, quantite, prix_unitaire, montant_ligne, categorie)
    `)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!fac) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('nom, ville').eq('id', ctx.tenantId).single()

  const { data: config } = await supabaseAdmin
    .from('entreprise_config').select('telephone, adresse, niu').eq('tenant_id', ctx.tenantId).maybeSingle()

  const pat    = Array.isArray(fac.clinique_patients) ? fac.clinique_patients[0] : fac.clinique_patients
  const lignes = (fac.his_lignes_facture ?? []) as {
    description: string; quantite: number; prix_unitaire: number; montant_ligne: number; categorie: string
  }[]

  const data = {
    numero_facture:  fac.numero_facture ?? 'FAC',
    date_facture:    fac.date_facture,
    date_echeance:   fac.date_echeance ?? null,
    montant_total:   fac.montant_total,
    montant_paye:    fac.montant_paye,
    remise:          fac.remise ?? 0,
    mode_paiement:   fac.mode_paiement,
    statut:          fac.statut,
    notes:           fac.notes ?? null,
    patient_nom:             (pat as { nom: string })?.nom ?? '',
    patient_prenom:          (pat as { prenom: string })?.prenom ?? '',
    patient_telephone:       (pat as { telephone: string | null })?.telephone ?? null,
    patient_numero_dossier:  (pat as { numero_dossier: string | null })?.numero_dossier ?? null,
    patient_assurance:       (pat as { assurance: string | null })?.assurance ?? null,
    clinique_nom:       (tenant?.nom as string | undefined) ?? 'Clinique',
    clinique_adresse:   config?.adresse ?? null,
    clinique_telephone: config?.telephone ?? null,
    clinique_ville:     (tenant?.ville as string | undefined) ?? 'Brazzaville',
    clinique_niu:       config?.niu ?? null,
    lignes,
  }

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { FactureMedicalePDFDocument } = await import('@/components/sante/FactureMedicalePDF')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(FactureMedicalePDFDocument, { data }) as any
  const buffer  = await renderToBuffer(element)

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${data.numero_facture}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
