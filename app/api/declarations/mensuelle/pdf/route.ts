export const runtime = 'nodejs'

// POST /api/declarations/mensuelle/pdf — Génération PDF Déclaration Générale DGI

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()

    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement }  = await import('react')
    const { DeclarationGeneralePDFDocument } = await import('@/components/declarations/DeclarationGeneralePDF')

     
    const element = createElement(DeclarationGeneralePDFDocument, { data: body as any }) as any
    const buffer  = await renderToBuffer(element)

    const mois  = body.mois  as number ?? new Date().getMonth() + 1
    const annee = body.annee as number ?? new Date().getFullYear()
    const MOIS_FR = ['jan','fev','mar','avr','mai','jun','jul','aou','sep','oct','nov','dec']

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="declaration-dgi-${MOIS_FR[mois - 1]}-${annee}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[declarations/mensuelle/pdf]', err)
    return NextResponse.json({ error: 'Erreur génération PDF', detail: String(err) }, { status: 500 })
  }
}