export const runtime = 'nodejs'

// API route — Génération PDF Patente 721M
// POST /api/declarations/patente/pdf
// Body : PatentePDFData (données complètes de la déclaration)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await req.json() as Record<string, unknown>

    // Dynamic imports (required: @react-pdf/renderer is CJS, not compatible with edge runtime)
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement }  = await import('react')
    const { PatentePDFDocument } = await import('@/components/declarations/PatentePDF')

     
    const element = createElement(PatentePDFDocument, { data: body as any }) as any
    const buffer = await renderToBuffer(element)

    const annee = (body.annee as number) ?? new Date().getFullYear()
    const denom = ((body.denomination_sociale as string) ?? 'entreprise').replace(/\s+/g, '-').toLowerCase().slice(0, 30)

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="patente-721M-${annee}-${denom}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[patente/pdf]', err)
    return NextResponse.json(
      { error: 'Erreur génération PDF', detail: String(err) },
      { status: 500 }
    )
  }
}