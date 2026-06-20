export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerCNSSEmploye, calculerDeclarationGlobale } from '@/lib/declarations/cnss-congo'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { DeclarationGlobaleCNSS } from '@/components/declarations/pdf/DeclarationGlobaleCNSS'
import { ListeNominativeCNSS } from '@/components/declarations/pdf/ListeNominativeCNSS'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return NextResponse.json({ error }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'globale'

  const { data: decl } = await supabaseAdmin
    .from('declarations_cnss')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!decl) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

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

  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('nom').eq('id', ctx.tenantId).single()

  const declFull   = { ...decl, employes, recap }
  const entreprise = (tenant?.nom as string | undefined) ?? 'Entreprise'

   
  type PdfEl = React.ReactElement<DocumentProps, any>

  let pdfEl: PdfEl
  let filename: string

  if (type === 'nominative') {
    pdfEl    = createElement(ListeNominativeCNSS, { decl: declFull, entreprise }) as PdfEl
    filename = `CNSS_Liste_Nominative_${decl.annee}_${String(decl.mois).padStart(2, '0')}.pdf`
  } else {
    pdfEl    = createElement(DeclarationGlobaleCNSS, { decl: declFull, entreprise }) as PdfEl
    filename = `CNSS_Declaration_Globale_${decl.annee}_${String(decl.mois).padStart(2, '0')}.pdf`
  }

  const pdfBuffer = await renderToBuffer(pdfEl)
  const bytes     = new Uint8Array(pdfBuffer)

  return new Response(bytes, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(bytes.length),
    },
  })
}