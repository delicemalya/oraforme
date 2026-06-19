export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../../_auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Load contract + employee
  const { data: contrat, error } = await supabaseAdmin
    .from('contrats')
    .select('*, employes(nom, poste, matricule, cnss, nationalite, adresse, email, telephone)')
    .eq('id', id).eq('tenant_id', auth.tenantId)
    .single()

  if (error || !contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  // Load tenant info
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('nom, adresse, ville')
    .eq('id', auth.tenantId)
    .maybeSingle()

  const pdfData = {
    id:              contrat.id,
    type_contrat:    contrat.type_contrat,
    date_debut:      contrat.date_debut,
    date_fin:        contrat.date_fin,
    salaire_base:    contrat.salaire_base,
    primes:          contrat.primes ?? 0,
    periode_essai:   contrat.periode_essai ?? 0,
    lieu_travail:    contrat.lieu_travail,
    description:     contrat.description,
    signe_le:        contrat.signe_le,
    signe_employe:   contrat.signe_employe ?? false,
    signe_employeur: contrat.signe_employeur ?? false,
    avantages:       contrat.avantages ?? [],
    employe: {
      nom:         contrat.employes?.nom ?? '—',
      poste:       contrat.employes?.poste ?? null,
      matricule:   contrat.employes?.matricule ?? null,
      email:       contrat.employes?.email ?? null,
      telephone:   contrat.employes?.telephone ?? null,
      cnss:        contrat.employes?.cnss ?? null,
      nationalite: contrat.employes?.nationalite ?? 'Congolaise',
      adresse:     contrat.employes?.adresse ?? null,
    },
    entreprise: tenant
      ? { nom: tenant.nom, adresse: tenant.adresse ?? '', ville: tenant.ville ?? 'Brazzaville' }
      : undefined,
  }

  const React             = await import('react')
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { ContratPDF }    = await import('@/components/rh/ContratPDF')

  const element = React.createElement(ContratPDF, { data: pdfData as any }) as any
  const buffer  = await renderToBuffer(element)

  const nomFichier = `contrat-${contrat.employes?.nom?.replace(/\s+/g, '-').toLowerCase() ?? id}-${contrat.date_debut}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
    },
  })
}